import { useMemo, useState } from "react";
import { ExternalLink, ChevronDown, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GradeCard } from "./GradeCard";
import { computeSiteGrade, type IssueSeverity, type RollupIssue } from "@/lib/seo-grade";
import type { SiteAuditReport } from "@/lib/seo-types";

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

      {/* Site-wide issue rollup */}
      {site.issueRollup.length > 0 && (
        <SiteIssueRollup issues={site.issueRollup} />
      )}

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
    </div>
  );
}

type SeverityFilter = "all" | IssueSeverity;

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname + u.search) || "/";
  } catch {
    return url;
  }
}

function SiteIssueRollup({ issues }: { issues: RollupIssue[] }) {
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<IssueSeverity, number> = { critical: 0, warning: 0, info: 0 };
    for (const i of issues) c[i.severity] += 1;
    return c;
  }, [issues]);

  const filtered = useMemo(
    () => (filter === "all" ? issues : issues.filter((i) => i.severity === filter)),
    [issues, filter],
  );

  // Group filtered issues by severity for sectioned display
  const grouped = useMemo(() => {
    const g: Record<IssueSeverity, RollupIssue[]> = { critical: [], warning: [], info: [] };
    for (const i of filtered) g[i.severity].push(i);
    return g;
  }, [filtered]);

  const sevOrder: IssueSeverity[] = ["critical", "warning", "info"];

  const filterPills: Array<{ key: SeverityFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: issues.length },
    { key: "critical", label: "Critical", count: counts.critical },
    { key: "warning", label: "Warnings", count: counts.warning },
    { key: "info", label: "Info", count: counts.info },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Issues across the site</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Same issues grouped — fix once, improve every affected page.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterPills.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setFilter(p.key)}
              disabled={p.count === 0 && p.key !== "all"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === p.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              }`}
            >
              {p.label}
              <span
                className={`tabular-nums ${
                  filter === p.key ? "text-background/70" : "text-muted-foreground/70"
                }`}
              >
                {p.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No issues in this category.
        </p>
      ) : (
        <div className="space-y-5">
          {sevOrder.map((sev) => {
            const list = grouped[sev];
            if (list.length === 0) return null;
            const sevMeta = SEV_STYLES[sev];
            return (
              <div key={sev}>
                <div className="mb-2 flex items-center gap-2">
                  <sevMeta.icon className={`h-4 w-4 ${sevMeta.className}`} />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {sevMeta.label}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    ({list.length} issue{list.length === 1 ? "" : "s"})
                  </span>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {list.map((issue) => {
                    const key = `${sev}:${issue.title}`;
                    const isOpen = openKey === key;
                    return (
                      <li key={key}>
                        <Collapsible
                          open={isOpen}
                          onOpenChange={(o) => setOpenKey(o ? key : null)}
                        >
                          <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {issue.title}
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                              {issue.pageCount} {issue.pageCount === 1 ? "page" : "pages"}
                            </Badge>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-border bg-muted/30 px-3 py-3">
                              <p className="mb-3 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">How to fix:</span>{" "}
                                {issue.fix}
                              </p>
                              <p className="mb-1.5 text-xs font-medium text-foreground">
                                Affected pages
                              </p>
                              <ul className="space-y-1">
                                {issue.pages.slice(0, 20).map((url) => (
                                  <li key={url}>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <span className="truncate">{shortenUrl(url)}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                  </li>
                                ))}
                                {issue.pages.length > 20 && (
                                  <li className="text-xs text-muted-foreground">
                                    + {issue.pages.length - 20} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
