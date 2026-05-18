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
import { Label } from "@/components/ui/label";
import {
  listClientWebsites,
  createClientWebsite,
  type ClientWebsite,
} from "@/lib/client-websites";
import { Globe, Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";

const NEW_VALUE = "__new__";

function shortUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function WebsiteSelector({
  clientId,
  value,
  onChange,
  disabled,
}: {
  clientId: string;
  value: string | null;
  onChange: (website: ClientWebsite | null) => void;
  disabled?: boolean;
}) {
  const [websites, setWebsites] = useState<ClientWebsite[] | null>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWebsites(null);
    void (async () => {
      const list = await listClientWebsites(clientId);
      if (cancelled) return;
      setWebsites(list);
      // Auto-select primary (or only) website
      if (list.length > 0 && !value) {
        const primary = list.find((w) => w.isPrimary) ?? list[0];
        onChange(primary);
      } else if (list.length === 0) {
        onChange(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function handleSelect(v: string) {
    if (v === NEW_VALUE) {
      setOpen(true);
      return;
    }
    const w = websites?.find((x) => x.id === v) ?? null;
    onChange(w);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setCreating(true);
    const result = await createClientWebsite({ clientId, url, label });
    setCreating(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Added ${shortUrl(result.url)}`);
    setOpen(false);
    setUrl("");
    setLabel("");
    const list = await listClientWebsites(clientId);
    setWebsites(list);
    onChange(result);
  }

  const placeholder =
    websites && websites.length === 0 ? "No websites — add one" : "Select a website";

  return (
    <>
      <Select
        value={value ?? undefined}
        onValueChange={handleSelect}
        disabled={disabled || websites === null}
      >
        <SelectTrigger className="h-13 w-full shrink-0 border-0 bg-muted/50 text-sm font-medium sm:w-[220px]">
          <Globe className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder={websites === null ? "Loading…" : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {websites?.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              <span className="inline-flex items-center gap-1.5">
                {w.isPrimary && <Star className="h-3 w-3 fill-current text-primary" />}
                {w.label ? `${w.label} · ${shortUrl(w.url)}` : shortUrl(w.url)}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={NEW_VALUE} className="text-primary">
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add website…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Add website</DialogTitle>
              <DialogDescription>
                Add another site for this client (e.g. main site, landing page, subdomain).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="website-url">URL</Label>
                <Input
                  id="website-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website-label">Label (optional)</Label>
                <Input
                  id="website-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Main site, Landing page, etc."
                  maxLength={80}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !url.trim()}>
                {creating ? (
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
    </>
  );
}
