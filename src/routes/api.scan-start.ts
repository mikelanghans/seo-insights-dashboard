import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  runSeoSiteAudit,
  type SiteScanScope,
  type ScanProgressUpdate,
} from "@/lib/seo-site-audit.functions";
import type { Database } from "@/integrations/supabase/types";
import { assertPublicHttpUrl } from "@/lib/api-guards";
import { summarizeSiteReport } from "@/lib/scan-grade-summary";

const VALID_SCOPES: SiteScanScope[] = ["quick", "standard", "deep"];

async function verifyUser(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  const sb = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

/**
 * Throttled progress writer — avoid hammering the DB on every page.
 * Always writes the first call (mapping->scanning transition) and the final one.
 */
function makeProgressWriter(scanId: string) {
  let lastWriteAt = 0;
  let lastPhase: string | null = null;
  return async (update: ScanProgressUpdate, force = false) => {
    const now = Date.now();
    const phaseChanged = update.phase !== lastPhase;
    if (!force && !phaseChanged && now - lastWriteAt < 1500) return;
    lastWriteAt = now;
    lastPhase = update.phase;
    await supabaseAdmin
      .from("scans")
      .update({
        phase: update.phase,
        pages_scanned: update.pagesScanned,
        pages_total: update.pagesTotal,
        discovered_url_count: update.discoveredUrlCount,
      })
      .eq("id", scanId);
  };
}

async function executeScan(params: {
  scanId: string;
  url: string;
  scope: SiteScanScope;
}) {
  const writeProgress = makeProgressWriter(params.scanId);
  try {
    await supabaseAdmin
      .from("scans")
      .update({ status: "running", phase: "mapping" })
      .eq("id", params.scanId);

    const report = await runSeoSiteAudit(params.url, params.scope, (u) => {
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
      .eq("id", params.scanId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Site audit failed";
    await supabaseAdmin
      .from("scans")
      .update({ status: "failed", error_message: message })
      .eq("id", params.scanId);
  }
}

export const Route = createFileRoute("/api/scan-start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request.headers.get("authorization"));
        if (!userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
          url?: unknown;
          scope?: unknown;
          clientId?: unknown;
          clientWebsiteId?: unknown;
        } | null;
        if (!body || typeof body.url !== "string" || body.url.trim().length === 0) {
          return Response.json({ error: "Please enter a valid URL." }, { status: 400 });
        }
        if (body.url.length > 2048) {
          return Response.json({ error: "URL is too long." }, { status: 400 });
        }
        // SSRF guard: reject internal/private URLs before storing or scanning.
        const withProto = /^https?:\/\//i.test(body.url.trim())
          ? body.url.trim()
          : `https://${body.url.trim()}`;
        try {
          assertPublicHttpUrl(withProto);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Invalid URL" },
            { status: 400 },
          );
        }

        const scope: SiteScanScope =
          typeof body.scope === "string" && VALID_SCOPES.includes(body.scope as SiteScanScope)
            ? (body.scope as SiteScanScope)
            : "standard";

        // Resolve & validate client ownership.
        let clientId: string | null = null;
        let clientName: string | null = null;
        if (typeof body.clientId === "string" && body.clientId.length > 0) {
          const { data: client } = await supabaseAdmin
            .from("clients")
            .select("id, name, user_id")
            .eq("id", body.clientId)
            .maybeSingle();
          if (!client || client.user_id !== userId) {
            return Response.json({ error: "Client not found." }, { status: 400 });
          }
          clientId = client.id;
          clientName = client.name;
        }

        // Resolve & validate client website ownership.
        let clientWebsiteId: string | null = null;
        if (typeof body.clientWebsiteId === "string" && body.clientWebsiteId.length > 0) {
          const { data: website } = await supabaseAdmin
            .from("client_websites")
            .select("id, user_id, client_id")
            .eq("id", body.clientWebsiteId)
            .maybeSingle();
          if (!website || website.user_id !== userId) {
            return Response.json({ error: "Website not found." }, { status: 400 });
          }
          if (clientId && website.client_id !== clientId) {
            return Response.json(
              { error: "Website does not belong to selected client." },
              { status: 400 },
            );
          }
          clientWebsiteId = website.id;
        }

        // Create a pending scan row immediately so the client can subscribe to progress.
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("scans")
          .insert({
            user_id: userId,
            root_url: withProto,
            scope,
            status: "pending",
            phase: "mapping",
            pages_scanned: 0,
            pages_total: 0,
            discovered_url_count: 0,
            report: {} as never,
            client_id: clientId,
            client_name: clientName,
            client_website_id: clientWebsiteId,
          })
          .select("id")
          .single();

        if (insertError || !inserted) {
          console.error("[scan-start] insert failed:", insertError);
          return Response.json(
            { error: "Could not create scan." },
            { status: 500 },
          );
        }

        // Kick off the scan in the background. On Cloudflare Workers we MUST
        // register the promise with waitUntil — otherwise the runtime cancels
        // pending work the moment the response is returned.
        const scanPromise = executeScan({ scanId: inserted.id, url: body.url, scope });
        try {
          const modName = "cloudflare:workers";
          const mod = (await import(/* @vite-ignore */ modName)) as { ctx: { waitUntil: (p: Promise<unknown>) => void } };
          const { ctx } = mod;
          ctx.waitUntil(scanPromise);
        } catch {
          // Not running on Cloudflare (e.g. local Node dev) — fire-and-forget is fine there.
          void scanPromise;
        }

        return Response.json({ scanId: inserted.id });
      },
    },
  },
});
