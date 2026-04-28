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

type FirecrawlDocument = {
  rawHtml?: string;
  html?: string;
  metadata?: { sourceURL?: string; statusCode?: number; error?: string };
};

function pageReportFromDocument(url: string, doc: FirecrawlDocument | undefined): PageAuditReport {
  const fetchedAt = new Date().toISOString();
  const html = doc?.rawHtml || doc?.html || "";
  const finalUrl = doc?.metadata?.sourceURL || url;
  const status = doc?.metadata?.statusCode ?? 200;

  if (!html) {
    return {
      requestedUrl: url,
      fetchedAt,
      httpStatus: status,
      onPage: emptyOnPageReport(finalUrl),
      schema: [],
      crawlError: doc?.metadata?.error || "Page returned no HTML content.",
    };
  }

  return {
    requestedUrl: url,
    fetchedAt,
    httpStatus: status,
    onPage: parseOnPage(html, finalUrl),
    schema: parseSchema(html),
  };
}

/** Run a scrape→parse pipeline on a single URL via Firecrawl. */
async function auditOnePage(
  fc: Firecrawl,
  url: string,
): Promise<PageAuditReport> {
  try {
    const result = (await fc.scrape(url, {
      formats: ["rawHtml"],
      onlyMainContent: false,
    })) as FirecrawlDocument;
    return pageReportFromDocument(url, result);
  } catch (error) {
    return {
      requestedUrl: url,
      fetchedAt: new Date().toISOString(),
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

async function auditPagesWithBatch(
  fc: Firecrawl,
  urls: string[],
  warnings: string[],
): Promise<PageAuditReport[]> {
  if (urls.length === 0) return [];

  try {
    const job = await fc.startBatchScrape(urls, {
      options: { formats: ["rawHtml"], onlyMainContent: false, timeout: 20_000 },
      ignoreInvalidURLs: true,
      maxConcurrency: 10,
    });
    const deadline = Date.now() + 18_000;
    let latest = await fc.getBatchScrapeStatus(job.id, { autoPaginate: true, maxResults: urls.length, maxWaitTime: 2 });

    while (latest.status === "scraping" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      latest = await fc.getBatchScrapeStatus(job.id, { autoPaginate: true, maxResults: urls.length, maxWaitTime: 2 });
    }

    const docs = (latest.data ?? []) as FirecrawlDocument[];
    if (latest.status === "scraping") {
      warnings.push(`The scan is still running, so results include the first ${docs.length} completed page${docs.length === 1 ? "" : "s"}. Try Quick scan for faster full results.`);
      void fc.cancelBatchScrape(job.id).catch(() => undefined);
    }

    if (docs.length === 0) return [pageReportFromDocument(urls[0], undefined)];
    return docs.map((doc, index) => pageReportFromDocument(doc.metadata?.sourceURL || urls[index] || urls[0], doc));
  } catch (error) {
    warnings.push(`Batch scanning was unavailable, so the tool scanned a smaller sample. ${error instanceof Error ? error.message : ""}`.trim());
    return runWithConcurrency(urls.slice(0, 10), 3, (url) => auditOnePage(fc, url));
  }
}

export async function runSeoSiteAudit(
  rawUrl: string,
  scope: SiteScanScope,
): Promise<SiteAuditReport> {
  const rootUrl = normalizeRoot(rawUrl);
  const limit = SCOPE_LIMITS[scope] ?? SCOPE_LIMITS.standard;
  const warnings: string[] = [];

  const fc = getFirecrawl();
  const homepageSpeedPromise = Promise.all([
    fetchPageSpeed(rootUrl, "mobile"),
    fetchPageSpeed(rootUrl, "desktop"),
  ])
    .then(([mobile, desktop]) => ({ mobile, desktop }))
    .catch(() => undefined);

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

  // 2. Scrape + parse pages with a time budget so the API returns useful partial results instead of timing out.
  const pages = await auditPagesWithBatch(fc, targets, warnings);

  // 3. Run PageSpeed once on the homepage so the site grade can include it
  let homepageSpeed: SiteAuditReport["homepageSpeed"];
  try {
    homepageSpeed = await Promise.race([
      homepageSpeedPromise,
      new Promise<undefined>((resolve) => setTimeout(resolve, 8_000)),
    ]);
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
