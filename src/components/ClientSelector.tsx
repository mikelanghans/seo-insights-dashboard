import { useEffect, useState, type FormEvent } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Briefcase, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

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
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const list = await listClients();
    setClients(list);
  }

  function handleSelect(v: string) {
    if (v === NEW_VALUE) {
      setOpen(true);
      return;
    }
    onChange(v);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    const result = await createClient({ name: trimmed, notes });
    setCreating(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Created client "${result.name}"`);
    setOpen(false);
    setName("");
    setNotes("");
    await refresh();
    onChange(result.id);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>New client</DialogTitle>
              <DialogDescription>
                Group scans by client so it's easy to track progress across projects.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="client-name">Name</Label>
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
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create client"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
