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

export function SiteResults({ report }: { report: SiteAuditReport }) {
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
