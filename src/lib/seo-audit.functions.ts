import type { JsonValue, OnPageReport, PageSpeedReport, SchemaItem } from "./seo-types";
import { auditAccessibility } from "./a11y-audit";

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
}

function toJsonValue(value: unknown): JsonValue {
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return String(value);
  }
}

export function parseOnPage(html: string, finalUrl: string): OnPageReport {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;
  const htmlTagMatch = html.match(/<html\b[^>]*>/i);
  const lang = htmlTagMatch ? getAttr(htmlTagMatch[0], "lang") : null;
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  let metaDescription: string | null = null;
  let robots: string | null = null;
  let viewport: string | null = null;
  const openGraph: Record<string, string> = {};
  const twitter: Record<string, string> = {};

  for (const tag of metaTags) {
    const name = (getAttr(tag, "name") || "").toLowerCase();
    const property = (getAttr(tag, "property") || "").toLowerCase();
    const content = getAttr(tag, "content");
    if (!content) continue;
    if (name === "description") metaDescription = content;
    else if (name === "robots") robots = content;
    else if (name === "viewport") viewport = content;
    else if (property.startsWith("og:")) openGraph[property] = content;
    else if (name.startsWith("twitter:")) twitter[name] = content;
  }

  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  let canonical: string | null = null;
  for (const tag of linkTags) {
    const rel = (getAttr(tag, "rel") || "").toLowerCase();
    if (rel === "canonical") {
      canonical = getAttr(tag, "href");
      break;
    }
  }

  const headings: OnPageReport["headings"] = [];
  for (const level of ["h1", "h2", "h3"] as const) {
    const re = new RegExp(`<${level}\\b[^>]*>([\\s\\S]*?)<\\/${level}>`, "gi");
    for (const m of html.matchAll(re)) {
      const text = decodeEntities(m[1].replace(/<[^>]+>/g, "").trim());
      if (text) headings.push({ tag: level, text: text.slice(0, 200) });
    }
  }

  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  let missingAlt = 0;
  const missingAltSrcs: string[] = [];
  for (const tag of imgTags) {
    const alt = getAttr(tag, "alt");
    if (alt === null || alt.trim() === "") {
      missingAlt++;
      const src = getAttr(tag, "src");
      if (src && missingAltSrcs.length < 10) missingAltSrcs.push(src);
    }
  }

  return {
    finalUrl,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical,
    robots,
    lang,
    viewport,
    headings,
    h1Count: headings.filter((h) => h.tag === "h1").length,
    images: { total: imgTags.length, missingAlt, missingAltSrcs },
    openGraph,
    twitter,
  };
}

export function parseSchema(html: string): SchemaItem[] {
  const items: SchemaItem[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const collect = (node: unknown) => {
        if (Array.isArray(node)) {
          node.forEach(collect);
          return;
        }
        if (node && typeof node === "object") {
          const obj = node as Record<string, unknown>;
          const typeValue = obj["@type"];
          const type = Array.isArray(typeValue) ? typeValue.join(", ") : (typeValue as string) || "Unknown";
          items.push({ type, raw: toJsonValue(obj) });
          if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(collect);
        }
      };
      collect(parsed);
    } catch {
      items.push({ type: "Invalid JSON-LD", raw: raw.slice(0, 200) });
    }
  }
  return items;
}

export async function fetchPageSpeed(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedReport> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const params = new URLSearchParams({ url, strategy });
  for (const cat of ["performance", "seo", "accessibility", "best-practices"]) params.append("category", cat);
  if (apiKey) params.set("key", apiKey);

  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 429) throw new Error("PageSpeed API 429 — rate-limited (add PAGESPEED_API_KEY for 25k/day)");
      throw new Error(`PageSpeed API ${res.status}`);
    }
    const result = await res.json();
    const categories = result?.lighthouseResult?.categories ?? {};
    const audits = result?.lighthouseResult?.audits ?? {};
    const metric = (id: string) => {
      const audit = audits[id];
      return audit ? { value: audit.displayValue ?? "—", score: audit.score ?? null } : null;
    };
    return {
      strategy,
      performanceScore: categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null,
      seoScore: categories.seo?.score != null ? Math.round(categories.seo.score * 100) : null,
      accessibilityScore: categories.accessibility?.score != null ? Math.round(categories.accessibility.score * 100) : null,
      bestPracticesScore: categories["best-practices"]?.score != null ? Math.round(categories["best-practices"].score * 100) : null,
      metrics: {
        lcp: metric("largest-contentful-paint"),
        fid: metric("max-potential-fid"),
        cls: metric("cumulative-layout-shift"),
        fcp: metric("first-contentful-paint"),
        ttfb: metric("server-response-time"),
        inp: metric("interactive"),
      },
    };
  } catch (e) {
    return {
      strategy,
      performanceScore: null,
      seoScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      metrics: { lcp: null, fid: null, cls: null, fcp: null, ttfb: null, inp: null },
      error: e instanceof Error ? e.message : "PageSpeed unavailable",
    };
  }
}

function normalizeAuditUrl(raw: string): string {
  const withProto = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  const parsed = new URL(withProto);
  if (!parsed.hostname.includes(".")) throw new Error("Invalid URL");
  return parsed.toString();
}

export function emptyOnPageReport(finalUrl: string): OnPageReport {
  return {
    finalUrl,
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonical: null,
    robots: null,
    lang: null,
    viewport: null,
    headings: [],
    h1Count: 0,
    images: { total: 0, missingAlt: 0, missingAltSrcs: [] },
    openGraph: {},
    twitter: {},
  };
}

async function fetchAuditHtml(url: string): Promise<{ finalUrl: string; status: number; html: string }> {
  const targets = [url];
  const parsed = new URL(url);
  if (!parsed.hostname.startsWith("www.")) {
    const wwwUrl = new URL(url);
    wwwUrl.hostname = `www.${parsed.hostname}`;
    targets.push(wwwUrl.toString());
  }

  let lastError = "Load failed";
  for (const target of targets) {
    try {
      const response = await fetch(target, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const html = await response.text();
      return { finalUrl: response.url || target, status: response.status, html };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Load failed";
    }
  }

  throw new Error(`Could not load that page. The site may be blocking crawlers or temporarily unavailable. (${lastError})`);
}

export async function runSeoAuditForUrl(rawUrl: string) {
    const url = normalizeAuditUrl(rawUrl);
    const [pageResult, mobile, desktop] = await Promise.allSettled([
      fetchAuditHtml(url),
      fetchPageSpeed(url, "mobile"),
      fetchPageSpeed(url, "desktop"),
    ]);
    const page = pageResult.status === "fulfilled" ? pageResult.value : null;
    const mobileResult = mobile.status === "fulfilled" ? mobile.value : await fetchPageSpeed(url, "mobile");
    const desktopResult = desktop.status === "fulfilled" ? desktop.value : await fetchPageSpeed(url, "desktop");
    const crawlError = pageResult.status === "rejected"
      ? pageResult.reason instanceof Error
        ? pageResult.reason.message
        : "Could not load that page."
      : undefined;

    return {
      requestedUrl: url,
      fetchedAt: new Date().toISOString(),
      httpStatus: page?.status ?? 0,
      onPage: page ? parseOnPage(page.html, page.finalUrl) : emptyOnPageReport(url),
      schema: page ? parseSchema(page.html) : [],
      pageSpeed: { mobile: mobileResult, desktop: desktopResult },
      accessibility: page ? auditAccessibility(page.html) : undefined,
      crawlError,
    };
}