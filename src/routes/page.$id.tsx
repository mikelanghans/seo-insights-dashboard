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
import { loadPageScan, type SavedPageScan } from "@/lib/scans";
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
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to scanner
        </Link>

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
        ) : (
          <section className="space-y-6">
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
                  <TabsList className="grid w-full grid-cols-4 bg-card shadow-[var(--shadow-card)] h-auto p-1">
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
                    <TabsTrigger value="a11y" className="gap-2 py-2.5">
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline">Accessibility</span>
                      <span className="sm:hidden">A11y</span>
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="gap-2 py-2.5">
                      <Code2 className="h-4 w-4" />
                      Schema
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="onpage" className="mt-6">
                    <OnPageTab data={report.onPage} />
                  </TabsContent>
                  <TabsContent value="speed" className="mt-6">
                    <PageSpeedTab mobile={report.pageSpeed.mobile} desktop={report.pageSpeed.desktop} />
                  </TabsContent>
                  <TabsContent value="a11y" className="mt-6">
                    <AccessibilityTab report={report.accessibility} />
                  </TabsContent>
                  <TabsContent value="schema" className="mt-6">
                    <SchemaTab items={report.schema} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
