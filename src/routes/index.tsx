import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, Globe, Gauge, Code2, ScanSearch, ExternalLink } from "lucide-react";
import { OnPageTab } from "@/components/seo/OnPageTab";
import { PageSpeedTab } from "@/components/seo/PageSpeedTab";
import { SchemaTab } from "@/components/seo/SchemaTab";
import type { AuditReport } from "@/lib/seo-types";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "SEO Audit Tool — Instant On-Page, Speed & Schema Analysis" },
      {
        name: "description",
        content:
          "Professional SEO audit tool for digital agencies. Analyze on-page SEO, Core Web Vitals, and structured data for any URL in seconds.",
      },
    ],
  }),
});

function Index() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("seo-audit", {
        body: { url: url.trim() },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setReport(data as AuditReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gradient-hero)] shadow-[var(--shadow-elegant)]">
              <ScanSearch className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                SEO<span className="text-primary">Audit</span>
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Agency Edition
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Hero / Input */}
        <section className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Instant SEO health check for any page
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            On-page signals, Core Web Vitals, and structured data — analyzed in one click.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="example.com or https://example.com/page"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="h-12 pl-10 text-base shadow-[var(--shadow-card)]"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              className="h-12 bg-[var(--gradient-hero)] px-6 text-base font-semibold shadow-[var(--shadow-elegant)] hover:opacity-95"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        {/* Loading skeleton */}
        {loading && (
          <section className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted" />
                <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">Running audit…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crawling page, parsing schema, and testing PageSpeed (mobile + desktop)
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Results */}
        {report && !loading && (
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
                <span>HTTP {report.httpStatus}</span>
                <span>{new Date(report.fetchedAt).toLocaleString()}</span>
              </div>
            </div>

            <Tabs defaultValue="onpage" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-card shadow-[var(--shadow-card)] h-auto p-1">
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
          </section>
        )}

        {/* Empty state */}
        {!report && !loading && !error && (
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Globe, title: "On-Page SEO", desc: "Title, meta, headings, canonical, robots & alt tags" },
              { icon: Gauge, title: "Core Web Vitals", desc: "Mobile + desktop scores from Google PageSpeed" },
              { icon: Code2, title: "Structured Data", desc: "All JSON-LD schema types detected on the page" },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
