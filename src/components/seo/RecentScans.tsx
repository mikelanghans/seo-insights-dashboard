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

export function RecentScans({ refreshKey }: { refreshKey?: number }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: scans = null, refetch } = useQuery({
    queryKey: ["recent-scans"],
    queryFn: () => listRecentScans(10),
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
      queryClient.setQueryData<SavedScanSummary[]>(["recent-scans"], (prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev,
      );
      toast.success("Scan deleted");
    } else {
      toast.error("Failed to delete scan");
    }
    setDeleting(null);
  }

  if (scans === null) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading saved scans…
      </div>
    );
  }

  if (scans.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Recent scans</h2>
        <span className="text-xs text-muted-foreground">({scans.length})</span>
      </div>
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
