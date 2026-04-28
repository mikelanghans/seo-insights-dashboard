import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { getScanStatus, type SavedScanSummary } from "@/lib/scans";

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
  const [scan, setScan] = useState<SavedScanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open || !scanId) {
      setScan(null);
      setNotFound(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getScanStatus(scanId)
      .then((s) => {
        if (cancelled) return;
        if (!s) setNotFound(true);
        else setScan(s);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, scanId]);

  const payload = {
    scanId,
    pathname,
    errorMessage,
    timestamp,
  };

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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Saved scan status
            </h3>
            {!scanId ? (
              <p className="text-muted-foreground">
                No scan ID was associated with this error.
              </p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading scan…
              </div>
            ) : notFound ? (
              <p className="text-muted-foreground">
                No saved scan found for ID <code className="font-mono">{scanId}</code>.
              </p>
            ) : scan ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
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
