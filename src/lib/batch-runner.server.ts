/**
 * Server-only batch runner. Executes a saved batch:
 *   1. Loads batch + targets via supabaseAdmin (bypassing RLS).
 *   2. For each target, creates a scan row and runs it.
 *   3. Updates batch_runs and batch_run_scans as it goes.
 *
 * Imported by the authenticated /api/batches/run endpoint and by the
 * public /api/public/hooks/batch-cron endpoint.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSeoSiteAudit, type ScanProgressUpdate } from "@/lib/seo-site-audit.functions";
import { runSeoAuditForUrl } from "@/lib/seo-audit.functions";
import { summarizeSiteReport, summarizePageReport } from "@/lib/scan-grade-summary";

export type ScheduleType = "manual" | "daily" | "weekly" | "monthly";

/** Run a promise as a background task. On Cloudflare uses waitUntil; in Node falls through. */
export async function runInBackground(promise: Promise<unknown>): Promise<void> {
  try {
    const modName = "cloudflare:workers";
    const mod = (await import(/* @vite-ignore */ modName)) as {
      ctx: { waitUntil: (p: Promise<unknown>) => void };
    };
    mod.ctx.waitUntil(promise);
  } catch {
    void promise;
  }
}

/** Compute the next UTC run time after `from` for the given schedule. */
export function computeNextRunAt(opts: {
  type: ScheduleType;
  hour: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  from?: Date;
}): Date | null {
  if (opts.type === "manual") return null;
  const base = opts.from ?? new Date();
  const next = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), opts.hour, 0, 0, 0),
  );
  if (opts.type === "daily") {
    if (next <= base) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (opts.type === "weekly") {
    const target = opts.dayOfWeek ?? 1;
    while (next.getUTCDay() !== target || next <= base) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }
  if (opts.type === "monthly") {
    const target = Math.min(Math.max(opts.dayOfMonth ?? 1, 1), 28);
    next.setUTCDate(target);
    if (next <= base) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(target);
    }
    return next;
  }
  return null;
}

interface BatchRow {
  id: string;
  user_id: string;
  name: string;
  scan_kind: "site" | "page";
  audit_type: "seo" | "a11y";
  scope: "quick" | "standard" | "deep";
  schedule_type: ScheduleType;
  schedule_hour: number;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
}

interface TargetRow {
  client_id: string;
  client_website_id: string;
  client_name: string | null;
  website_url: string;
}

async function runSingleSiteScan(scanId: string, url: string, scope: "quick" | "standard" | "deep") {
  try {
    await supabaseAdmin
      .from("scans")
      .update({ status: "running", phase: "mapping" })
      .eq("id", scanId);
    let lastWrite = 0;
    const writeProgress = async (u: ScanProgressUpdate) => {
      const now = Date.now();
      if (now - lastWrite < 1500) return;
      lastWrite = now;
      await supabaseAdmin
        .from("scans")
        .update({
          phase: u.phase,
          pages_scanned: u.pagesScanned,
          pages_total: u.pagesTotal,
          discovered_url_count: u.discoveredUrlCount,
        })
        .eq("id", scanId);
    };
    const report = await runSeoSiteAudit(url, scope, (u) => {
      void writeProgress(u);
    });
    const summary = summarizeSiteReport(report);
    await supabaseAdmin
      .from("scans")
      .update({
        status: "complete",
        phase: "complete",
        pages_scanned: report.pagesScanned,
        pages_total: report.pagesRequested,
        discovered_url_count: report.discoveredUrlCount,
        report: report as never,
        grade_letter: summary.grade_letter,
        grade_score: summary.grade_score,
      })
      .eq("id", scanId);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Site audit failed";
    await supabaseAdmin
      .from("scans")
      .update({ status: "failed", error_message: message })
      .eq("id", scanId);
    return false;
  }
}

async function runSinglePageScan(scanId: string, url: string, auditType: "seo" | "a11y") {
  try {
    const report = await runSeoAuditForUrl(url, auditType);
    const summary = summarizePageReport(report);
    await supabaseAdmin
      .from("scans")
      .update({
        status: "complete",
        phase: "complete",
        pages_scanned: 1,
        pages_total: 1,
        discovered_url_count: 1,
        report: report as never,
        grade_letter: summary.grade_letter,
        grade_score: summary.grade_score,
      })
      .eq("id", scanId);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Page audit failed";
    await supabaseAdmin
      .from("scans")
      .update({ status: "failed", error_message: message })
      .eq("id", scanId);
    return false;
  }
}

/**
 * Execute a batch: create a batch_run, fan out scans for each target.
 * Returns the new batch_run id immediately; scans continue in the background.
 */
export async function executeBatch(
  batchId: string,
  trigger: "manual" | "scheduled",
): Promise<{ batchRunId: string } | { error: string }> {
  // 1. Load the batch
  const { data: batch, error: batchErr } = await supabaseAdmin
    .from("batches")
    .select(
      "id, user_id, name, scan_kind, audit_type, scope, schedule_type, schedule_hour, schedule_day_of_week, schedule_day_of_month",
    )
    .eq("id", batchId)
    .maybeSingle();
  if (batchErr || !batch) return { error: "Batch not found" };
  const b = batch as BatchRow;

  // 2. Load targets joined with website + client
  const { data: targetsRaw, error: targetsErr } = await supabaseAdmin
    .from("batch_targets")
    .select(
      "client_id, client_website_id, clients(name, is_subscribed), client_websites(url)",
    )
    .eq("batch_id", batchId);
  if (targetsErr) return { error: targetsErr.message };
  const allTargets = (targetsRaw ?? []).map((t) => {
    const row = t as unknown as {
      client_id: string;
      client_website_id: string;
      clients: { name: string; is_subscribed: boolean } | null;
      client_websites: { url: string } | null;
    };
    return {
      client_id: row.client_id,
      client_website_id: row.client_website_id,
      client_name: row.clients?.name ?? null,
      is_subscribed: row.clients?.is_subscribed ?? false,
      website_url: row.client_websites?.url ?? "",
    };
  }).filter((t) => t.website_url.length > 0);

  // Scheduled (automated) runs are restricted to subscribed clients only.
  // Manual runs include all targets regardless of subscription.
  const targets: TargetRow[] = (
    trigger === "scheduled" ? allTargets.filter((t) => t.is_subscribed) : allTargets
  ).map((t) => ({
    client_id: t.client_id,
    client_website_id: t.client_website_id,
    client_name: t.client_name,
    website_url: t.website_url,
  }));

  if (targets.length === 0) {
    return {
      error:
        trigger === "scheduled"
          ? "Batch has no subscribed clients to scan"
          : "Batch has no targets with websites",
    };
  }

  // 3. Create batch_run
  const { data: runInsert, error: runErr } = await supabaseAdmin
    .from("batch_runs")
    .insert({
      batch_id: b.id,
      user_id: b.user_id,
      trigger,
      status: "running",
      scans_total: targets.length,
    })
    .select("id")
    .single();
  if (runErr || !runInsert) return { error: runErr?.message ?? "Could not create run" };
  const batchRunId = runInsert.id as string;

  // 4. Pre-create scan rows + link rows
  const scanRows: { scanId: string; target: TargetRow }[] = [];
  for (const t of targets) {
    const { data: scan } = await supabaseAdmin
      .from("scans")
      .insert({
        user_id: b.user_id,
        root_url: t.website_url,
        scope: b.scan_kind === "site" ? b.scope : "single",
        kind: b.scan_kind,
        audit_type: b.audit_type,
        status: "pending",
        phase: b.scan_kind === "site" ? "mapping" : "complete",
        pages_scanned: 0,
        pages_total: 0,
        discovered_url_count: 0,
        report: {} as never,
        client_id: t.client_id,
        client_name: t.client_name,
        client_website_id: t.client_website_id,
      })
      .select("id")
      .single();
    if (scan?.id) {
      scanRows.push({ scanId: scan.id, target: t });
      await supabaseAdmin.from("batch_run_scans").insert({
        batch_run_id: batchRunId,
        user_id: b.user_id,
        scan_id: scan.id,
        client_id: t.client_id,
        client_website_id: t.client_website_id,
      });
    }
  }

  // 5. Update batch schedule fields
  const nextRunAt = computeNextRunAt({
    type: b.schedule_type,
    hour: b.schedule_hour,
    dayOfWeek: b.schedule_day_of_week,
    dayOfMonth: b.schedule_day_of_month,
  });
  await supabaseAdmin
    .from("batches")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRunAt?.toISOString() ?? null,
    })
    .eq("id", b.id);

  // 6. Kick off the actual scans in the background, sequentially so we don't
  //    overload PageSpeed or the worker. Update counters as we go.
  const work = (async () => {
    let completed = 0;
    let failed = 0;
    for (const { scanId, target } of scanRows) {
      const ok =
        b.scan_kind === "site"
          ? await runSingleSiteScan(scanId, target.website_url, b.scope)
          : await runSinglePageScan(scanId, target.website_url, b.audit_type);
      if (ok) completed++;
      else failed++;
      await supabaseAdmin
        .from("batch_runs")
        .update({ scans_completed: completed, scans_failed: failed })
        .eq("id", batchRunId);
    }
    await supabaseAdmin
      .from("batch_runs")
      .update({
        status: failed === scanRows.length ? "failed" : "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", batchRunId);
  })();
  await runInBackground(work);

  return { batchRunId };
}
