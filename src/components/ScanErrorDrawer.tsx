import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import {
  getScanStatus,
  linkRetryScan,
  startScan,
  type SavedScanSummary,
} from "@/lib/scans";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanId: string | null;
  errorMessage: string;
  pathname: string;
  timestamp: string;
}

export function ScanErrorDrawer({
  open,
  onOpenChange,
  scanId,
  errorMessage,
  pathname,
  timestamp,
}: Props) {
  const [activeScanId, setActiveScanId] = useState<string | null>(scanId);
  const [scan, setScan] = useState<SavedScanSummary | null>(null);
  const [chain, setChain] = useState<SavedScanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset to the original scanId whenever the drawer opens with a new error.
  useEffect(() => {
    if (open) setActiveScanId(scanId);
  }, [open, scanId]);

  // Load + poll. Always walks from the ORIGINAL scanId so the timeline shows
  // every hop, then tracks the latest as the "active" scan.
  useEffect(() => {
    if (!open || !scanId) {
      setScan(null);
      setChain([]);
      setNotFound(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadChain = async (): Promise<SavedScanSummary[]> => {
      const seen = new Set<string>();
      const acc: SavedScanSummary[] = [];
      let nextId: string | null = scanId;
      while (nextId && !seen.has(nextId)) {
        seen.add(nextId);
        const s: SavedScanSummary | null = await getScanStatus(nextId);
        if (!s) break;
        acc.push(s);
        nextId = s.retryScanId;
      }
      return acc;
    };

    const tick = async (initial: boolean) => {
      if (initial) setLoading(true);
      const hops = await loadChain();
      if (cancelled) return;
      if (hops.length === 0) {
        setNotFound(true);
        setScan(null);
        setChain([]);
      } else {
        setNotFound(false);
        setChain(hops);
        const latest = hops[hops.length - 1];
        setScan(latest);
        if (latest.id !== activeScanId) setActiveScanId(latest.id);
      }
      if (initial) setLoading(false);
      const latest = hops[hops.length - 1];
      if (latest && (latest.status === "pending" || latest.status === "running")) {
        timer = setTimeout(() => tick(false), 2000);
      }
    };

    void tick(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // activeScanId intentionally excluded — chain walk is anchored at scanId.
  }, [open, scanId, refreshKey]);

  const handleRetry = async () => {
    if (!scan) {
      toast.error("No saved scan to retry.");
      return;
    }
    setRetrying(true);
    const result = await startScan({ rootUrl: scan.rootUrl, scope: scan.scope });
    if ("error" in result) {
      setRetrying(false);
      toast.error(result.error);
      return;
    }
    // Persist the retry link on the failing scan so a refresh restores the chain.
    await linkRetryScan(scan.id, result.scanId);
    setRetrying(false);
    toast.success("Scan re-queued");
    setActiveScanId(result.scanId);
    setRefreshKey((k) => k + 1);
  };

  const payload = {
    scanId: activeScanId,
    originalScanId: scanId,
    pathname,
    errorMessage,
    timestamp,
  };

  const canRetry = !!scan && !retrying && scan.status !== "running" && scan.status !== "pending";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Scan error details</SheetTitle>
          <SheetDescription>
            Saved status of the affected scan and the request payload captured at error time.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saved scan status
              </h3>
              {scan && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={!canRetry}
                  className="h-7 gap-1.5 px-2 text-xs"
                >
                  {retrying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                  Retry scan
                </Button>
              )}
            </div>
            {!activeScanId ? (
              <p className="text-muted-foreground">
                No scan ID was associated with this error.
              </p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading scan…
              </div>
            ) : notFound ? (
              <p className="text-muted-foreground">
                No saved scan found for ID <code className="font-mono">{activeScanId}</code>.
              </p>
            ) : scan ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                <dt className="text-muted-foreground">Scan ID</dt>
                <dd className="break-all font-mono text-xs">{scan.id}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-mono">{scan.status}</dd>
                <dt className="text-muted-foreground">Phase</dt>
                <dd className="font-mono">{scan.phase ?? "—"}</dd>
                <dt className="text-muted-foreground">Root URL</dt>
                <dd className="break-all font-mono text-xs">{scan.rootUrl}</dd>
                <dt className="text-muted-foreground">Scope</dt>
                <dd className="font-mono">{scan.scope}</dd>
                <dt className="text-muted-foreground">Pages</dt>
                <dd className="font-mono">
                  {scan.pagesScanned} / {scan.pagesTotal}
                </dd>
                <dt className="text-muted-foreground">Discovered</dt>
                <dd className="font-mono">{scan.discoveredUrlCount}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-mono text-xs">{new Date(scan.createdAt).toLocaleString()}</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="font-mono text-xs">{new Date(scan.updatedAt).toLocaleString()}</dd>
                {scan.errorMessage && (
                  <>
                    <dt className="text-muted-foreground">Error</dt>
                    <dd className="break-words text-destructive">{scan.errorMessage}</dd>
                  </>
                )}
              </dl>
            ) : null}
            {activeScanId && activeScanId !== scanId && (
              <p className="mt-3 text-xs text-muted-foreground">
                Now tracking retry scan. Original scan ID:{" "}
                <code className="font-mono">{scanId}</code>
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Request payload
            </h3>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

