import type { A11yImpact, A11yIssue, A11yReport } from "@/lib/a11y-audit";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Eye, ShieldAlert } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const IMPACT_META: Record<
  A11yImpact,
  { label: string; icon: typeof AlertCircle; text: string; bg: string; border: string; chip: string }
> = {
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    text: "text-destructive",
    bg: "bg-destructive/5",
    border: "border-destructive/30",
    chip: "bg-destructive/15",
  },
  serious: {
    label: "Serious",
    icon: AlertCircle,
    text: "text-destructive",
    bg: "bg-destructive/5",
    border: "border-destructive/25",
    chip: "bg-destructive/10",
  },
  moderate: {
    label: "Moderate",
    icon: AlertTriangle,
    text: "text-warning",
    bg: "bg-warning/5",
    border: "border-warning/30",
    chip: "bg-warning/15",
  },
  minor: {
    label: "Minor",
    icon: Info,
    text: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/25",
    chip: "bg-primary/15",
  },
};

function toneFor(score: number) {
  if (score >= 85) return { text: "text-success", bg: "bg-success" };
  if (score >= 70) return { text: "text-primary", bg: "bg-primary" };
  if (score >= 50) return { text: "text-warning", bg: "bg-warning" };
  return { text: "text-destructive", bg: "bg-destructive" };
}

function IssueRow({ issue }: { issue: A11yIssue }) {
  const meta = IMPACT_META[issue.impact];
  const Icon = meta.icon;
  return (
    <Collapsible className={`rounded-lg border ${meta.border} ${meta.bg}`}>
      <CollapsibleTrigger className="group flex w-full items-start gap-3 p-4 text-left">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.chip}`}>
          <Icon className={`h-4 w-4 ${meta.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.chip} ${meta.text}`}
            >
              {meta.label}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{issue.title}</h4>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {issue.count} instance{issue.count === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{issue.description}</p>
          <p className="mt-2 text-sm text-foreground">
            <span className="font-semibold">How to fix: </span>
            <span className="text-muted-foreground">{issue.fix}</span>
          </p>
          {issue.wcag && (
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              WCAG {issue.wcag}
            </p>
          )}
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/50 bg-background/40 px-4 py-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Examples on this page
          </p>
          <ul className="space-y-1.5">
            {issue.examples.map((ex, i) => (
              <li
                key={i}
                className="rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-foreground/80 break-all"
              >
                {ex}
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AccessibilityTab({ report }: { report?: A11yReport }) {
  if (!report) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        Accessibility scan unavailable — the page HTML couldn't be loaded.
      </div>
    );
  }

  const tone = toneFor(report.score);
  const circumference = 2 * Math.PI * 46;
  const dash = (report.score / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="46" fill="none" className="stroke-muted" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                className={`${tone.text} transition-all duration-700`}
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold tabular-nums ${tone.text}`}>{report.score}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                / 100
              </span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accessibility (WCAG 2.1 A/AA)
              </span>
            </div>
            <p className="mt-2 text-base font-semibold text-foreground sm:text-lg">
              {report.totalIssues === 0
                ? "No common accessibility issues detected."
                : `${report.totalIssues} issue type${report.totalIssues === 1 ? "" : "s"} across ${report.totalInstances} element${report.totalInstances === 1 ? "" : "s"}.`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["critical", "serious", "moderate", "minor"] as A11yImpact[]).map((k) => {
                const meta = IMPACT_META[k];
                const n = report.counts[k];
                return (
                  <div
                    key={k}
                    className={`rounded-lg border ${meta.border} ${meta.bg} px-3 py-2 text-center`}
                  >
                    <div className={`text-lg font-bold tabular-nums ${meta.text}`}>{n}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Issues */}
      {report.issues.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-semibold text-foreground">Clean static-HTML scan</p>
            <p className="text-xs text-muted-foreground">
              No common WCAG issues detected. Verify color contrast and dynamic states with browser tools.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Issues to fix
          </h3>
          {report.issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {/* Limitations */}
      {report.limitations.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            What this scan can't check
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {report.limitations.map((l, i) => (
              <li key={i}>· {l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
