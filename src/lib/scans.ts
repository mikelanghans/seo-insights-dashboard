import { supabase } from "@/integrations/supabase/client";
import type { AuditReport, SiteAuditReport } from "./seo-types";

export type ScanStatus = "pending" | "running" | "complete" | "failed";
export type ScanPhase = "mapping" | "scanning" | "grading" | "complete" | null;
export type ScanKind = "site" | "page";

export interface SavedScanSummary {
  id: string;
  rootUrl: string;
  scope: string;
  kind: ScanKind;
  auditType: "seo" | "a11y" | null;
  status: ScanStatus;
  phase: ScanPhase;
  pagesScanned: number;
  pagesTotal: number;
  discoveredUrlCount: number;
  errorMessage: string | null;
  retryScanId: string | null;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
  updatedAt: string;
  gradeLetter: string | null;
  gradeScore: number | null;
}

export interface SavedScan extends SavedScanSummary {
  report: SiteAuditReport;
}

export interface SavedPageScan extends SavedScanSummary {
  report: AuditReport;
}

const SUMMARY_COLUMNS =
  "id, root_url, scope, kind, audit_type, status, phase, pages_scanned, pages_total, discovered_url_count, error_message, retry_scan_id, client_id, client_name, created_at, updated_at, grade_letter, grade_score";

type SummaryRow = {
  id: string;
  root_url: string;
  scope: string;
  kind: string | null;
  audit_type: string | null;
  status: string;
  phase: string | null;
  pages_scanned: number;
  pages_total: number;
  discovered_url_count: number;
  error_message: string | null;
  retry_scan_id: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
};

function mapSummary(row: SummaryRow): SavedScanSummary {
  return {
    id: row.id,
    rootUrl: row.root_url,
    scope: row.scope,
    kind: ((row.kind as ScanKind) ?? "site"),
    auditType: (row.audit_type as "seo" | "a11y" | null) ?? null,
    status: (row.status as ScanStatus) ?? "complete",
    phase: (row.phase as ScanPhase) ?? null,
    pagesScanned: row.pages_scanned,
    pagesTotal: row.pages_total,
    discoveredUrlCount: row.discovered_url_count,
    errorMessage: row.error_message,
    retryScanId: row.retry_scan_id,
    clientId: row.client_id,
    clientName: row.client_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Start an asynchronous site scan. Returns the scan id immediately. */
export async function startScan(params: {
  rootUrl: string;
  scope: string;
  clientId?: string | null;
  clientWebsiteId?: string | null;
}): Promise<{ scanId: string } | { error: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { error: "You need to be signed in to run a scan." };

  const res = await fetch("/api/scan-start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: params.rootUrl,
      scope: params.scope,
      clientId: params.clientId ?? null,
      clientWebsiteId: params.clientWebsiteId ?? null,
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | { scanId?: string; error?: string }
    | null;
  if (!res.ok || !data?.scanId) {
    return { error: data?.error || "Could not start scan." };
  }
  return { scanId: data.scanId };
}

export async function updateScanReport(scanId: string, report: SiteAuditReport): Promise<void> {
  const { error } = await supabase
    .from("scans")
    .update({
      report: report as never,
      pages_scanned: report.pagesScanned,
      discovered_url_count: report.discoveredUrlCount,
    })
    .eq("id", scanId);
  if (error) console.error("Failed to update scan:", error);
}

export async function linkRetryScan(originalId: string, retryId: string): Promise<void> {
  const { error } = await supabase
    .from("scans")
    .update({ retry_scan_id: retryId })
    .eq("id", originalId);
  if (error) console.error("Failed to link retry scan:", error);
}

export async function listRecentScans(
  limit = 10,
  opts?: { since?: string | null; until?: string | null },
): Promise<SavedScanSummary[]> {
  let q = supabase
    .from("scans")
    .select(SUMMARY_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.since) q = q.gte("created_at", opts.since);
  if (opts?.until) q = q.lte("created_at", opts.until);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as SummaryRow[]).map(mapSummary);
}

export async function listScansForClient(clientId: string): Promise<SavedScanSummary[]> {
  const { data, error } = await supabase
    .from("scans")
    .select(SUMMARY_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as SummaryRow[]).map(mapSummary);
}

export interface ClientLatestScanSummary extends SavedScanSummary {
  gradeLetter: string | null;
  gradeScore: number | null;
}

/**
 * Load the most recent completed scan per client for the dashboard list.
 * Does NOT pull the `report` jsonb — uses precomputed `grade_letter`/`grade_score`
 * columns so the payload stays tiny even with thousands of scans.
 *
 * For legacy scans (created before grade columns existed), it lazily backfills
 * by loading just those reports, computing the grade in JS, and updating the row.
 * After the first call, all rows have grades and subsequent calls are fast.
 */
export async function listLatestScanPerClient(): Promise<Record<string, ClientLatestScanSummary>> {
  const { data, error } = await supabase
    .from("scans")
    .select(`${SUMMARY_COLUMNS}, grade_letter, grade_score`)
    .not("client_id", "is", null)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return {};

  const out: Record<string, ClientLatestScanSummary> = {};
  const needsBackfill: string[] = [];
  for (const row of data as (SummaryRow & { grade_letter: string | null; grade_score: number | null })[]) {
    const clientId = row.client_id;
    if (!clientId || out[clientId]) continue;
    out[clientId] = {
      ...mapSummary(row),
      gradeLetter: row.grade_letter,
      gradeScore: row.grade_score,
    };
    if (row.grade_letter === null) needsBackfill.push(row.id);
  }

  // Lazy backfill legacy rows in the background — does not block the UI.
  if (needsBackfill.length > 0) {
    void backfillScanGrades(needsBackfill).then((filled) => {
      for (const [scanId, summary] of filled) {
        for (const cid of Object.keys(out)) {
          if (out[cid].id === scanId) {
            out[cid] = {
              ...out[cid],
              gradeLetter: summary.grade_letter,
              gradeScore: summary.grade_score,
            };
          }
        }
      }
    });
  }
  return out;
}

async function backfillScanGrades(
  scanIds: string[],
): Promise<Array<[string, { grade_letter: string; grade_score: number }]>> {
  // Lazy import to keep computeGrade out of the hot path.
  const { summarizeSiteReport, summarizePageReport } = await import("./scan-grade-summary");
  const { data } = await supabase
    .from("scans")
    .select("id, kind, report")
    .in("id", scanIds);
  if (!data) return [];
  const filled: Array<[string, { grade_letter: string; grade_score: number }]> = [];
  for (const row of data as { id: string; kind: string | null; report: unknown }[]) {
    try {
      const summary =
        (row.kind ?? "site") === "page"
          ? summarizePageReport(row.report as AuditReport)
          : summarizeSiteReport(row.report as SiteAuditReport);
      await supabase
        .from("scans")
        .update({ grade_letter: summary.grade_letter, grade_score: summary.grade_score })
        .eq("id", row.id);
      filled.push([row.id, summary]);
    } catch (err) {
      console.warn("[backfillScanGrades] failed for", row.id, err);
    }
  }
  return filled;
}

export async function getScanStatus(id: string): Promise<SavedScanSummary | null> {
  const { data, error } = await supabase
    .from("scans")
    .select(SUMMARY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapSummary(data as SummaryRow);
}

export async function loadScan(id: string): Promise<SavedScan | null> {
  const { data, error } = await supabase
    .from("scans")
    .select(`${SUMMARY_COLUMNS}, report`)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const summary = mapSummary(data as SummaryRow);
  return {
    ...summary,
    report: (data as SummaryRow & { report: unknown }).report as SiteAuditReport,
  };
}

export async function loadPageScan(id: string): Promise<SavedPageScan | null> {
  const { data, error } = await supabase
    .from("scans")
    .select(`${SUMMARY_COLUMNS}, report`)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const summary = mapSummary(data as SummaryRow);
  return {
    ...summary,
    report: (data as SummaryRow & { report: unknown }).report as AuditReport,
  };
}

export async function deleteScan(id: string): Promise<boolean> {
  const { error } = await supabase.from("scans").delete().eq("id", id);
  return !error;
}

export async function setScanPublic(id: string, isPublic: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("scans")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) console.error("Failed to update share state:", error);
  return !error;
}

export type PublicScan =
  | { kind: "site"; summary: SavedScanSummary; report: SiteAuditReport }
  | { kind: "page"; summary: SavedScanSummary; report: AuditReport };

export async function loadPublicScan(id: string): Promise<PublicScan | null> {
  const { data, error } = await supabase
    .from("scans")
    .select(`${SUMMARY_COLUMNS}, report, is_public`)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as SummaryRow & { report: unknown; is_public: boolean };
  if (!row.is_public) return null;
  const summary = mapSummary(row);
  if (summary.kind === "page") {
    return { kind: "page", summary, report: row.report as AuditReport };
  }
  return { kind: "site", summary, report: row.report as SiteAuditReport };
}


