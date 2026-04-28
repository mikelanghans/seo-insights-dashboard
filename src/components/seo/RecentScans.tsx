import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Trash2, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listRecentScans, deleteScan, type SavedScanSummary } from "@/lib/scans";
import { toast } from "sonner";

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

export function RecentScans({ refreshKey }: { refreshKey?: number }) {
  const [scans, setScans] = useState<SavedScanSummary[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listRecentScans(10).then((data) => {
      if (active) setScans(data);
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function handleDelete(id: string) {
    setDeleting(id);
    const ok = await deleteScan(id);
    if (ok) {
      setScans((prev) => prev?.filter((s) => s.id !== id) ?? null);
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
        {scans.map((scan) => (
          <li key={scan.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Link
                to="/scan/$id"
                params={{ id: scan.id }}
                className="block truncate text-sm font-medium text-foreground hover:text-primary"
              >
                {shortUrl(scan.rootUrl)}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {scan.pagesScanned} of {scan.discoveredUrlCount} pages · {scan.scope} · {timeAgo(scan.createdAt)}
              </p>
            </div>
            <Link
              to="/scan/$id"
              params={{ id: scan.id }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open <ExternalLink className="h-3 w-3" />
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
        ))}
      </ul>
    </section>
  );
}
