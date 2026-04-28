export interface OnPageReport {
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

export interface PageSpeedReport {
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

export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

export interface SchemaItem {
  type: string;
  raw: JsonValue;
}

export interface AuditReport {
  requestedUrl: string;
  fetchedAt: string;
  httpStatus: number;
  onPage: OnPageReport;
  schema: SchemaItem[];
  pageSpeed: { mobile: PageSpeedReport; desktop: PageSpeedReport };
  crawlError?: string;
}

/** Lightweight per-page report used in site-wide scans (no PageSpeed to keep cost reasonable). */
export interface PageAuditReport {
  requestedUrl: string;
  fetchedAt: string;
  httpStatus: number;
  onPage: OnPageReport;
  schema: SchemaItem[];
  crawlError?: string;
}

export interface SiteAuditReport {
  rootUrl: string;
  fetchedAt: string;
  pagesRequested: number;
  pagesScanned: number;
  pages: PageAuditReport[];
  /** Total URLs Firecrawl discovered (may be larger than pagesScanned). */
  discoveredUrlCount: number;
  /** Full list of URLs Firecrawl discovered on the site (capped). */
  discoveredUrls: string[];
  /** PageSpeed for the root URL (run once to keep API costs reasonable). */
  homepageSpeed?: { mobile: PageSpeedReport; desktop: PageSpeedReport };
  warnings?: string[];
}
