import { useMemo, useState } from "react";
import { ExternalLink, ChevronDown, AlertTriangle, AlertCircle, Info, Loader2, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GradeCard } from "./GradeCard";
import { PageSpeedTab } from "./PageSpeedTab";
import { computeSiteGrade, type IssueSeverity, type RollupIssue } from "@/lib/seo-grade";
import type { SiteAuditReport } from "@/lib/seo-types";
import { supabase } from "@/integrations/supabase/client";

const SEV_STYLES: Record<IssueSeverity, { icon: typeof AlertCircle; className: string; label: string }> = {
  critical: { icon: AlertCircle, className: "text-destructive", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-warning", label: "Warning" },
  info: { icon: Info, className: "text-muted-foreground", label: "Info" },
};

function letterColor(letter: string): string {
  if (letter.startsWith("A")) return "text-success";
  if (letter === "B") return "text-primary";
  if (letter === "C") return "text-warning";
  return "text-destructive";
}

type SortKey = "score" | "url" | "issues";

export function SiteResults({
  report,
  onReportUpdate,
}: {
  report: SiteAuditReport;
  onReportUpdate?: (next: SiteAuditReport) => void;
}) {
  const site = useMemo(() => computeSiteGrade(report), [report]);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sortedPages = useMemo(() => {
    const arr = [...site.pageGrades];
    arr.sort((a, b) => {
      if (sortKey === "score") return a.grade.score - b.grade.score; // worst first
      if (sortKey === "url") return a.page.requestedUrl.localeCompare(b.page.requestedUrl);
      return b.grade.topIssues.length - a.grade.topIssues.length;
    });
    return arr;
  }, [site.pageGrades, sortKey]);

  return (
    <div className="space-y-6">
      {/* Site summary header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Site audit
        </p>
        <a
          href={report.rootUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-base font-semibold text-foreground hover:text-primary"
        >
          <span className="truncate">{report.rootUrl}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            Scanned <strong className="text-foreground">{report.pagesScanned}</strong> of{" "}
            {report.discoveredUrlCount} discovered pages
          </span>
          <span>{new Date(report.fetchedAt).toLocaleString()}</span>
        </div>
        {report.warnings?.map((w, i) => (
          <p key={i} className="mt-2 text-xs text-warning">
            {w}
          </p>
        ))}
      </div>

      {/* Site-wide grade card */}
      <GradeCard grade={site.overall} hideIssuesSection />

      {/* Homepage Page Speed (mobile + desktop) */}
      {report.homepageSpeed && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Homepage Page Speed</h3>
            <p className="text-xs text-muted-foreground">
              Core Web Vitals from Google PageSpeed Insights — measured on the homepage.
            </p>
          </div>
          <PageSpeedTab
            mobile={report.homepageSpeed.mobile}
            desktop={report.homepageSpeed.desktop}
          />
        </div>
      )}

      {/* Per-page table below already groups issues by page — no separate rollup. */}

      {/* Per-page table */}
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Per-page results ({sortedPages.length})
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Sort by</span>
            {(["score", "url", "issues"] as const).map((k) => (
              <Button
                key={k}
                variant={sortKey === k ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSortKey(k)}
              >
                {k === "score" ? "Lowest score" : k === "url" ? "URL" : "Most issues"}
              </Button>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-border">
          {sortedPages.map(({ page, grade }) => {
            const isOpen = expanded === page.requestedUrl;
            const path = (() => {
              try {
                const u = new URL(page.requestedUrl);
                return u.pathname + u.search;
              } catch {
                return page.requestedUrl;
              }
            })();
            return (
              <li key={page.requestedUrl}>
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) => setExpanded(open ? page.requestedUrl : null)}
                >
                  <CollapsibleTrigger className="group flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/40">
                    <div className={`shrink-0 text-xl font-bold tabular-nums ${letterColor(grade.letter)}`}>
                      {grade.letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {page.onPage.title || path}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{path}</p>
                    </div>
                    <div className="hidden items-center gap-3 text-xs sm:flex">
                      <span className="tabular-nums text-muted-foreground">
                        {grade.score}/100
                      </span>
                      {grade.topIssues.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {grade.topIssues.length} issue{grade.topIssues.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border bg-muted/30 px-5 py-4">
                      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Title:{" "}
                          <span className="text-foreground">
                            {page.onPage.title ? `${page.onPage.titleLength} chars` : "missing"}
                          </span>
                        </span>
                        <span>
                          Meta:{" "}
                          <span className="text-foreground">
                            {page.onPage.metaDescription
                              ? `${page.onPage.metaDescriptionLength} chars`
                              : "missing"}
                          </span>
                        </span>
                        <span>
                          H1s: <span className="text-foreground">{page.onPage.h1Count}</span>
                        </span>
                        <span>
                          Schema: <span className="text-foreground">{page.schema.length}</span>
                        </span>
                        <span>
                          Images missing alt:{" "}
                          <span className="text-foreground">
                            {page.onPage.images.missingAlt}/{page.onPage.images.total}
                          </span>
                        </span>
                      </div>
                      {grade.topIssues.length > 0 ? (
                        <ul className="space-y-2">
                          {grade.topIssues.slice(0, 6).map((issue, i) => {
                            const sev = SEV_STYLES[issue.severity];
                            const Icon = sev.icon;
                            return (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${sev.className}`} />
                                <div>
                                  <p className="font-medium text-foreground">{issue.title}</p>
                                  <p className="text-xs text-muted-foreground">{issue.fix}</p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No issues detected.</p>
                      )}
                      <div className="mt-3">
                        <a
                          href={page.requestedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Open page <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Scan more pages */}
      {onReportUpdate && (
        <ScanMorePages report={report} onReportUpdate={onReportUpdate} />
      )}
    </div>
  );
}
function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname + u.search) || "/";
  } catch {
    return url;
  }
}

const MAX_SELECTABLE = 50;

function ScanMorePages({
  report,
  onReportUpdate,
}: {
  report: SiteAuditReport;
  onReportUpdate: (next: SiteAuditReport) => void;
}) {
  const scannedSet = useMemo(
    () => new Set(report.pages.map((p) => p.requestedUrl)),
    [report.pages],
  );
  const unscanned = useMemo(
    () => (report.discoveredUrls ?? []).filter((u) => !scannedSet.has(u)),
    [report.discoveredUrls, scannedSet],
  );

  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return unscanned;
    return unscanned.filter((u) => u.toLowerCase().includes(q));
  }, [unscanned, filter]);

  if (unscanned.length === 0) return null;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u));
  const overLimit = selected.size > MAX_SELECTABLE;

  function toggleOne(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of filtered) {
        if (next.size >= MAX_SELECTABLE) break;
        next.add(u);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function runScan() {
    if (selected.size === 0 || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const urls = [...selected].slice(0, MAX_SELECTABLE);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/seo-scan-urls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Scan failed");
      }
      const newPages = (data?.pages ?? []) as SiteAuditReport["pages"];
      // Merge: replace any duplicates by URL, append the rest
      const existingByUrl = new Map(report.pages.map((p) => [p.requestedUrl, p]));
      for (const p of newPages) existingByUrl.set(p.requestedUrl, p);
      const mergedPages = [...existingByUrl.values()];
      onReportUpdate({
        ...report,
        pages: mergedPages,
        pagesScanned: mergedPages.length,
        fetchedAt: new Date().toISOString(),
      });
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Scan more pages ({unscanned.length} remaining)
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pick from pages discovered during the initial scan. Up to {MAX_SELECTABLE} at a time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs tabular-nums ${
              overLimit ? "font-semibold text-destructive" : "text-muted-foreground"
            }`}
          >
            {selected.size} / {MAX_SELECTABLE} selected
          </span>
          <Button
            size="sm"
            onClick={runScan}
            disabled={selected.size === 0 || overLimit || scanning}
          >
            {scanning ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Scanning…
              </>
            ) : (
              <>
                <Search className="mr-1.5 h-3.5 w-3.5" /> Scan selected
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by path (e.g. /blog)"
          className="h-8 max-w-xs text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={selectAllFiltered}
          disabled={filtered.length === 0 || allFilteredSelected || selected.size >= MAX_SELECTABLE}
        >
          Select {filter ? "filtered" : "all"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={clearSelection}
          disabled={selected.size === 0}
        >
          Clear
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <li className="p-3 text-center text-xs text-muted-foreground">
            No URLs match this filter.
          </li>
        ) : (
          filtered.slice(0, 200).map((url) => {
            const isChecked = selected.has(url);
            const path = shortenUrl(url);
            return (
              <li key={url}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/40">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleOne(url)}
                    disabled={!isChecked && selected.size >= MAX_SELECTABLE}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{path}</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    aria-label="Open page"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </label>
              </li>
            );
          })
        )}
        {filtered.length > 200 && (
          <li className="p-2 text-center text-xs text-muted-foreground">
            Showing first 200 of {filtered.length}. Use the filter to narrow down.
          </li>
        )}
      </ul>
    </div>
  );
}
