// SEO Audit Edge Function
// Fetches a URL, parses on-page SEO, schema, and queries Google PageSpeed Insights.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OnPageReport {
  finalUrl: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  robots: string | null;
  lang: string | null;
  viewport: string | null;
  headings: { tag: "h1" | "h2" | "h3"; text: string }[];
  h1Count: number;
  images: { total: number; missingAlt: number; missingAltSrcs: string[] };
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
}

interface PageSpeedReport {
  strategy: "mobile" | "desktop";
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  metrics: {
    lcp: { value: string; score: number | null } | null;
    fid: { value: string; score: number | null } | null;
    cls: { value: string; score: number | null } | null;
    fcp: { value: string; score: number | null } | null;
    ttfb: { value: string; score: number | null } | null;
    inp: { value: string; score: number | null } | null;
  };
  error?: string;
}

interface SchemaItem {
  type: string;
  raw: unknown;
}

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

function parseOnPage(html: string, finalUrl: string): OnPageReport {
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

  const headings: { tag: "h1" | "h2" | "h3"; text: string }[] = [];
  for (const level of ["h1", "h2", "h3"] as const) {
    const re = new RegExp(`<${level}\\b[^>]*>([\\s\\S]*?)<\\/${level}>`, "gi");
    for (const m of html.matchAll(re)) {
      const text = decodeEntities(m[1].replace(/<[^>]+>/g, "").trim());
      if (text) headings.push({ tag: level, text: text.slice(0, 200) });
    }
  }
  const h1Count = headings.filter((h) => h.tag === "h1").length;

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
    h1Count,
    images: { total: imgTags.length, missingAlt, missingAltSrcs },
    openGraph,
    twitter,
  };
}

function parseSchema(html: string): SchemaItem[] {
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
          const t = obj["@type"];
          const type = Array.isArray(t) ? t.join(", ") : (t as string) || "Unknown";
          items.push({ type, raw: obj });
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

async function fetchPageSpeed(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedReport> {
  const apiKey = Deno.env.get("PAGESPEED_API_KEY");
  const params = new URLSearchParams({
    url,
    strategy,
  });
  for (const cat of ["performance", "seo", "accessibility", "best-practices"]) {
    params.append("category", cat);
  }
  if (apiKey) params.set("key", apiKey);

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      const txt = await res.text();
      return {
        strategy,
        performanceScore: null,
        seoScore: null,
        accessibilityScore: null,
        bestPracticesScore: null,
        metrics: { lcp: null, fid: null, cls: null, fcp: null, ttfb: null, inp: null },
        error: `PageSpeed API ${res.status}: ${txt.slice(0, 200)}`,
      };
    }
    const data = await res.json();
    const lh = data.lighthouseResult;
    const cats = lh?.categories ?? {};
    const audits = lh?.audits ?? {};
    const metric = (id: string) => {
      const a = audits[id];
      if (!a) return null;
      return { value: a.displayValue ?? "—", score: a.score ?? null };
    };
    return {
      strategy,
      performanceScore: cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
      seoScore: cats.seo?.score != null ? Math.round(cats.seo.score * 100) : null,
      accessibilityScore: cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null,
      bestPracticesScore: cats["best-practices"]?.score != null ? Math.round(cats["best-practices"].score * 100) : null,
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
      error: (e as Error).message,
    };
  }
}

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const parsed = new URL(u);
  return parsed.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = (body as { url?: string }).url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url' in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let url: string;
    try {
      url = normalizeUrl(rawUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fetchPage = (async () => {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SEOAuditBot/1.0; +https://lovable.app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      const html = await res.text();
      return { finalUrl: res.url || url, status: res.status, html };
    })();

    const [pageResult, mobile, desktop] = await Promise.all([
      fetchPage.catch((e) => ({ error: (e as Error).message })),
      fetchPageSpeed(url, "mobile"),
      fetchPageSpeed(url, "desktop"),
    ]);

    if ("error" in pageResult) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch page: ${pageResult.error}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const onPage = parseOnPage(pageResult.html, pageResult.finalUrl);
    const schema = parseSchema(pageResult.html);

    const report = {
      requestedUrl: url,
      fetchedAt: new Date().toISOString(),
      httpStatus: pageResult.status,
      onPage,
      schema,
      pageSpeed: { mobile, desktop },
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
