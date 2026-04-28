import type { OverallGrade } from "@/lib/seo-grade";

function toneFor(score: number) {
  if (score >= 85) return { text: "text-success", bg: "bg-success", ring: "ring-success/30", soft: "bg-success/10" };
  if (score >= 70) return { text: "text-primary", bg: "bg-primary", ring: "ring-primary/30", soft: "bg-primary/10" };
  if (score >= 50) return { text: "text-warning", bg: "bg-warning", ring: "ring-warning/30", soft: "bg-warning/10" };
  return { text: "text-destructive", bg: "bg-destructive", ring: "ring-destructive/30", soft: "bg-destructive/10" };
}

export function GradeCard({ grade }: { grade: OverallGrade }) {
  const tone = toneFor(grade.score);
  const circumference = 2 * Math.PI * 46;
  const dash = (grade.score / 100) * circumference;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
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
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO Grade</span>
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
    </div>
  );
}
