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
const NONE_VALUE = "__none__";

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

  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = clients?.find((c) => c.id === value) ?? null;
  const placeholderText = clients && clients.length === 0
    ? "Ad-hoc scan (no client)"
    : "Ad-hoc scan (no client)";

  return (
    <>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={pickerOpen}
            disabled={disabled || clients === null}
            className="h-13 w-full shrink-0 justify-between border-0 bg-muted/50 text-sm font-medium sm:w-[240px]"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selected
                  ? selected.name
                  : clients === null
                    ? "Loading…"
                    : placeholderText}
              </span>
            </span>
            <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="end">
          <Command
            filter={(itemValue, search) => {
              if (itemValue === NEW_VALUE || itemValue === NONE_VALUE) return 1;
              return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search by name…" />
            <CommandList>
              <CommandEmpty>No clients match.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={NONE_VALUE}
                  onSelect={() => {
                    onChange(null);
                    setPickerOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      value === null ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-sm">Ad-hoc scan (no client)</span>
                </CommandItem>
              </CommandGroup>
              {clients && clients.length > 0 && (
                <CommandGroup heading="Clients">
                  {clients.map((c) => {
                    const haystack = [c.name, c.contactName ?? ""].join(" ");
                    return (
                      <CommandItem
                        key={c.id}
                        value={haystack}
                        onSelect={() => {
                          onChange(c.id);
                          setPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            value === c.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0 flex-1 truncate text-sm">
                          <span className="font-medium">{c.name}</span>
                          {c.contactName && (
                            <span className="ml-1.5 text-muted-foreground">
                              · {c.contactName}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value={NEW_VALUE}
                  onSelect={() => {
                    setPickerOpen(false);
                    resetDialog();
                    setOpen(true);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" /> New client…
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
