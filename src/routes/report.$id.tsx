import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Loader2,
  ScanSearch,
  Globe,
  Gauge,
  Code2,
  Eye,
  ExternalLink,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OnPageTab } from "@/components/seo/OnPageTab";
import { PageSpeedTab } from "@/components/seo/PageSpeedTab";
import { SchemaTab } from "@/components/seo/SchemaTab";
import { AccessibilityTab } from "@/components/seo/AccessibilityTab";
import { GradeCard } from "@/components/seo/GradeCard";
import { SiteResults } from "@/components/seo/SiteResults";
import { computeGrade } from "@/lib/seo-grade";
import { loadPublicScan, type PublicScan } from "@/lib/scans";

export const Route = createFileRoute("/report/$id")({
  component: PublicReportPage,
  head: () => ({
    meta: [
      { title: "Shared SEO report — SEOAudit" },
      { name: "description", content: "Read-only shared SEO audit report." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PublicReportPage() {
  const { id } = Route.useParams();
  const [scan, setScan] = useState<PublicScan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadPublicScan(id).then((result) => {
      if (!active) return;
      setScan(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      {/* Branded header — printable, but actions hidden in print */}
      <header className="border-b border-border/80 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gradient-hero)] shadow-[var(--shadow-elegant)]">
              <ScanSearch className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                SEO<span className="text-primary">Audit</span>
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Shared report
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2 no-print">
            <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
            <Link to="/">
              <Button size="sm">Run your own scan</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading report…</span>
          </div>
        ) : !scan ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ScanSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Report not available</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This report is private or the link is invalid.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-muted-foreground no-print">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Read-only shared view · {new Date(scan.summary.createdAt).toLocaleDateString()}
            </div>

            {scan.kind === "site" ? (
              <SiteResults report={scan.report} />
            ) : (
              <PageReport scan={scan} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PageReport({ scan }: { scan: Extract<PublicScan, { kind: "page" }> }) {
  const report = scan.report;
  return (
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

      {report.auditType === "a11y" ? (
        <AccessibilityTab report={report.accessibility} />
      ) : (
        <>
          <GradeCard grade={computeGrade(report)} />
          <Tabs defaultValue="onpage" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-card shadow-[var(--shadow-card)] h-auto p-1 no-print">
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
          </Tabs>
        </>
      )}
    </section>
  );
}
