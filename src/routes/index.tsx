import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, Globe, Gauge, Code2, ScanSearch, ExternalLink, CheckCircle2 } from "lucide-react";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
import { OnPageTab } from "@/components/seo/OnPageTab";
import { PageSpeedTab } from "@/components/seo/PageSpeedTab";
import { SchemaTab } from "@/components/seo/SchemaTab";
import { GradeCard } from "@/components/seo/GradeCard";
import { computeGrade } from "@/lib/seo-grade";
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
  const urlInputRef = useRef<HTMLInputElement>(null);
  const auditInFlightRef = useRef(false);
  const activeAuditIdRef = useRef(0);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);

  const normalizedUrl = normalizeUrl(url);
  const isValid = normalizedUrl !== null;

  // Simulated progress while audit runs (caps at 92% until complete)
  useEffect(() => {
    if (!loading) {
      setProgress(loading ? 0 : report ? 100 : 0);
      return;
    }
    setProgress(8);
    const interval = setInterval(() => {
      setProgress((p) => (p < 92 ? p + Math.max(1, (92 - p) * 0.06) : p));
    }, 400);
    return () => clearInterval(interval);
  }, [loading, report]);

  async function runAudit(rawUrl?: string) {
    const candidate = rawUrl ?? urlInputRef.current?.value ?? url;
    const auditUrl = normalizeUrl(candidate);
    if (!auditUrl || auditInFlightRef.current) {
      if (!auditUrl) setError("Please enter a valid URL (e.g. example.com).");
      return;
    }
    auditInFlightRef.current = true;
    const auditId = activeAuditIdRef.current + 1;
    activeAuditIdRef.current = auditId;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/api/seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: auditUrl }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Audit failed");
      }
      if (activeAuditIdRef.current !== auditId) return;
      setReport(data as AuditReport);
      setProgress(100);
    } catch (err) {
      if (activeAuditIdRef.current !== auditId) return;
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      if (activeAuditIdRef.current === auditId) {
        auditInFlightRef.current = false;
        setLoading(false);
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runAudit();
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b border-border/80 bg-card/85 backdrop-blur-md">
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
        <section className="mb-10 rounded-3xl border border-border/80 bg-card/75 px-4 py-10 text-center shadow-[var(--shadow-card)] backdrop-blur-sm sm:px-8">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ScanSearch className="h-3.5 w-3.5" />
            Agency SEO Diagnostics
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Instant SEO health check for any page
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            On-page signals, Core Web Vitals, and structured data — analyzed in one click.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-border bg-background/95 p-2 shadow-[var(--shadow-elegant)] sm:flex-row sm:items-stretch"
          >
            <div className="relative flex-1 min-w-0">
              <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                ref={urlInputRef}
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="example.com or https://example.com/page"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                aria-invalid={url.length > 0 && !isValid}
                className="h-13 border-0 bg-transparent pl-11 pr-10 text-base shadow-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {isValid && !loading && (
                <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
              )}
            </div>
            <Button
              type="submit"
              disabled={loading}
              aria-disabled={loading}
              className="h-13 w-full shrink-0 border-0 !bg-none px-6 text-base font-semibold !text-white shadow-[var(--shadow-elegant)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[150px]"
              style={{ backgroundImage: "var(--gradient-hero)" }}
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

          {url.length > 0 && !isValid && !error && (
            <p className="mx-auto mt-3 max-w-2xl text-xs text-muted-foreground">
              Enter a valid URL like <code className="rounded bg-muted px-1 py-0.5">example.com</code> to enable Analyze.
            </p>
          )}

          {error && (
            <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        {/* Loading state with progress */}
        {loading && (
          <section className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex flex-col items-center justify-center gap-5 py-12">
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
              <div className="w-full max-w-md space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>This usually takes 10–30 seconds</span>
                  <span className="tabular-nums">{Math.round(progress)}%</span>
                </div>
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
                {report.httpStatus > 0 && <span>HTTP {report.httpStatus}</span>}
                <span>{new Date(report.fetchedAt).toLocaleString()}</span>
              </div>
            </div>

            {report.crawlError && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                The page blocked the HTML crawl, so On-Page SEO and Schema may be limited. Page Speed still ran where available.
              </div>
            )}

            <GradeCard grade={computeGrade(report)} />

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
