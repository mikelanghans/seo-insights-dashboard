import Firecrawl from "@mendable/firecrawl-js";
import {
  emptyOnPageReport,
  fetchPageSpeed,
  parseOnPage,
  parseSchema,
} from "./seo-audit.functions";
import type { PageAuditReport, SiteAuditReport } from "./seo-types";

export type SiteScanScope = "quick" | "standard" | "deep";

const SCOPE_LIMITS: Record<SiteScanScope, number> = {
  quick: 25,
  standard: 100,
  deep: 500,
};

function normalizeRoot(raw: string): string {
  const withProto = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  const u = new URL(withProto);
  if (!u.hostname.includes(".")) throw new Error("Invalid URL");
  // Reduce to origin so we map the whole site, not just one subpath
  u.pathname = "/";
  u.search = "";
  u.hash = "";
  return u.toString();
}

function getFirecrawl(): Firecrawl {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Site scanning requires the Firecrawl integration. Please connect Firecrawl in Connectors.",
    );
  }
  return new Firecrawl({ apiKey });
}

/** Run a scrape→parse pipeline on a single URL via Firecrawl. */
async function auditOnePage(
  fc: Firecrawl,
  url: string,
): Promise<PageAuditReport> {
  const fetchedAt = new Date().toISOString();
  try {
    const result = (await fc.scrape(url, {
      formats: ["rawHtml"],
      onlyMainContent: false,
    })) as {
      rawHtml?: string;
      html?: string;
      metadata?: { sourceURL?: string; statusCode?: number };
    };
    const html = result.rawHtml || result.html || "";
    const finalUrl = result.metadata?.sourceURL || url;
    const status = result.metadata?.statusCode ?? 200;

    if (!html) {
      return {
        requestedUrl: url,
        fetchedAt,
        httpStatus: status,
        onPage: emptyOnPageReport(finalUrl),
        schema: [],
        crawlError: "Page returned no HTML content.",
      };
    }

    return {
      requestedUrl: url,
      fetchedAt,
      httpStatus: status,
      onPage: parseOnPage(html, finalUrl),
      schema: parseSchema(html),
    };
  } catch (error) {
    return {
      requestedUrl: url,
      fetchedAt,
      httpStatus: 0,
      onPage: emptyOnPageReport(url),
      schema: [],
      crawlError: error instanceof Error ? error.message : "Failed to load page",
    };
  }
}

/** Run pages in batches of `concurrency` to avoid hammering Firecrawl. */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function runSeoSiteAudit(
  rawUrl: string,
  scope: SiteScanScope,
): Promise<SiteAuditReport> {
  const rootUrl = normalizeRoot(rawUrl);
  const limit = SCOPE_LIMITS[scope] ?? SCOPE_LIMITS.standard;
  const warnings: string[] = [];

  const fc = getFirecrawl();

  // 1. Discover URLs via Firecrawl map (fast — no full scraping)
  let allLinks: string[] = [];
  try {
    const mapResult = (await fc.map(rootUrl, {
      limit: Math.max(limit, 50),
      includeSubdomains: false,
    })) as { links?: Array<string | { url: string }> };
    const rawLinks = mapResult.links ?? [];
    allLinks = rawLinks
      .map((l) => (typeof l === "string" ? l : l.url))
      .filter((u): u is string => typeof u === "string");
  } catch (error) {
    throw new Error(
      `Couldn't map the site. ${error instanceof Error ? error.message : "Firecrawl error"}`,
    );
  }

  // De-dupe + always include the root URL first
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const candidate of [rootUrl, ...allLinks]) {
    try {
      const u = new URL(candidate);
      // Strip fragments, normalize trailing slash for de-dup
      u.hash = "";
      const key = u.toString();
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    } catch {
      // skip malformed
    }
  }

  const targets = ordered.slice(0, limit);
  if (ordered.length > limit) {
    warnings.push(
      `Site has ${ordered.length} discoverable pages — scanning the first ${limit}. Choose a deeper scope to scan more.`,
    );
  }

  // 2. Scrape + parse each page (with bounded concurrency)
  const pages = await runWithConcurrency(targets, 5, (url) => auditOnePage(fc, url));

  // 3. Run PageSpeed once on the homepage so the site grade can include it
  let homepageSpeed: SiteAuditReport["homepageSpeed"];
  try {
    const [mobile, desktop] = await Promise.all([
      fetchPageSpeed(rootUrl, "mobile"),
      fetchPageSpeed(rootUrl, "desktop"),
    ]);
    homepageSpeed = { mobile, desktop };
  } catch {
    // Non-fatal — site audit can proceed without speed data
  }

  return {
    rootUrl,
    fetchedAt: new Date().toISOString(),
    pagesRequested: targets.length,
    pagesScanned: pages.length,
    pages,
    discoveredUrlCount: ordered.length,
    homepageSpeed,
    warnings: warnings.length ? warnings : undefined,
  };
}
