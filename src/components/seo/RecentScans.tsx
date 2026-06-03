import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, ExternalLink, Clock, CheckCircle2, AlertCircle, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { listRecentScans, deleteScan, type SavedScanSummary } from "@/lib/scans";
import { toast } from "sonner";

type DateRange = "all" | "today" | "7d" | "30d" | "90d" | "custom";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function shortUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function phaseLabel(phase: SavedScanSummary["phase"]): string {
  switch (phase) {
    case "mapping":
      return "Mapping site…";
    case "scanning":
      return "Scanning pages…";
    case "grading":
      return "Grading results…";
    case "complete":
      return "Finishing up…";
    default:
      return "Starting…";
  }
}

function gradeColorClass(letter: string): string {
  if (letter.startsWith("A")) return "bg-success/15 text-success border-success/30";
  if (letter === "B") return "bg-primary/15 text-primary border-primary/30";
  if (letter === "C") return "bg-warning/15 text-warning-foreground border-warning/40";
  return "bg-destructive/15 text-destructive border-destructive/40";
}

export function RecentScans({ refreshKey }: { refreshKey?: number }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  const { since, until } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === "today") return { since: startOfToday.toISOString(), until: null as string | null };
    if (range === "7d") return { since: new Date(now.getTime() - 7 * 86400000).toISOString(), until: null };
    if (range === "30d") return { since: new Date(now.getTime() - 30 * 86400000).toISOString(), until: null };
    if (range === "90d") return { since: new Date(now.getTime() - 90 * 86400000).toISOString(), until: null };
    if (range === "custom" && customDate) {
      const start = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate());
      const end = new Date(start.getTime() + 86400000);
      return { since: start.toISOString(), until: end.toISOString() };
    }
    return { since: null as string | null, until: null as string | null };
  }, [range, customDate]);

  const isFiltered = range !== "all" && (range !== "custom" || !!customDate);
  const limit = isFiltered ? 200 : 10;

  const { data: scans = null, refetch } = useQuery({
    queryKey: ["recent-scans", range, customDate?.toISOString() ?? null],
    queryFn: () => listRecentScans(limit, { since, until }),
    refetchInterval: (q) => {
      const data = q.state.data as SavedScanSummary[] | undefined;
      const stillRunning = data?.some((s) => s.status === "pending" || s.status === "running");
      return stillRunning ? 2500 : false;
    },
  });

  // Refetch on demand when the parent bumps refreshKey (e.g. after a new scan starts).
  useEffect(() => {
    if (refreshKey !== undefined) void refetch();
  }, [refreshKey, refetch]);

  async function handleDelete(id: string) {
    setDeleting(id);
    const ok = await deleteScan(id);
    if (ok) {
      queryClient.setQueriesData<SavedScanSummary[]>({ queryKey: ["recent-scans"] }, (prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev,
      );
      toast.success("Scan deleted");
    } else {
      toast.error("Failed to delete scan");
    }
    setDeleting(null);
  }

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
          <SelectItem value="custom">Specific date…</SelectItem>
        </SelectContent>
      </Select>
      {range === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 text-xs font-normal", !customDate && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {customDate ? format(customDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={setCustomDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => {
            setRange("all");
            setCustomDate(undefined);
          }}
        >
          <X className="mr-1 h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );

  if (scans === null) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading saved scans…
      </div>
    );
  }

  if (scans.length === 0 && !isFiltered) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Recent scans</h2>
          <span className="text-xs text-muted-foreground">({scans.length})</span>
        </div>
        {filterBar}
      </div>
      {scans.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No scans match the selected date.
        </p>
      )}
      <ul className="divide-y divide-border">
        {scans.map((scan) => {
          const isRunning = scan.status === "pending" || scan.status === "running";
          const isFailed = scan.status === "failed";
          const isPage = scan.kind === "page";
          const progressPct =
            scan.pagesTotal > 0
              ? Math.round((scan.pagesScanned / scan.pagesTotal) * 100)
              : 0;
          const toRoute = isPage ? "/page/$id" : "/scan/$id";
          return (
            <li key={scan.id} className="flex items-center gap-3 py-2.5">
              <div className="mt-0.5 shrink-0">
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : isFailed ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to={toRoute}
                  params={{ id: scan.id }}
                  className="block truncate text-sm font-medium text-foreground hover:text-primary"
                >
                  {shortUrl(scan.rootUrl)}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isRunning ? (
                    <>
                      {phaseLabel(scan.phase)}
                      {scan.pagesTotal > 0 && (
                        <> · {scan.pagesScanned}/{scan.pagesTotal} pages ({progressPct}%)</>
                      )}
                    </>
                  ) : isFailed ? (
                    <span className="text-destructive">
                      Failed{scan.errorMessage ? ` — ${scan.errorMessage}` : ""}
                    </span>
                  ) : isPage ? (
                    <>
                      Single page · {scan.auditType === "a11y" ? "Accessibility" : "SEO"} · {timeAgo(scan.createdAt)}
                    </>
                  ) : (
                    <>
                      {scan.pagesScanned} of {scan.discoveredUrlCount} pages · {scan.scope} ·{" "}
                      {timeAgo(scan.createdAt)}
                    </>
                  )}
                </p>
              </div>
              <Link
                to={toRoute}
                params={{ id: scan.id }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {isRunning ? "View" : "Open"} <ExternalLink className="h-3 w-3" />
              </Link>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(scan.id)}
                disabled={deleting === scan.id}
                aria-label="Delete scan"
              >
                {deleting === scan.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
