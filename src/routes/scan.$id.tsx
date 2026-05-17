import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, ScanSearch, ArrowLeft, AlertCircle, Download } from "lucide-react";
import { SiteResults } from "@/components/seo/SiteResults";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  loadScan,
  getScanStatus,
  updateScanReport,
  type SavedScan,
  type SavedScanSummary,
} from "@/lib/scans";
import type { SiteAuditReport } from "@/lib/seo-types";
import { useAuth } from "@/hooks/use-auth";
import { exportElementToPdf, pdfFilenameForUrl } from "@/lib/pdf-export";
import { toast } from "sonner";

export const Route = createFileRoute("/scan/$id")({
  component: ScanPage,
  head: () => ({
    meta: [
      { title: "Saved scan — SEO Audit" },
      { name: "description", content: "View a saved SEO site audit." },
    ],
  }),
});

function phaseLabel(phase: SavedScanSummary["phase"]): string {
  switch (phase) {
    case "mapping":
      return "Mapping the site";
    case "scanning":
      return "Scanning pages";
    case "grading":
      return "Grading results";
    case "complete":
      return "Finishing up";
    default:
      return "Starting up";
  }
}

function phaseDescription(summary: SavedScanSummary): string {
  switch (summary.phase) {
    case "mapping":
      return "Discovering URLs across the site (no scraping yet — this is fast).";
    case "scanning":
      return summary.pagesTotal > 0
        ? `Auditing ${summary.pagesTotal} pages for on-page SEO and structured data.`
        : "Auditing pages for on-page SEO and structured data.";
    case "grading":
      return "Running PageSpeed on the homepage and computing the site grade.";
    case "complete":
      return "Saving final report.";
    default:
      return "Preparing the scan.";
  }
}

function ScanPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [scan, setScan] = useState<SavedScan | null>(null);
  const [summary, setSummary] = useState<SavedScanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reportRef = useRef<HTMLDivElement>(null);

  async function handleExportPdf() {
    if (!reportRef.current || !scan) return;
    setExporting(true);
    try {
      await exportElementToPdf(reportRef.current, pdfFilenameForUrl(scan.rootUrl, "site-audit"));
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export PDF");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }

    let active = true;
    setLoading(true);

    const poll = async () => {
      const status = await getScanStatus(id);
      if (!active) return;
      if (!status) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSummary(status);

      if (status.status === "complete") {
        const full = await loadScan(id);
        if (!active) return;
        if (full) setScan(full);
        setLoading(false);
        return;
      }

      if (status.status === "failed") {
        setLoading(false);
        return;
      }

      // Still pending or running — keep polling.
      setLoading(false);
      pollTimer.current = setTimeout(poll, 2000);
    };

    void poll();

    return () => {
      active = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [id, user, authLoading, navigate]);

  function handleReportUpdate(next: SiteAuditReport) {
    setScan((prev) => (prev ? { ...prev, report: next } : prev));
    void updateScanReport(id, next);
  }

  const isRunning =
    summary?.status === "pending" || summary?.status === "running";
  const isFailed = summary?.status === "failed";
  const progressPct = summary
    ? summary.pagesTotal > 0
      ? Math.min(95, Math.round((summary.pagesScanned / summary.pagesTotal) * 90) + 5)
      : summary.phase === "mapping"
        ? 8
        : summary.phase === "grading"
          ? 95
          : 5
    : 0;

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to scanner
          </Link>
          {scan && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Export PDF
            </Button>
          )}
        </div>

        {loading || authLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading scan…</span>
          </div>
        ) : notFound ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ScanSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Scan not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been deleted or belongs to another account.
            </p>
          </div>
        ) : isFailed && summary ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Scan failed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.errorMessage || "Something went wrong while running this scan."}
            </p>
          </div>
        ) : isRunning && summary ? (
          <section className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex flex-col items-center justify-center gap-6 py-8">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted" />
                <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">
                  {phaseLabel(summary.phase)}…
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {phaseDescription(summary)}
                </p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={progressPct} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {summary.pagesTotal > 0
                      ? `${summary.pagesScanned} of ${summary.pagesTotal} pages scanned`
                      : "Discovering pages…"}
                  </span>
                  <span className="tabular-nums">{progressPct}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You can leave this page — the scan keeps running and shows up under Recent scans when done.
              </p>
            </div>
          </section>
        ) : scan ? (
          <div ref={reportRef}>
            <SiteResults report={scan.report} onReportUpdate={handleReportUpdate} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
