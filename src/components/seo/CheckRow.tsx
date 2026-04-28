import { Check, AlertTriangle, X, Info } from "lucide-react";
import type { ReactNode } from "react";

type Status = "pass" | "warn" | "fail" | "info";

interface CheckRowProps {
  status: Status;
  label: string;
  value?: ReactNode;
  hint?: string;
}

const styles: Record<Status, { bg: string; color: string; icon: typeof Check }> = {
  pass: { bg: "bg-success/10", color: "text-success", icon: Check },
  warn: { bg: "bg-warning/15", color: "text-warning", icon: AlertTriangle },
  fail: { bg: "bg-destructive/10", color: "text-destructive", icon: X },
  info: { bg: "bg-muted", color: "text-muted-foreground", icon: Info },
};

export function CheckRow({ status, label, value, hint }: CheckRowProps) {
  const { bg, color, icon: Icon } = styles[status];
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        {value !== undefined && (
          <div className="mt-1 text-sm text-muted-foreground break-words">{value}</div>
        )}
      </div>
    </div>
  );
}
