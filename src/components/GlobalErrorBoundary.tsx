import { Component, type ReactNode } from "react";
import { AlertCircle, Copy, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanErrorDrawer } from "@/components/ScanErrorDrawer";
import { toast } from "sonner";

interface ErrorContext {
  message: string;
  stack?: string;
  pathname: string;
  scanId: string | null;
  timestamp: string;
}

interface State {
  error: ErrorContext | null;
  drawerOpen: boolean;
}

function buildContext(error: Error): ErrorContext {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  // Routes like /scan/<uuid> — capture the id so the user can reference it.
  const scanMatch = pathname.match(/\/scan\/([^/?#]+)/);
  return {
    message: error.message || String(error),
    stack: error.stack,
    pathname,
    scanId: scanMatch?.[1] ?? null,
    timestamp: new Date().toISOString(),
  };
}

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, drawerOpen: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error: buildContext(error) } as State;
  }

  componentDidCatch(error: Error) {
    console.error("[GlobalErrorBoundary] Captured render error:", error);
  }

  componentDidMount() {
    if (typeof window === "undefined") return;
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    if (typeof window === "undefined") return;
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  handleWindowError = (event: ErrorEvent) => {
    if (!event.error) return;
    this.setState({ error: buildContext(event.error) });
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    this.setState({ error: buildContext(reason) });
  };

  dismiss = () => this.setState({ error: null, drawerOpen: false });

  openDrawer = () => this.setState({ drawerOpen: true });
  setDrawerOpen = (open: boolean) => this.setState({ drawerOpen: open });

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  copyDetails = async () => {
    const { error } = this.state;
    if (!error) return;
    const payload = [
      `Error: ${error.message}`,
      `Route: ${error.pathname}`,
      error.scanId ? `Scan ID: ${error.scanId}` : null,
      `Time: ${error.timestamp}`,
      error.stack ? `\nStack:\n${error.stack}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Error details copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  render() {
    const { error, drawerOpen } = this.state;
    return (
      <>
        {error && (
          <div
            role="alert"
            className="fixed inset-x-0 top-0 z-[100] border-b border-destructive/40 bg-destructive/95 text-destructive-foreground shadow-lg backdrop-blur"
          >
            <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3 sm:px-6">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Something went wrong</p>
                <p className="mt-0.5 break-words text-xs opacity-90">{error.message}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] opacity-90">
                  <span>
                    Route: <code className="font-mono">{error.pathname || "/"}</code>
                  </span>
                  {error.scanId && (
                    <span>
                      Scan ID: <code className="font-mono">{error.scanId}</code>
                    </span>
                  )}
                  <span>{new Date(error.timestamp).toLocaleTimeString()}</span>
                  <button
                    type="button"
                    onClick={this.openDrawer}
                    className="font-medium underline underline-offset-2 hover:opacity-100"
                  >
                    View scan error details
                  </button>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={this.copyDetails}
                  className="h-7 gap-1 px-2 text-xs text-destructive-foreground hover:bg-destructive-foreground/15"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={this.reload}
                  className="h-7 gap-1 px-2 text-xs text-destructive-foreground hover:bg-destructive-foreground/15"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reload
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={this.dismiss}
                  aria-label="Dismiss"
                  className="h-7 w-7 text-destructive-foreground hover:bg-destructive-foreground/15"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {error && (
          <ScanErrorDrawer
            open={drawerOpen}
            onOpenChange={this.setDrawerOpen}
            scanId={error.scanId}
            errorMessage={error.message}
            pathname={error.pathname}
            timestamp={error.timestamp}
          />
        )}
        {this.props.children}
      </>
    );
  }
}
