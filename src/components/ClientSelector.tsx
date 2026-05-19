import { useEffect, useState, type FormEvent } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { listClients, createClient, type Client } from "@/lib/clients";
import { createClientWebsite } from "@/lib/client-websites";
import { Briefcase, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NEW_VALUE = "__new__";

export function ClientSelector({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (clientId: string | null) => void;
  disabled?: boolean;
}) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"client" | "website">("client");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteLabel, setWebsiteLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const list = await listClients();
    setClients(list);
  }

  function resetDialog() {
    setStep("client");
    setName("");
    setContactName("");
    setNotes("");
    setWebsiteUrl("");
    setWebsiteLabel("");
    setCreatedClientId(null);
  }

  function handleSelect(v: string) {
    if (v === NEW_VALUE) {
      resetDialog();
      setOpen(true);
      return;
    }
    onChange(v);
  }

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    const result = await createClient({ name: trimmed, contactName, notes });
    setCreating(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Created client "${result.name}"`);
    setCreatedClientId(result.id);
    await refresh();
    setStep("website");
  }

  async function handleAddWebsite(e: FormEvent) {
    e.preventDefault();
    if (!createdClientId) return;
    const url = websiteUrl.trim();
    if (!url) return;
    setCreating(true);
    const result = await createClientWebsite({
      clientId: createdClientId,
      url,
      label: websiteLabel || null,
      isPrimary: true,
    });
    setCreating(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Website added");
    const finalId = createdClientId;
    setOpen(false);
    resetDialog();
    onChange(finalId);
  }

  function handleSkipWebsite() {
    const finalId = createdClientId;
    setOpen(false);
    resetDialog();
    if (finalId) onChange(finalId);
  }

  const placeholderText = clients && clients.length === 0
    ? "No clients yet — create one"
    : "Select a client";

  return (
    <>
      <Select
        value={value ?? undefined}
        onValueChange={handleSelect}
        disabled={disabled || clients === null}
      >
        <SelectTrigger className="h-13 w-full shrink-0 border-0 bg-muted/50 text-sm font-medium sm:w-[240px]">
          <Briefcase className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder={clients === null ? "Loading…" : placeholderText} />
        </SelectTrigger>
        <SelectContent>
          {clients?.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_VALUE} className="text-primary">
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New client…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetDialog();
        }}
      >
        <DialogContent>
          {step === "client" ? (
            <form onSubmit={handleCreateClient}>
              <DialogHeader>
                <DialogTitle>New client</DialogTitle>
                <DialogDescription>
                  Step 1 of 2 — Add the client's name and any notes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client-name">Business name</Label>
                  <Input
                    id="client-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Corp"
                    autoFocus
                    required
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-contact">Contact name</Label>
                  <Input
                    id="client-contact"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-notes">Notes (optional)</Label>
                  <Textarea
                    id="client-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Brand, target audience, agreed scope, etc."
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !name.trim() || !contactName.trim()}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleAddWebsite}>
              <DialogHeader>
                <DialogTitle>Add a website</DialogTitle>
                <DialogDescription>
                  Step 2 of 2 — Add the primary website for {name.trim()}. You can add more later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="website-url">Website URL</Label>
                  <Input
                    id="website-url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://acme.com"
                    autoFocus
                    required
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website-label">Label (optional)</Label>
                  <Input
                    id="website-label"
                    value={websiteLabel}
                    onChange={(e) => setWebsiteLabel(e.target.value)}
                    placeholder="Main site"
                    maxLength={120}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={handleSkipWebsite}>
                  Skip for now
                </Button>
                <Button type="submit" disabled={creating || !websiteUrl.trim()}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Add website"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
