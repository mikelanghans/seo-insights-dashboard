import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Briefcase, Loader2, Plus, Sparkles } from "lucide-react";
import { listClients, setClientSubscribed, type Client } from "@/lib/clients";
import { listLatestScanPerClient, type ClientLatestScanSummary } from "@/lib/scans";
import { ClientSelector } from "@/components/ClientSelector";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — SEOAudit" },
      { name: "description", content: "All your agency clients and their latest scan grades." },
    ],
  }),
  component: ClientsPage,
});

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

function gradeColorClass(letter: string): string {
  if (letter.startsWith("A")) return "bg-success/15 text-success border-success/30";
  if (letter === "B") return "bg-primary/15 text-primary border-primary/30";
  if (letter === "C") return "bg-warning/15 text-warning-foreground border-warning/40";
  return "bg-destructive/15 text-destructive border-destructive/40";
}

function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled: !!user,
  });
  const latestQuery = useQuery({
    queryKey: ["clients", "latest-scans"],
    queryFn: listLatestScanPerClient,
    enabled: !!user,
  });

  const clients: Client[] | null = clientsQuery.data ?? null;
  const latest: Record<string, ClientLatestScanSummary> = latestQuery.data ?? {};

  if (!authLoading && !user) return <Navigate to="/auth" />;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground">
              All your clients, their last scan and overall grade.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ClientSelector value={null} onChange={refresh} />
            <Link to="/">
              <Button>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New scan
              </Button>
            </Link>
          </div>
        </div>

        {clients === null ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading clients…
          </div>
        ) : clients.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {clients.map((c) => {
              const scan = latest[c.id];
              const grade =
                scan && scan.gradeLetter && scan.gradeScore !== null
                  ? { letter: scan.gradeLetter, score: scan.gradeScore }
                  : null;
              return (
                <li key={c.id}>
                  <div className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:border-primary/50 hover:shadow-md">
                    <Link
                      to="/clients/$id"
                      params={{ id: c.id }}
                      className="flex flex-1 items-center gap-4 min-w-0"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-semibold text-foreground group-hover:text-primary">
                            {c.name}
                          </p>
                          {c.isSubscribed && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              <Sparkles className="h-2.5 w-2.5" /> Pro
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {scan
                            ? `Last scan ${timeAgo(scan.createdAt)} · ${scan.rootUrl.replace(/^https?:\/\//, "")}`
                            : "No scans yet"}
                        </p>
                      </div>
                      {grade ? (
                        <div
                          className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${gradeColorClass(grade.letter)}`}
                        >
                          <span className="text-base font-bold leading-none">{grade.letter}</span>
                          <span className="text-[10px] font-medium leading-none opacity-70">
                            {grade.score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                    </Link>
                    <div
                      className="flex shrink-0 flex-col items-center gap-1 border-l border-border pl-4"
                      title="Subscribed clients can be included in scheduled batch scans"
                    >
                      <Switch
                        checked={c.isSubscribed}
                        onCheckedChange={async (v) => {
                          // optimistic update of the cached clients list
                          const prev = queryClient.getQueryData<Client[]>(["clients"]);
                          queryClient.setQueryData<Client[]>(["clients"], (curr) =>
                            curr
                              ? curr.map((x) =>
                                  x.id === c.id ? { ...x, isSubscribed: v } : x,
                                )
                              : curr,
                          );
                          const ok = await setClientSubscribed(c.id, v);
                          if (!ok) {
                            toast.error("Could not update subscription.");
                            queryClient.setQueryData<Client[]>(["clients"], prev);
                          } else {
                            toast.success(
                              v ? `${c.name} marked as subscribed` : `${c.name} subscription removed`,
                            );
                          }
                        }}
                        aria-label={`Toggle subscription for ${c.name}`}
                      />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Subscribed
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Briefcase className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-base font-semibold text-foreground">No clients yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a client and run your first scan to start tracking their SEO.
      </p>
      <div className="mt-4">
        <Link to="/">
          <Button>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Run a scan
          </Button>
        </Link>
      </div>
    </div>
  );
}
