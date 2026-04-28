import type { Issue, IssueSeverity, OverallGrade } from "@/lib/seo-grade";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

function toneFor(score: number) {
  if (score >= 85) return { text: "text-success", bg: "bg-success", ring: "ring-success/30", soft: "bg-success/10" };
  if (score >= 70) return { text: "text-primary", bg: "bg-primary", ring: "ring-primary/30", soft: "bg-primary/10" };
  if (score >= 50) return { text: "text-warning", bg: "bg-warning", ring: "ring-warning/30", soft: "bg-warning/10" };
  return { text: "text-destructive", bg: "bg-destructive", ring: "ring-destructive/30", soft: "bg-destructive/10" };
}

const SEVERITY_META: Record<
  IssueSeverity,
  { label: string; icon: typeof AlertCircle; text: string; bg: string; border: string; chipBg: string }
> = {
  critical: {
    label: "Critical",
    icon: AlertCircle,
    text: "text-destructive",
    bg: "bg-destructive/5",
    border: "border-destructive/30",
    chipBg: "bg-destructive/15",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    text: "text-warning",
    bg: "bg-warning/5",
    border: "border-warning/30",
    chipBg: "bg-warning/15",
  },
  info: {
    label: "Suggestion",
    icon: Info,
    text: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/25",
    chipBg: "bg-primary/15",
  },
};

function IssueRow({ issue }: { issue: Issue }) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.chipBg}`}>
          <Icon className={`h-4 w-4 ${meta.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.chipBg} ${meta.text}`}
            >
              {meta.label}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{issue.title}</h4>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{issue.description}</p>
          <p className="mt-2 text-sm text-foreground">
            <span className="font-semibold">How to fix: </span>
            <span className="text-muted-foreground">{issue.fix}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function GradeCard({ grade, hideIssuesSection = false }: { grade: OverallGrade; hideIssuesSection?: boolean }) {
  const tone = toneFor(grade.score);
  const circumference = 2 * Math.PI * 46;
  const dash = (grade.score / 100) * circumference;

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        {/* Circular score */}
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
            <span className={`text-4xl font-bold tabular-nums ${tone.text}`}>{grade.score}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">/ 100</span>
          </div>
        </div>

        {/* Letter grade + summary */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SEO + AEO Grade
            </span>
            <span
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-xl font-bold ${tone.soft} ${tone.text} ring-1 ${tone.ring}`}
            >
              {grade.letter}
            </span>
          </div>
          <p className="mt-2 text-base font-semibold text-foreground sm:text-lg">{grade.summary}</p>

          {/* Breakdown bars */}
          <div className="mt-5 space-y-3">
            {grade.breakdown.map((b) => {
              const bt = toneFor(b.score);
              return (
                <div key={b.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-semibold text-foreground">
                      {b.label}
                      <span className="ml-2 font-normal text-muted-foreground">{b.detail}</span>
                    </span>
                    <span className={`font-semibold tabular-nums ${bt.text}`}>{b.score}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${bt.bg} transition-all duration-700`}
                      style={{ width: `${b.score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Issues breakdown */}
      {!hideIssuesSection && (
        <div className="border-t border-border pt-6">
          {grade.topIssues.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-semibold text-foreground">No issues detected</p>
                <p className="text-xs text-muted-foreground">
                  This page meets the audited SEO and AEO best practices.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Issues to fix
                </h3>
                <span className="text-xs text-muted-foreground">
                  {grade.topIssues.length} item{grade.topIssues.length === 1 ? "" : "s"} · sorted by severity
                </span>
              </div>
              <div className="space-y-2.5">
                {grade.topIssues.map((issue, i) => (
                  <IssueRow key={`${issue.title}-${i}`} issue={issue} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
