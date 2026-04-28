import type { PageSpeedReport } from "@/lib/seo-types";
import { ScoreRing } from "./ScoreRing";
import { Smartphone, Monitor, AlertCircle } from "lucide-react";

function MetricRow({ label, value, score }: { label: string; value: string; score: number | null }) {
  const color =
    score === null
      ? "text-muted-foreground"
      : score >= 0.9
        ? "text-success"
        : score >= 0.5
          ? "text-warning"
          : "text-destructive";
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function StrategyCard({ data, icon: Icon, title }: { data: PageSpeedReport; icon: typeof Smartphone; title: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>

      {data.error ? (
        <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">PageSpeed unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-4 gap-2">
            <ScoreRing score={data.performanceScore} label="Perf" size={80} />
            <ScoreRing score={data.seoScore} label="SEO" size={80} />
            <ScoreRing score={data.accessibilityScore} label="A11y" size={80} />
            <ScoreRing score={data.bestPracticesScore} label="Best" size={80} />
          </div>
          <div className="rounded-lg bg-muted/50 px-4">
            <h4 className="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Core Web Vitals
            </h4>
            {data.metrics.lcp && <MetricRow label="Largest Contentful Paint" value={data.metrics.lcp.value} score={data.metrics.lcp.score} />}
            {data.metrics.cls && <MetricRow label="Cumulative Layout Shift" value={data.metrics.cls.value} score={data.metrics.cls.score} />}
            {data.metrics.fcp && <MetricRow label="First Contentful Paint" value={data.metrics.fcp.value} score={data.metrics.fcp.score} />}
            {data.metrics.inp && <MetricRow label="Time to Interactive" value={data.metrics.inp.value} score={data.metrics.inp.score} />}
            {data.metrics.ttfb && <MetricRow label="Server Response Time" value={data.metrics.ttfb.value} score={data.metrics.ttfb.score} />}
          </div>
        </>
      )}
    </div>
  );
}

export function PageSpeedTab({ mobile, desktop }: { mobile: PageSpeedReport; desktop: PageSpeedReport }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <StrategyCard data={mobile} icon={Smartphone} title="Mobile" />
      <StrategyCard data={desktop} icon={Monitor} title="Desktop" />
    </div>
  );
}
