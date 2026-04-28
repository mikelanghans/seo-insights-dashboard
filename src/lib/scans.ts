import { supabase } from "@/integrations/supabase/client";
import type { SiteAuditReport } from "./seo-types";

export interface SavedScanSummary {
  id: string;
  rootUrl: string;
  scope: string;
  pagesScanned: number;
  discoveredUrlCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedScan extends SavedScanSummary {
  report: SiteAuditReport;
}

export async function saveScan(params: {
  rootUrl: string;
  scope: string;
  report: SiteAuditReport;
}): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      root_url: params.rootUrl,
      scope: params.scope,
      pages_scanned: params.report.pagesScanned,
      discovered_url_count: params.report.discoveredUrlCount,
      report: params.report as never,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save scan:", error);
    return null;
  }
  return data.id;
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
    .select("id, root_url, scope, pages_scanned, discovered_url_count, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    rootUrl: row.root_url,
    scope: row.scope,
    pagesScanned: row.pages_scanned,
    discoveredUrlCount: row.discovered_url_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function loadScan(id: string): Promise<SavedScan | null> {
  const { data, error } = await supabase
    .from("scans")
    .select("id, root_url, scope, pages_scanned, discovered_url_count, created_at, updated_at, report")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    rootUrl: data.root_url,
    scope: data.scope,
    pagesScanned: data.pages_scanned,
    discoveredUrlCount: data.discovered_url_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    report: data.report as unknown as SiteAuditReport,
  };
}

export async function deleteScan(id: string): Promise<boolean> {
  const { error } = await supabase.from("scans").delete().eq("id", id);
  return !error;
}
