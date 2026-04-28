import type { SchemaItem } from "@/lib/seo-types";
import { Badge } from "@/components/ui/badge";
import { FileCode2 } from "lucide-react";
import { useState } from "react";

export function SchemaTab({ items }: { items: SchemaItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <FileCode2 className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">No structured data found</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This page does not contain any JSON-LD schema markup. Adding structured data helps search engines understand your content.
        </p>
      </div>
    );
  }

  const counts = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Schema Types Found ({items.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="text-sm">
              {type}
              {count > 1 && <span className="ml-1.5 text-xs opacity-60">×{count}</span>}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center gap-3">
                <FileCode2 className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-semibold text-foreground">{item.type}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {openIdx === i ? "Hide" : "View JSON"}
              </span>
            </button>
            {openIdx === i && (
              <pre className="max-h-96 overflow-auto border-t border-border bg-muted/40 p-4 text-xs text-foreground">
                {JSON.stringify(item.raw, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
