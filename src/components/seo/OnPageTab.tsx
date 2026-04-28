import type { OnPageReport } from "@/lib/seo-types";
import { CheckRow } from "./CheckRow";
import { Badge } from "@/components/ui/badge";
import { Info, ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function OnPageTab({ data }: { data: OnPageReport }) {
  const titleStatus = !data.title
    ? "fail"
    : data.titleLength < 30 || data.titleLength > 60
      ? "warn"
      : "pass";

  const descStatus = !data.metaDescription
    ? "fail"
    : data.metaDescriptionLength < 70 || data.metaDescriptionLength > 160
      ? "warn"
      : "pass";

  const h1Status = data.h1Count === 1 ? "pass" : data.h1Count === 0 ? "fail" : "warn";
  const altStatus =
    data.images.total === 0
      ? "info"
      : data.images.missingAlt === 0
        ? "pass"
        : data.images.missingAlt / data.images.total > 0.2
          ? "fail"
          : "warn";

  const headingsByTag = {
    h1: data.headings.filter((h) => h.tag === "h1"),
    h2: data.headings.filter((h) => h.tag === "h2"),
    h3: data.headings.filter((h) => h.tag === "h3"),
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CheckRow
        status={titleStatus}
        label="Title tag"
        hint={`${data.titleLength} chars`}
        value={data.title || <em>Missing</em>}
      />
      <CheckRow
        status={descStatus}
        label="Meta description"
        hint={`${data.metaDescriptionLength} chars`}
        value={data.metaDescription || <em>Missing</em>}
      />
      <CheckRow
        status={data.canonical ? "pass" : "warn"}
        label="Canonical URL"
        value={data.canonical || <em>Not set</em>}
      />
      <CheckRow
        status={data.robots ? "info" : "info"}
        label="Robots meta"
        value={data.robots || <em>Default (index, follow)</em>}
      />
      <CheckRow
        status={data.viewport ? "pass" : "fail"}
        label="Viewport"
        value={data.viewport || <em>Missing</em>}
      />
      <CheckRow
        status={data.lang ? "pass" : "warn"}
        label="HTML lang"
        value={data.lang || <em>Not set</em>}
      />
      <CheckRow
        status={h1Status}
        label="H1 tags"
        hint={`${data.h1Count} found`}
        value={headingsByTag.h1[0]?.text || <em>None</em>}
      />
      <CheckRow
        status={altStatus}
        label="Image alt tags"
        hint={`${data.images.total - data.images.missingAlt}/${data.images.total} have alt`}
        value={
          data.images.missingAlt > 0
            ? `${data.images.missingAlt} image(s) missing alt text`
            : "All images have alt text"
        }
      />

      <div className="md:col-span-2 rounded-lg border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Heading Structure</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Why heading structure matters"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Search engines and AI answer engines use your heading hierarchy to understand
                  page structure and topic relationships. A clear outline — one H1 describing the
                  page, H2s for main sections, H3s for subtopics — improves rankings, accessibility,
                  and the chance your content is cited in AI overviews.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          A logical H1 → H2 → H3 outline helps search engines, screen readers, and AI assistants
          understand what your page is about and which sections answer which questions.
        </p>
        <div className="space-y-3">

          {(["h1", "h2", "h3"] as const).map((tag) => {
            const items = headingsByTag[tag];
            const PREVIEW = 8;
            const hasMore = items.length > PREVIEW;
            return (
              <div key={tag}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono uppercase">
                    {tag}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {items.length} found
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="pl-2 text-sm italic text-muted-foreground">None</p>
                ) : !hasMore ? (
                  <ul className="space-y-1 pl-2">
                    {items.map((h, i) => (
                      <li key={i} className="text-sm text-foreground">
                        • {h.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Collapsible>
                    <ul className="space-y-1 pl-2">
                      {items.slice(0, PREVIEW).map((h, i) => (
                        <li key={i} className="text-sm text-foreground">
                          • {h.text}
                        </li>
                      ))}
                    </ul>
                    <CollapsibleContent>
                      <ul className="mt-1 space-y-1 pl-2">
                        {items.slice(PREVIEW).map((h, i) => (
                          <li key={i} className="text-sm text-foreground">
                            • {h.text}
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                    <CollapsibleTrigger className="group mt-2 flex items-center gap-1 pl-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                      <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                      <span className="group-data-[state=open]:hidden">
                        Show {items.length - PREVIEW} more
                      </span>
                      <span className="hidden group-data-[state=open]:inline">Show less</span>
                    </CollapsibleTrigger>
                  </Collapsible>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
