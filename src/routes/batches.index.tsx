import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Check, Globe, Search, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarClock,
  Loader2,
  Play,
  Plus,
  Trash2,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  listBatches,
  createBatch,
  setBatchActive,
  deleteBatch,
  runBatchNow,
  describeSchedule,
  type Batch,
  type ScanKind,
  type AuditType,
  type Scope,
  type ScheduleType,
} from "@/lib/batches";
import { listClients, type Client } from "@/lib/clients";
import { listClientWebsites, type ClientWebsite } from "@/lib/client-websites";

export const Route = createFileRoute("/batches/")({
  head: () => ({
    meta: [
      { title: "Batch scans — SEOAudit" },
      {
        name: "description",
        content: "Schedule recurring SEO audits across all your client websites in one click.",
      },
    ],
  }),
  component: BatchesPage,
});

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function formatNext(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);

  const batchesQuery = useQuery({
    queryKey: ["batches"],
    queryFn: listBatches,
    enabled: !!user,
  });
  const batches: Batch[] | null = batchesQuery.data ?? null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["batches"] });
  }

  async function handleRun(b: Batch) {
    setRunningId(b.id);
    const res = await runBatchNow(b.id);
    setRunningId(null);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(`Batch "${b.name}" started`, {
      description: "Scans are running in the background.",
    });
    void refresh();
    void navigate({ to: "/history" });
  }

  async function handleToggle(b: Batch, isActive: boolean) {
    const ok = await setBatchActive(b.id, isActive);
    if (!ok) toast.error("Could not update batch.");
    else void refresh();
  }

  async function handleDelete(b: Batch) {
    const ok = await deleteBatch(b.id);
    if (!ok) toast.error("Could not delete batch.");
    else {
      toast.success("Batch deleted");
      void refresh();
    }
    setDeleteTarget(null);
  }

  if (!authLoading && !user) return <Navigate to="/auth" />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Batch scans</h1>
            <p className="text-sm text-muted-foreground">
              Group clients into a batch, run them on demand or on a schedule.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New batch
          </Button>
        </div>

        {batches === null ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : batches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CalendarClock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">No batches yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a batch to scan many client websites at once or on a schedule.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New batch
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3">
            {batches.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-foreground">{b.name}</p>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {b.scanKind === "site" ? `${b.scope} site` : "single page"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {b.auditType === "a11y" ? "Accessibility" : "SEO"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {b.targetCount ?? 0} target{(b.targetCount ?? 0) === 1 ? "" : "s"} ·{" "}
                      {describeSchedule(b)} · Next: {formatNext(b.nextRunAt)} · Last:{" "}
                      {timeAgo(b.lastRunAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={b.isActive}
                        onCheckedChange={(v) => handleToggle(b, v)}
                        aria-label="Toggle schedule"
                      />
                      <span>{b.isActive ? "Active" : "Paused"}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleRun(b)}
                      disabled={runningId === b.id || (b.targetCount ?? 0) === 0}
                    >
                      {runningId === b.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Run now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(b)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 text-xs text-muted-foreground">
          Want to see scan results from a batch?{" "}
          <Link to="/history" className="font-medium text-primary hover:underline">
            View scan history
          </Link>
        </div>
      </main>

      <CreateBatchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refresh()}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} and all its scheduled runs will be removed. Previously created
              scan reports stay in your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- Create dialog ---------------- */

interface ClientWithWebsites {
  client: Client;
  websites: ClientWebsite[];
}

function CreateBatchDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"config" | "targets">("config");
  const [name, setName] = useState("");
  const [scanKind, setScanKind] = useState<ScanKind>("site");
  const [auditType, setAuditType] = useState<AuditType>("seo");
  const [scope, setScope] = useState<Scope>("standard");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("manual");
  const [scheduleHour, setScheduleHour] = useState(9);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);

  const [clientsData, setClientsData] = useState<ClientWithWebsites[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("config");
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;
    setName(`${dateStr} - Batch Run`);
    setScanKind("site");
    setAuditType("seo");
    setScope("standard");
    setScheduleType("manual");
    setScheduleHour(9);
    setScheduleDayOfWeek(1);
    setScheduleDayOfMonth(1);
    setSelected(new Set());
    setSearch("");
    void (async () => {
      const clients = await listClients();
      const out: ClientWithWebsites[] = [];
      for (const c of clients) {
        const ws = await listClientWebsites(c.id);
        out.push({ client: c, websites: ws });
      }
      setClientsData(out);
    })();
  }, [open]);

  function toggleSelection(clientId: string, websiteId: string) {
    const key = `${clientId}::${websiteId}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleClientAll(c: ClientWithWebsites) {
    const allKeys = c.websites.map((w) => `${c.client.id}::${w.id}`);
    const allSelected = allKeys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) allKeys.forEach((k) => next.delete(k));
      else allKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === "config") {
      if (!name.trim()) {
        toast.error("Please enter a batch name.");
        return;
      }
      setStep("targets");
      return;
    }
    if (selected.size === 0) {
      toast.error("Pick at least one website.");
      return;
    }
    setSubmitting(true);
    const targets = Array.from(selected).map((k) => {
      const [clientId, clientWebsiteId] = k.split("::");
      return { clientId, clientWebsiteId };
    });
    const res = await createBatch({
      name,
      scanKind,
      auditType,
      scope,
      scheduleType,
      scheduleHour,
      scheduleDayOfWeek: scheduleType === "weekly" ? scheduleDayOfWeek : null,
      scheduleDayOfMonth: scheduleType === "monthly" ? scheduleDayOfMonth : null,
      targets,
    });
    setSubmitting(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Batch created");
    onCreated();
    onOpenChange(false);
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New batch</DialogTitle>
            <DialogDescription>
              {step === "config"
                ? "Step 1 of 2 — Name, scan settings, schedule."
                : "Step 2 of 2 — Pick the client websites this batch should scan."}
            </DialogDescription>
          </DialogHeader>

          {step === "config" ? (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="batch-name">Name</Label>
                <Input
                  id="batch-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Weekly client audits"
                  autoFocus
                  maxLength={120}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Scan type</Label>
                  <Select value={scanKind} onValueChange={(v) => setScanKind(v as ScanKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="site">Full site audit</SelectItem>
                      <SelectItem value="page">Single page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Audit</Label>
                  <Select value={auditType} onValueChange={(v) => setAuditType(v as AuditType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seo">SEO</SelectItem>
                      <SelectItem value="a11y">Accessibility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {scanKind === "site" && (
                <div className="space-y-1.5">
                  <Label>Depth</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">Quick — up to 25 pages</SelectItem>
                      <SelectItem value="standard">Standard — up to 100 pages</SelectItem>
                      <SelectItem value="deep">Deep — up to 500 pages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Schedule</Label>
                <Select
                  value={scheduleType}
                  onValueChange={(v) => setScheduleType(v as ScheduleType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual only</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scheduleType !== "manual" && (
                <div className="grid grid-cols-2 gap-3">
                  {scheduleType === "weekly" && (
                    <div className="space-y-1.5">
                      <Label>Day of week</Label>
                      <Select
                        value={String(scheduleDayOfWeek)}
                        onValueChange={(v) => setScheduleDayOfWeek(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                            <SelectItem key={d} value={String(i)}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {scheduleType === "monthly" && (
                    <div className="space-y-1.5">
                      <Label>Day of month</Label>
                      <Select
                        value={String(scheduleDayOfMonth)}
                        onValueChange={(v) => setScheduleDayOfMonth(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <SelectItem key={d} value={String(d)}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Hour (UTC)</Label>
                    <Select
                      value={String(scheduleHour)}
                      onValueChange={(v) => setScheduleHour(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {h.toString().padStart(2, "0")}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Step2Tiles
              clientsData={clientsData}
              selected={selected}
              setSelected={setSelected}
              search={search}
              setSearch={setSearch}
              isScheduled={scheduleType !== "manual"}
            />
          )}

          <DialogFooter>
            {step === "targets" && (
              <Button type="button" variant="ghost" onClick={() => setStep("config")}>
                Back
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Creating…
                </>
              ) : step === "config" ? (
                <>
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Create batch
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Step 2: visual tile picker ---------------- */

interface TileItem {
  key: string;
  clientId: string;
  websiteId: string;
  clientName: string;
  contactName: string | null;
  isSubscribed: boolean;
  label: string;
  url: string;
  isPrimary: boolean;
}

function Step2Tiles({
  clientsData,
  selected,
  setSelected,
  search,
  setSearch,
  isScheduled,
}: {
  clientsData: ClientWithWebsites[] | null;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  search: string;
  setSearch: (v: string) => void;
  isScheduled: boolean;
}) {
  const tiles: TileItem[] = useMemo(() => {
    if (!clientsData) return [];
    const out: TileItem[] = [];
    for (const c of clientsData) {
      for (const w of c.websites) {
        out.push({
          key: `${c.client.id}::${w.id}`,
          clientId: c.client.id,
          websiteId: w.id,
          clientName: c.client.name,
          contactName: c.client.contactName,
          isSubscribed: c.client.isSubscribed,
          label: w.label || w.url.replace(/^https?:\/\//, ""),
          url: w.url,
          isPrimary: w.isPrimary,
        });
      }
    }
    return out;
  }, [clientsData]);

  // When the batch is scheduled, automatically deselect any non-subscribed tiles.
  useEffect(() => {
    if (!isScheduled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const t of tiles) {
        if (!t.isSubscribed && next.has(t.key)) {
          next.delete(t.key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [isScheduled, tiles, setSelected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tiles;
    return tiles.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        (t.contactName ?? "").toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.url.toLowerCase().includes(q),
    );
  }, [tiles, search]);

  function toggle(key: string) {
    const tile = tiles.find((t) => t.key === key);
    if (isScheduled && tile && !tile.isSubscribed) return; // locked
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((t) => {
        if (isScheduled && !t.isSubscribed) return;
        next.add(t.key);
      });
      return next;
    });
  }

  function clearAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((t) => next.delete(t.key));
      return next;
    });
  }

  if (clientsData === null) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Loading clients…
      </div>
    );
  }

  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No clients with websites yet. Add a client and at least one website first.
      </div>
    );
  }

  const lockedCount = isScheduled ? tiles.filter((t) => !t.isSubscribed).length : 0;

  return (
    <div className="space-y-3 py-4">
      {isScheduled && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-primary" />
          <div>
            <p className="font-medium">Scheduled batches are limited to subscribed clients.</p>
            <p className="mt-0.5 text-muted-foreground">
              Non-subscribed clients are locked here and will be skipped on automated runs. Mark a
              client as subscribed on the Clients page to include them.
              {lockedCount > 0 && ` (${lockedCount} locked)`}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients or websites…"
            className="pl-8"
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={selectAllVisible}>
          Select all
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearAllVisible}>
          Clear
        </Button>
      </div>

      <div className="max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No matches for "{search}".
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtered.map((t) => {
              const isSelected = selected.has(t.key);
              const isLocked = isScheduled && !t.isSubscribed;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggle(t.key)}
                  aria-pressed={isSelected}
                  aria-disabled={isLocked}
                  disabled={isLocked}
                  title={
                    isLocked
                      ? "This client is not subscribed and can't be added to a scheduled batch."
                      : undefined
                  }
                  className={
                    "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all " +
                    (isLocked
                      ? "cursor-not-allowed border-dashed border-border bg-muted/30 opacity-60"
                      : isSelected
                        ? "border-primary bg-primary/5 shadow-[var(--shadow-card)]"
                        : "border-border bg-card hover:border-primary/40 hover:bg-accent/40")
                  }
                >
                  <div
                    className={
                      "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border transition-colors " +
                      (isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background")
                    }
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {t.clientName}
                      </p>
                      {t.isSubscribed ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                          <Sparkles className="h-2 w-2" /> Pro
                        </span>
                      ) : (
                        isScheduled && (
                          <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                            not subscribed
                          </span>
                        )
                      )}
                      {t.isPrimary && (
                        <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                          primary
                        </span>
                      )}
                    </div>
                    {t.contactName && (
                      <p className="truncate text-xs text-muted-foreground">{t.contactName}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3 flex-none" />
                      <span className="truncate">{t.label}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {selected.size} selected · {filtered.length} shown
      </p>
    </div>
  );
}


void XCircle;
