import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  ScanSearch,
  ArrowLeft,
  Globe,
  Gauge,
  Code2,
  Eye,
  ExternalLink,
  Download,
  Printer,
  Share2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { OnPageTab } from "@/components/seo/OnPageTab";
import { PageSpeedTab } from "@/components/seo/PageSpeedTab";
import { SchemaTab } from "@/components/seo/SchemaTab";
import { AccessibilityTab } from "@/components/seo/AccessibilityTab";
import { GradeCard } from "@/components/seo/GradeCard";
import { computeGrade } from "@/lib/seo-grade";
import { loadPageScan, setScanPublic, type SavedPageScan } from "@/lib/scans";
import { useAuth } from "@/hooks/use-auth";
import { exportElementToPdf, pdfFilenameForUrl } from "@/lib/pdf-export";
import { toast } from "sonner";

export const Route = createFileRoute("/page/$id")({
  component: PageScanPage,
  head: () => ({
    meta: [
      { title: "Saved page scan — SEOAudit" },
      { name: "description", content: "View a saved single-page SEO audit." },
    ],
  }),
});

function PageScanPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [scan, setScan] = useState<SavedPageScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  async function handleExportPdf() {
    if (!reportRef.current || !scan) return;
    setExporting(true);
    try {
      await exportElementToPdf(
        reportRef.current,
        pdfFilenameForUrl(scan.rootUrl, scan.auditType === "a11y" ? "a11y" : "seo"),
      );
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export PDF");
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    if (!scan) return;
    setSharing(true);
    try {
      const ok = await setScanPublic(scan.id, true);
      if (!ok) throw new Error("Could not enable sharing");
      const url = `${window.location.origin}/report/${scan.id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Share link copied", { description: url });
    } catch (e) {
      console.error(e);
      toast.error("Could not create share link");
    } finally {
      setSharing(false);
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
    void loadPageScan(id).then((result) => {
      if (!active) return;
      if (!result) setNotFound(true);
      else setScan(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, user, authLoading, navigate]);

  const report = scan?.report;

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="no-print">
        <AppHeader />
      </div>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between no-print">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to scanner
          </Link>
          {scan && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print Report
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleShare}
                disabled={sharing}
              >
                {sharing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Share Report
              </Button>
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
            </div>
          )}
        </div>

        {loading || authLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading scan…</span>
          </div>
        ) : notFound || !report ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ScanSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Scan not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been deleted or belongs to another account.
            </p>
          </div>
        ) : !report.onPage || scan?.status === "pending" || scan?.status === "running" ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Scan in progress</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This scan is still running. Refresh the page in a moment to see results.
            </p>
          </div>
        ) : (
          <section ref={reportRef} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Audited URL
                </p>
                <a
                  href={report.onPage.finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-base font-semibold text-foreground hover:text-primary"
                >
                  <span className="truncate">{report.onPage.finalUrl}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {report.httpStatus > 0 && <span>HTTP {report.httpStatus}</span>}
                <span>{new Date(report.fetchedAt).toLocaleString()}</span>
              </div>
            </div>

            {report.crawlError && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                The page blocked the HTML crawl, so On-Page SEO and Schema may be limited. Page Speed still ran where available.
              </div>
            )}

            {report.auditType === "a11y" ? (
              <AccessibilityTab report={report.accessibility} />
            ) : (
              <>
                <GradeCard grade={computeGrade(report)} />
                <Tabs defaultValue="onpage" className="w-full">
                  <TabsList
                    className={`grid w-full ${report.auditType === "both" ? "grid-cols-4" : "grid-cols-3"} bg-card shadow-[var(--shadow-card)] h-auto p-1`}
                  >
                    <TabsTrigger value="onpage" className="gap-2 py-2.5">
                      <Globe className="h-4 w-4" />
                      <span className="hidden sm:inline">On-Page SEO</span>
                      <span className="sm:hidden">On-Page</span>
                    </TabsTrigger>
                    <TabsTrigger value="speed" className="gap-2 py-2.5">
                      <Gauge className="h-4 w-4" />
                      <span className="hidden sm:inline">Page Speed</span>
                      <span className="sm:hidden">Speed</span>
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="gap-2 py-2.5">
                      <Code2 className="h-4 w-4" />
                      Schema
                    </TabsTrigger>
                    {report.auditType === "both" && (
                      <TabsTrigger value="a11y" className="gap-2 py-2.5">
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">Accessibility</span>
                        <span className="sm:hidden">A11y</span>
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value="onpage" className="mt-6">
                    <OnPageTab data={report.onPage} />
                  </TabsContent>
                  <TabsContent value="speed" className="mt-6">
                    <PageSpeedTab mobile={report.pageSpeed.mobile} desktop={report.pageSpeed.desktop} />
                  </TabsContent>
                  <TabsContent value="schema" className="mt-6">
                    <SchemaTab items={report.schema} />
                  </TabsContent>
                  {report.auditType === "both" && (
                    <TabsContent value="a11y" className="mt-6">
                      <AccessibilityTab report={report.accessibility} />
                    </TabsContent>
                  )}
                </Tabs>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
