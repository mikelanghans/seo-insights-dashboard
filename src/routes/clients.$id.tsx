import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
  Plus,
  Pencil,
} from "lucide-react";
import { deleteClient, getClient, updateClient, type Client } from "@/lib/clients";
import { listScansForClient } from "@/lib/scans";
import {
  listClientWebsites,
  createClientWebsite,
  updateClientWebsite,
  deleteClientWebsite,
} from "@/lib/client-websites";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/clients/$id")({
  component: ClientDetailPage,
});

function shortUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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

function ClientDetailPage() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const clientQuery = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClient(id),
    enabled: !!user,
  });
  const scansQuery = useQuery({
    queryKey: ["client", id, "scans"],
    queryFn: () => listScansForClient(id),
    enabled: !!user,
  });
  const websitesQuery = useQuery({
    queryKey: ["client", id, "websites"],
    queryFn: () => listClientWebsites(id),
    enabled: !!user,
  });

  const client: Client | null | "missing" =
    clientQuery.isSuccess && clientQuery.data === null
      ? "missing"
      : clientQuery.data ?? null;
  const scans = scansQuery.data ?? null;
  const websites = websitesQuery.data ?? null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteLabel, setSiteLabel] = useState("");
  const [addingSite, setAddingSite] = useState(false);

  // Sync form fields when client loads.
  useEffect(() => {
    if (client && client !== "missing") {
      setName(client.name);
      setContactName(client.contactName ?? "");
      setNotes(client.notes ?? "");
    }
  }, [client]);

  async function refreshWebsites() {
    await queryClient.invalidateQueries({ queryKey: ["client", id, "websites"] });
  }

  async function handleAddWebsite(e: FormEvent) {
    e.preventDefault();
    if (!siteUrl.trim()) return;
    setAddingSite(true);
    const result = await createClientWebsite({ clientId: id, url: siteUrl, label: siteLabel });
    setAddingSite(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Website added");
    setSiteDialogOpen(false);
    setSiteUrl("");
    setSiteLabel("");
    await refreshWebsites();
  }

  async function handleMakePrimary(websiteId: string) {
    const ok = await updateClientWebsite(websiteId, { isPrimary: true, clientId: id });
    if (!ok) {
      toast.error("Could not update website.");
      return;
    }
    await refreshWebsites();
  }

  async function handleDeleteWebsite(websiteId: string) {
    const ok = await deleteClientWebsite(websiteId);
    if (!ok) {
      toast.error("Could not remove website.");
      return;
    }
    toast.success("Website removed");
    await refreshWebsites();
  }

  if (!authLoading && !user) return <Navigate to="/auth" />;

  if (client === "missing") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-6 py-12 text-center">
          <h1 className="text-xl font-bold">Client not found</h1>
          <Link to="/clients" className="mt-4 inline-block text-primary hover:underline">
            Back to clients
          </Link>
        </main>
      </div>
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!client || client === "missing") return;
    setSaving(true);
    const ok = await updateClient(client.id, { name, contactName, notes });
    setSaving(false);
    if (!ok) {
      toast.error("Could not save changes.");
      return;
    }
    toast.success("Client updated");
    queryClient.setQueryData<Client | null>(["client", id], {
      ...client,
      name,
      contactName: contactName.trim() ? contactName.trim() : null,
      notes: notes.trim() ? notes : null,
    });
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
    setEditing(false);
  }

  async function handleDelete() {
    if (!client || client === "missing") return;
    const ok = await deleteClient(client.id);
    if (!ok) {
      toast.error("Could not delete client.");
      return;
    }
    toast.success("Client deleted");
    void navigate({ to: "/clients" });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/clients"
          className="mb-4 inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          All clients
        </Link>

        {client === null ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              {editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Business name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact">Contact name</Label>
                    <Input
                      id="contact"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving || !name.trim()}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{client.name}</h1>
                    {client.contactName && (
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        Contact: <span className="text-foreground">{client.contactName}</span>
                      </p>
                    )}
                    {client.notes ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {client.notes}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm italic text-muted-foreground">No notes</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this client?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Their scan history will be kept but no longer linked to a client.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </section>

            <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Websites{websites ? ` (${websites.length})` : ""}
                </h2>
                <Button size="sm" variant="outline" onClick={() => setSiteDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add website
                </Button>
              </div>
              {websites === null ? (
                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : websites.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No websites yet. Add one to make scanning faster.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {websites.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 py-2.5">
                      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-foreground">
                            {w.label || shortUrl(w.url)}
                          </span>
                          {w.isPrimary && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              <Star className="h-2.5 w-2.5 fill-current" /> Primary
                            </span>
                          )}
                        </div>
                        {w.label && (
                          <p className="truncate text-xs text-muted-foreground">{w.url}</p>
                        )}
                      </div>
                      {!w.isPrimary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMakePrimary(w.id)}
                        >
                          Make primary
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove this website?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Past scans will be kept but no longer linked to this website.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteWebsite(w.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
              <DialogContent>
                <form onSubmit={handleAddWebsite}>
                  <DialogHeader>
                    <DialogTitle>Add website</DialogTitle>
                    <DialogDescription>
                      Add another site for this client.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="site-url">URL</Label>
                      <Input
                        id="site-url"
                        value={siteUrl}
                        onChange={(e) => setSiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="site-label">Label (optional)</Label>
                      <Input
                        id="site-label"
                        value={siteLabel}
                        onChange={(e) => setSiteLabel(e.target.value)}
                        placeholder="Main site, Landing page, etc."
                        maxLength={80}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setSiteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addingSite || !siteUrl.trim()}>
                      {addingSite ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Adding…
                        </>
                      ) : (
                        "Add website"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Scan history{scans ? ` (${scans.length})` : ""}
                </h2>
                <Link to="/">
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> New scan
                  </Button>
                </Link>
              </div>
              {scans === null ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading scans…
                </div>
              ) : scans.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No scans yet for this client.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {scans.map((scan) => {
                    const isRunning = scan.status === "pending" || scan.status === "running";
                    const isFailed = scan.status === "failed";
                    const toRoute = scan.kind === "page" ? "/page/$id" : "/scan/$id";
                    return (
                      <li key={scan.id} className="flex items-center gap-3 py-2.5">
                        <div className="shrink-0">
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
                            {scan.kind === "page"
                              ? `Single page · ${scan.auditType === "a11y" ? "Accessibility" : "SEO"}`
                              : `${scan.pagesScanned} pages · ${scan.scope}`}
                            {" · "}
                            {timeAgo(scan.createdAt)}
                          </p>
                        </div>
                        <Link
                          to={toRoute}
                          params={{ id: scan.id }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
