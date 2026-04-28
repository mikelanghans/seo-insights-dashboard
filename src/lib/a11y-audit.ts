// Lightweight static-HTML accessibility scanner.
// Detects the most common WCAG 2.1 A/AA issues that can be spotted without a headless browser.
// Color contrast and dynamic-state issues are out of scope (require rendering).

export type A11yImpact = "critical" | "serious" | "moderate" | "minor";

export interface A11yIssue {
  id: string;
  impact: A11yImpact;
  title: string;
  description: string;
  fix: string;
  /** WCAG reference, e.g. "1.1.1 Non-text Content (A)" */
  wcag?: string;
  /** Number of elements affected on the page. */
  count: number;
  /** Up to 5 short HTML snippets for context. */
  examples: string[];
}

export interface A11yReport {
  /** 0–100 score, where 100 = no detected issues. */
  score: number;
  /** Counts by impact across detected issues. */
  counts: { critical: number; serious: number; moderate: number; minor: number };
  /** Total number of distinct issue rules triggered. */
  totalIssues: number;
  /** Total number of element instances flagged. */
  totalInstances: number;
  issues: A11yIssue[];
  /** What we couldn't statically check, surfaced to the user. */
  limitations: string[];
}

// ---------- helpers ----------

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? "";
}

function hasAttr(tag: string, name: string): boolean {
  const re = new RegExp(`\\b${name}(\\s*=|\\s|>|/)`, "i");
  return re.test(tag);
}

function trimTag(tag: string, max = 120): string {
  const cleaned = tag.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

function textInside(html: string, openTag: string, closeTag: string, full: string): string {
  // For elements like <a>...</a> we need the inner text. Simplest: extract via regex per tag instance.
  // Caller passes the matched outer block — strip tags and decode whitespace.
  return full
    .replace(new RegExp(`^${escapeRe(openTag)}`), "")
    .replace(new RegExp(`${escapeRe(closeTag)}$`), "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const GENERIC_LINK_TEXT = new Set([
  "click here",
  "click",
  "here",
  "read more",
  "more",
  "learn more",
  "details",
  "link",
  "this",
  "this link",
]);

const REDUNDANT_ALT = /^(image|photo|picture|graphic|icon|img)$/i;

// ---------- detector ----------

interface Detector {
  id: string;
  impact: A11yImpact;
  title: string;
  description: string;
  fix: string;
  wcag?: string;
}

function makeIssue(d: Detector, examples: string[]): A11yIssue {
  return {
    id: d.id,
    impact: d.impact,
    title: d.title,
    description: d.description,
    fix: d.fix,
    wcag: d.wcag,
    count: examples.length,
    examples: examples.slice(0, 5),
  };
}

export function auditAccessibility(html: string): A11yReport {
  const issues: A11yIssue[] = [];
  const limitations = [
    "Color contrast can't be checked from static HTML — use browser DevTools or axe.",
    "Dynamic UI states (focus styles, ARIA live updates) require a rendered page.",
  ];

  // --- 1. Images missing alt ---
  {
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const flagged = imgs.filter((tag) => {
      // Decorative images may legitimately use role="presentation" or aria-hidden="true".
      if (/role\s*=\s*["']presentation["']/i.test(tag)) return false;
      if (/aria-hidden\s*=\s*["']true["']/i.test(tag)) return false;
      const alt = getAttr(tag, "alt");
      return alt === null; // alt="" is intentional decorative — allowed.
    });
    if (flagged.length) {
      issues.push(
        makeIssue(
          {
            id: "image-alt",
            impact: "serious",
            title: "Images missing alt attribute",
            description:
              "Screen readers announce these images by filename or skip them entirely, leaving users without context. Every <img> needs an alt — use alt=\"\" for purely decorative ones.",
            fix: 'Add alt="Brief description of the image" to each <img>. For decorative images that add no information, use alt="" so screen readers skip them.',
            wcag: "1.1.1 Non-text Content (A)",
          },
          flagged.map(trimTag),
        ),
      );
    }
  }

  // --- 2. Redundant alt ("image", "photo") ---
  {
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const flagged = imgs.filter((tag) => {
      const alt = getAttr(tag, "alt");
      return alt !== null && REDUNDANT_ALT.test(alt.trim());
    });
    if (flagged.length) {
      issues.push(
        makeIssue(
          {
            id: "image-alt-redundant",
            impact: "minor",
            title: "Redundant alt text",
            description:
              'Alt text like "image" or "photo" repeats what the screen reader already announces, adding noise without context.',
            fix: "Replace with a meaningful description of what the image conveys, or use alt=\"\" if it's decorative.",
            wcag: "1.1.1 Non-text Content (A)",
          },
          flagged.map(trimTag),
        ),
      );
    }
  }

  // --- 3. Form inputs without accessible name ---
  {
    const inputs = [
      ...html.matchAll(/<(input|textarea|select)\b[^>]*>/gi),
    ].map((m) => ({ tag: m[0], type: getAttr(m[0], "type")?.toLowerCase() ?? "text" }));

    // Build a set of ids referenced by <label for="...">
    const labelFors = new Set(
      [...html.matchAll(/<label\b[^>]*\bfor\s*=\s*("([^"]+)"|'([^']+)')/gi)].map(
        (m) => m[2] ?? m[3] ?? "",
      ),
    );

    const flagged = inputs
      .filter(({ tag, type }) => {
        // Skip hidden / submit-style inputs that don't need labels.
        if (["hidden", "submit", "button", "reset", "image"].includes(type)) return false;
        const id = getAttr(tag, "id");
        if (id && labelFors.has(id)) return false;
        if (hasAttr(tag, "aria-label")) return false;
        if (hasAttr(tag, "aria-labelledby")) return false;
        if (hasAttr(tag, "title")) return false;
        return true;
      })
      .map(({ tag }) => tag);

    if (flagged.length) {
      issues.push(
        makeIssue(
          {
            id: "form-label",
            impact: "critical",
            title: "Form fields without labels",
            description:
              "Inputs without a <label>, aria-label, or aria-labelledby are unusable with screen readers and voice control. Placeholder text alone is not a label — it disappears when the user types.",
            fix: 'Wire each input to a visible <label for="input-id"> or add aria-label="Field name". Avoid relying on placeholder as the only hint.',
            wcag: "3.3.2 Labels or Instructions (A) · 4.1.2 Name, Role, Value (A)",
          },
          flagged.map(trimTag),
        ),
      );
    }
  }

  // --- 4. Inputs using only a placeholder ---
  {
    const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map((m) => m[0]);
    const labelFors = new Set(
      [...html.matchAll(/<label\b[^>]*\bfor\s*=\s*("([^"]+)"|'([^']+)')/gi)].map(
        (m) => m[2] ?? m[3] ?? "",
      ),
    );
    const flagged = inputs.filter((tag) => {
      if (!hasAttr(tag, "placeholder")) return false;
      const type = getAttr(tag, "type")?.toLowerCase() ?? "text";
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) return false;
      const id = getAttr(tag, "id");
      const labeled =
        (id && labelFors.has(id)) ||
        hasAttr(tag, "aria-label") ||
        hasAttr(tag, "aria-labelledby");
      return !labeled;
    });
    if (flagged.length) {
      issues.push(
        makeIssue(
          {
            id: "placeholder-as-label",
            impact: "moderate",
            title: "Placeholder used as label",
            description:
              "Placeholders disappear once the user types and often have low color contrast. Users with cognitive or visual disabilities lose the field's purpose.",
            fix: "Pair every input with a visible <label> (or aria-label) in addition to the placeholder, not instead of it.",
            wcag: "3.3.2 Labels or Instructions (A)",
          },
          flagged.map(trimTag),
        ),
      );
    }
  }

  // --- 5. Buttons / links without accessible name ---
  {
    // Buttons
    const btns = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)];
    const flaggedBtns = btns
      .filter(([full, inner]) => {
        const open = full.slice(0, full.indexOf(">") + 1);
        if (hasAttr(open, "aria-label")) return false;
        if (hasAttr(open, "aria-labelledby")) return false;
        if (hasAttr(open, "title")) return false;
        const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return text.length === 0;
      })
      .map(([full]) => trimTag(full));

    if (flaggedBtns.length) {
      issues.push(
        makeIssue(
          {
            id: "button-name",
            impact: "critical",
            title: "Buttons without an accessible name",
            description:
              "Icon-only or empty buttons announce as just \"button\" to screen readers, giving no clue what they do.",
            fix: 'Add aria-label="What this button does" — e.g. aria-label="Close menu" — or include visually hidden text inside.',
            wcag: "4.1.2 Name, Role, Value (A)",
          },
          flaggedBtns,
        ),
      );
    }
  }

  // --- 6. Empty links / generic link text / missing href ---
  {
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    const emptyLinks: string[] = [];
    const genericLinks: string[] = [];
    const noHref: string[] = [];

    for (const [full, attrs, inner] of links) {
      const openTag = `<a${attrs}>`;
      const ariaLabel = getAttr(openTag, "aria-label");
      const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const accessibleName = (ariaLabel || text || "").toLowerCase();

      if (!accessibleName && !hasAttr(openTag, "aria-labelledby")) {
        emptyLinks.push(trimTag(full));
      } else if (GENERIC_LINK_TEXT.has(accessibleName)) {
        genericLinks.push(trimTag(full));
      }

      const href = getAttr(openTag, "href");
      if (href === null || href.trim() === "" || href.trim() === "#") {
        noHref.push(trimTag(full));
      }
    }

    if (emptyLinks.length) {
      issues.push(
        makeIssue(
          {
            id: "link-name",
            impact: "serious",
            title: "Links without text or label",
            description:
              "Links with no visible text and no aria-label are announced by screen readers as the URL itself, or skipped entirely.",
            fix: 'Add visible link text or aria-label="Where this goes" — e.g. aria-label="Open Twitter profile" on icon links.',
            wcag: "2.4.4 Link Purpose (In Context) (A)",
          },
          emptyLinks,
        ),
      );
    }

    if (genericLinks.length) {
      issues.push(
        makeIssue(
          {
            id: "link-generic-text",
            impact: "moderate",
            title: 'Generic link text ("click here", "read more")',
            description:
              "Screen-reader users often navigate by pulling up a list of links. Generic phrases give no clue about the destination when stripped of surrounding context.",
            fix: 'Rewrite the link text to describe the destination, e.g. "Read the 2025 pricing changes" instead of "Read more".',
            wcag: "2.4.4 Link Purpose (In Context) (A)",
          },
          genericLinks,
        ),
      );
    }

    if (noHref.length) {
      issues.push(
        makeIssue(
          {
            id: "link-no-href",
            impact: "moderate",
            title: 'Links with missing or "#" href',
            description:
              "Anchors without an href aren't focusable by keyboard and aren't exposed as links to assistive tech. They look interactive but aren't.",
            fix: "Use a real URL, or replace the <a> with a <button> if it triggers JavaScript instead of navigating.",
            wcag: "2.1.1 Keyboard (A)",
          },
          noHref,
        ),
      );
    }
  }

  // --- 7. Missing <html lang> ---
  {
    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? null;
    const lang = htmlTag ? getAttr(htmlTag, "lang") : null;
    if (!lang || !lang.trim()) {
      issues.push(
        makeIssue(
          {
            id: "html-lang",
            impact: "serious",
            title: "Missing <html lang> attribute",
            description:
              "Without a lang attribute, screen readers may pronounce the page using the wrong language voice, making content hard or impossible to understand.",
            fix: 'Set the document language on the root element, e.g. <html lang="en">.',
            wcag: "3.1.1 Language of Page (A)",
          },
          [htmlTag ? trimTag(htmlTag) : "<html>"],
        ),
      );
    }
  }

  // --- 8. Missing <title> ---
  {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const titleText = titleMatch?.[1]?.trim() ?? "";
    if (!titleText) {
      issues.push(
        makeIssue(
          {
            id: "document-title",
            impact: "serious",
            title: "Missing or empty <title>",
            description:
              "The page title is the first thing announced to screen readers and shown in browser tabs and search results.",
            fix: "Add a unique, descriptive <title> in the <head> that summarizes the page.",
            wcag: "2.4.2 Page Titled (A)",
          },
          ["<title>"],
        ),
      );
    }
  }

  // --- 9. Heading hierarchy (no H1, multiple H1, skipped levels) ---
  {
    const headings: { level: number; tag: string }[] = [];
    for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      headings.push({ level: Number(m[1]), tag: trimTag(m[0]) });
    }
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length === 0) {
      issues.push(
        makeIssue(
          {
            id: "heading-no-h1",
            impact: "serious",
            title: "No <h1> heading",
            description:
              "Screen-reader users navigate by headings. Without an H1, they have no top-level summary of what the page is about.",
            fix: "Add a single <h1> at the top of the main content describing the page's primary topic.",
            wcag: "1.3.1 Info and Relationships (A) · 2.4.6 Headings and Labels (AA)",
          },
          ["(no <h1> on page)"],
        ),
      );
    } else if (h1s.length > 1) {
      issues.push(
        makeIssue(
          {
            id: "heading-multiple-h1",
            impact: "moderate",
            title: `Multiple <h1> headings (${h1s.length})`,
            description:
              "Multiple H1s blur the document outline and confuse assistive tech that relies on a single primary heading.",
            fix: "Keep one H1 per page. Demote the rest to <h2> or <h3> to reflect the actual hierarchy.",
            wcag: "1.3.1 Info and Relationships (A)",
          },
          h1s.map((h) => h.tag),
        ),
      );
    }

    // Skipped levels (e.g. h2 → h4)
    const skipped: string[] = [];
    for (let i = 1; i < headings.length; i++) {
      const jump = headings[i].level - headings[i - 1].level;
      if (jump > 1) skipped.push(`${headings[i - 1].tag} → ${headings[i].tag}`);
    }
    if (skipped.length) {
      issues.push(
        makeIssue(
          {
            id: "heading-skip",
            impact: "minor",
            title: "Skipped heading levels",
            description:
              "Jumping from <h2> straight to <h4> breaks the document outline that screen readers expose for navigation.",
            fix: "Use heading levels sequentially. If you need a smaller-looking heading, style an <h3> with CSS instead of skipping.",
            wcag: "1.3.1 Info and Relationships (A)",
          },
          skipped,
        ),
      );
    }
  }

  // --- 10. Iframes without title ---
  {
    const iframes = [...html.matchAll(/<iframe\b[^>]*>/gi)].map((m) => m[0]);
    const flagged = iframes.filter((tag) => {
      if (/aria-hidden\s*=\s*["']true["']/i.test(tag)) return false;
      const title = getAttr(tag, "title");
      return !title || !title.trim();
    });
    if (flagged.length) {
      issues.push(
        makeIssue(
          {
            id: "iframe-title",
            impact: "serious",
            title: "Iframes without a title",
            description:
              "Screen readers announce the iframe's title to describe its content. Without one, users hear only \"frame\" with no context.",
            fix: 'Add title="Description of embedded content" — e.g. title="YouTube: Product walkthrough".',
            wcag: "4.1.2 Name, Role, Value (A)",
          },
          flagged.map(trimTag),
        ),
      );
    }
  }

  // --- 11. Positive tabindex ---
  {
    const flagged = [...html.matchAll(/<[^>]*\btabindex\s*=\s*("([^"]+)"|'([^']+)'|(\d+))[^>]*>/gi)]
      .map((m) => ({ tag: m[0], val: Number(m[2] ?? m[3] ?? m[4]) }))
      .filter(({ val }) => Number.isFinite(val) && val > 0)
      .map(({ tag }) => trimTag(tag));
    if (flagged.length) {
      issues.push(
        makeIssue(
          {
            id: "tabindex-positive",
            impact: "moderate",
            title: "Positive tabindex values",
            description:
              "tabindex values greater than 0 hijack the natural keyboard tab order, making the page unpredictable for keyboard users.",
            fix: "Use tabindex=\"0\" to make an element focusable in document order, or tabindex=\"-1\" for programmatic focus only. Avoid positive values.",
            wcag: "2.4.3 Focus Order (A)",
          },
          flagged,
        ),
      );
    }
  }

  // --- 12. Duplicate ids ---
  {
    const ids = [...html.matchAll(/\bid\s*=\s*("([^"]+)"|'([^']+)')/gi)].map((m) => m[2] ?? m[3] ?? "");
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    const dupes = [...counts.entries()].filter(([, n]) => n > 1);
    if (dupes.length) {
      issues.push(
        makeIssue(
          {
            id: "duplicate-id",
            impact: "moderate",
            title: "Duplicate id attributes",
            description:
              "ARIA relationships (aria-labelledby, aria-controls), <label for>, and JavaScript focus all rely on unique ids. Duplicates break these silently.",
            fix: "Make every id on the page unique. If you need to style multiple elements, use a class instead.",
            wcag: "4.1.1 Parsing (A)",
          },
          dupes.map(([id, n]) => `id="${id}" appears ${n}× on the page`),
        ),
      );
    }
  }

  // --- 13. Missing <main> landmark ---
  {
    const hasMain =
      /<main\b/i.test(html) || /role\s*=\s*["']main["']/i.test(html);
    if (!hasMain) {
      issues.push(
        makeIssue(
          {
            id: "landmark-main",
            impact: "moderate",
            title: "No <main> landmark",
            description:
              'Screen-reader users use the "skip to main content" landmark to bypass nav and headers. Without a <main>, they have to tab through everything.',
            fix: "Wrap the primary content of the page in a single <main> element (or use role=\"main\" on the equivalent container).",
            wcag: "1.3.1 Info and Relationships (A) · 2.4.1 Bypass Blocks (A)",
          },
          ["(no <main> landmark found)"],
        ),
      );
    }
  }

  // --- 14. Viewport that disables zoom ---
  {
    const vpTag = html.match(/<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i)?.[0] ?? null;
    if (vpTag) {
      const content = (getAttr(vpTag, "content") || "").toLowerCase();
      if (
        /user-scalable\s*=\s*no/.test(content) ||
        /maximum-scale\s*=\s*1(\.0+)?\b/.test(content)
      ) {
        issues.push(
          makeIssue(
            {
              id: "viewport-zoom",
              impact: "serious",
              title: "Viewport disables pinch-to-zoom",
              description:
                "Locking the zoom level prevents users with low vision from enlarging text, a major barrier on mobile.",
              fix: 'Use <meta name="viewport" content="width=device-width, initial-scale=1"> without user-scalable=no or maximum-scale=1.',
              wcag: "1.4.4 Resize Text (AA)",
            },
            [trimTag(vpTag)],
          ),
        );
      }
    }
  }

  // ---------- score ----------
  // Penalty per issue weighted by impact, capped at 100 deduction.
  const IMPACT_PENALTY: Record<A11yImpact, number> = {
    critical: 25,
    serious: 15,
    moderate: 8,
    minor: 3,
  };
  let deduction = 0;
  for (const issue of issues) {
    // First instance costs the full impact penalty; additional instances cost 25% each, capped per rule.
    const base = IMPACT_PENALTY[issue.impact];
    const extras = Math.min(issue.count - 1, 4) * (base * 0.25);
    deduction += base + extras;
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - deduction)));

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  let totalInstances = 0;
  for (const issue of issues) {
    counts[issue.impact] += 1;
    totalInstances += issue.count;
  }

  // Sort: critical → serious → moderate → minor, then by count desc
  const RANK: Record<A11yImpact, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  issues.sort((a, b) => {
    const r = RANK[a.impact] - RANK[b.impact];
    return r !== 0 ? r : b.count - a.count;
  });

  return {
    score,
    counts,
    totalIssues: issues.length,
    totalInstances,
    issues,
    limitations,
  };
}
