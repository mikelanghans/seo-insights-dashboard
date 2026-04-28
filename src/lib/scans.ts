import { supabase } from "@/integrations/supabase/client";
import type { SiteAuditReport } from "./seo-types";

export type ScanStatus = "pending" | "running" | "complete" | "failed";
export type ScanPhase = "mapping" | "scanning" | "grading" | "complete" | null;

export interface SavedScanSummary {
  id: string;
  rootUrl: string;
  scope: string;
  status: ScanStatus;
  phase: ScanPhase;
  pagesScanned: number;
  pagesTotal: number;
  discoveredUrlCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedScan extends SavedScanSummary {
  report: SiteAuditReport;
}

const SUMMARY_COLUMNS =
  "id, root_url, scope, status, phase, pages_scanned, pages_total, discovered_url_count, error_message, created_at, updated_at";

type SummaryRow = {
  id: string;
  root_url: string;
  scope: string;
  status: string;
  phase: string | null;
  pages_scanned: number;
  pages_total: number;
  discovered_url_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapSummary(row: SummaryRow): SavedScanSummary {
  return {
    id: row.id,
    rootUrl: row.root_url,
    scope: row.scope,
    status: (row.status as ScanStatus) ?? "complete",
    phase: (row.phase as ScanPhase) ?? null,
    pagesScanned: row.pages_scanned,
    pagesTotal: row.pages_total,
    discoveredUrlCount: row.discovered_url_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Start an asynchronous site scan. Returns the scan id immediately. */
export async function startScan(params: {
  rootUrl: string;
  scope: string;
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
    body: JSON.stringify(params),
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

export async function listRecentScans(limit = 10): Promise<SavedScanSummary[]> {
  const { data, error } = await supabase
    .from("scans")
    .select(SUMMARY_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as SummaryRow[]).map(mapSummary);
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

export async function deleteScan(id: string): Promise<boolean> {
  const { error } = await supabase.from("scans").delete().eq("id", id);
  return !error;
}
