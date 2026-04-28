import type { AuditReport, PageAuditReport, SiteAuditReport } from "@/lib/seo-types";

/** Subset of AuditReport fields needed for non-speed scoring. */
type PageLike = Pick<AuditReport, "onPage" | "schema">;

export type IssueSeverity = "critical" | "warning" | "info";

export interface Issue {
  severity: IssueSeverity;
  title: string;
  description: string;
  fix: string;
}

export interface GradeBreakdown {
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
  issues: Issue[];
}

export interface OverallGrade {
  score: number; // 0-100
  letter: "A+" | "A" | "B" | "C" | "D" | "F";
  summary: string;
  breakdown: GradeBreakdown[];
  topIssues: Issue[];
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function letterFor(score: number): OverallGrade["letter"] {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

function scoreOnPage(report: PageLike): GradeBreakdown {
  const op = report.onPage;
  let s = 0;
  const issues: Issue[] = [];

  // Title (25)
  if (op.title) {
    if (op.titleLength >= 30 && op.titleLength <= 60) {
      s += 25;
    } else {
      s += 12;
      issues.push({
        severity: "warning",
        title: `Title tag length is ${op.titleLength} characters`,
        description:
          op.titleLength < 30
            ? "Your title is too short to clearly describe the page and capture relevant keywords."
            : "Your title may get truncated in search results, hiding important context.",
        fix: "Aim for 30–60 characters. Lead with the primary keyword and include your brand at the end.",
      });
    }
  } else {
    issues.push({
      severity: "critical",
      title: "Missing <title> tag",
      description: "Without a title tag, search engines have no clear label for this page in results.",
      fix: "Add a unique <title> in the <head> describing the page (30–60 characters).",
    });
  }

  // Meta description (25)
  if (op.metaDescription) {
    if (op.metaDescriptionLength >= 70 && op.metaDescriptionLength <= 160) {
      s += 25;
    } else {
      s += 12;
      issues.push({
        severity: "warning",
        title: `Meta description length is ${op.metaDescriptionLength} characters`,
        description:
          op.metaDescriptionLength < 70
            ? "Description is too short to be useful as a search snippet."
            : "Description is too long and will likely be truncated in search results.",
        fix: "Write a compelling 70–160 character summary including the primary keyword and a clear value proposition.",
      });
    }
  } else {
    issues.push({
      severity: "critical",
      title: "Missing meta description",
      description: "Without a meta description, Google generates one from page text — often poorly.",
      fix: 'Add <meta name="description" content="…"> with a 70–160 character summary of the page.',
    });
  }

  // H1 (15)
  if (op.h1Count === 1) {
    s += 15;
  } else if (op.h1Count > 1) {
    s += 6;
    issues.push({
      severity: "warning",
      title: `Page has ${op.h1Count} H1 tags`,
      description: "Multiple H1s dilute the primary topic signal for search engines and screen readers.",
      fix: "Keep exactly one H1 per page describing the main topic. Demote the others to H2.",
    });
  } else {
    issues.push({
      severity: "critical",
      title: "No H1 heading on the page",
      description: "The H1 is the strongest on-page signal of what your page is about.",
      fix: "Add a single, descriptive <h1> at the top of the main content with the primary keyword.",
    });
  }

  // Canonical (10)
  if (op.canonical) s += 10;
  else
    issues.push({
      severity: "warning",
      title: "Missing canonical URL",
      description: "Without a canonical, duplicate or parameterized URLs can split ranking signals.",
      fix: 'Add <link rel="canonical" href="https://your-domain.com/this-page"> in the <head>.',
    });

  // Viewport (5)
  if (op.viewport) s += 5;
  else
    issues.push({
      severity: "critical",
      title: "Missing viewport meta tag",
      description: "Without it, the page won't render correctly on mobile — a Google ranking factor.",
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> in the <head>.',
    });

  // Lang (5)
  if (op.lang) s += 5;
  else
    issues.push({
      severity: "warning",
      title: "Missing <html lang> attribute",
      description: "Search engines and assistive tech rely on this to know the page's language.",
      fix: 'Set the language on the root element, e.g. <html lang="en">.',
    });

  // Image alts (10)
  if (op.images.total === 0) {
    s += 10;
  } else {
    const ratio = 1 - op.images.missingAlt / op.images.total;
    s += Math.round(10 * ratio);
    if (op.images.missingAlt > 0) {
      issues.push({
        severity: op.images.missingAlt >= 5 ? "warning" : "info",
        title: `${op.images.missingAlt} of ${op.images.total} images missing alt text`,
        description:
          "Alt text helps search engines understand images and is required for accessibility.",
        fix: 'Add a descriptive alt="…" attribute to every meaningful <img>. Use alt="" for decorative images.',
      });
    }
  }

  // Open Graph (5)
  if (Object.keys(op.openGraph).length >= 3) {
    s += 5;
  } else {
    issues.push({
      severity: "info",
      title: "Incomplete Open Graph tags",
      description: "OG tags control how your page looks when shared on social media and in chats.",
      fix: "Add og:title, og:description, og:image, and og:url meta tags in the <head>.",
    });
  }

  return {
    label: "On-Page SEO",
    score: clamp(s),
    weight: 0.32,
    detail: issues.length
      ? `${issues.length} issue${issues.length === 1 ? "" : "s"} to address`
      : "All key on-page signals present",
    issues,
  };
}

function scoreSpeed(report: AuditReport): GradeBreakdown {
  const m = report.pageSpeed.mobile;
  const d = report.pageSpeed.desktop;
  const vals: number[] = [];
  if (typeof m.performanceScore === "number") vals.push(m.performanceScore);
  if (typeof d.performanceScore === "number") vals.push(d.performanceScore);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const score = clamp(Math.round(avg));
  const issues: Issue[] = [];

  if (!vals.length) {
    issues.push({
      severity: "info",
      title: "PageSpeed data unavailable",
      description: "We couldn't reach the PageSpeed Insights API for this URL.",
      fix: "Re-run the audit. If it persists, the page may be blocking automated testing.",
    });
  } else {
    if (typeof m.performanceScore === "number" && m.performanceScore < 70) {
      issues.push({
        severity: m.performanceScore < 50 ? "critical" : "warning",
        title: `Mobile performance score is ${m.performanceScore}`,
        description:
          "Mobile is Google's primary index — slow mobile pages directly hurt rankings and conversions.",
        fix: "Compress images (use AVIF/WebP), defer unused JavaScript, and enable text compression. See the Page Speed tab for the slowest metrics.",
      });
    }
    if (typeof d.performanceScore === "number" && d.performanceScore < 80) {
      issues.push({
        severity: d.performanceScore < 60 ? "warning" : "info",
        title: `Desktop performance score is ${d.performanceScore}`,
        description: "Desktop performance affects user experience and bounce rate.",
        fix: "Reduce render-blocking resources and optimize the Largest Contentful Paint (LCP) element.",
      });
    }

    // Core Web Vitals callouts (mobile)
    const lcpScore = m.metrics.lcp?.score;
    if (typeof lcpScore === "number" && lcpScore < 0.5) {
      issues.push({
        severity: "warning",
        title: `Poor Largest Contentful Paint on mobile (${m.metrics.lcp?.value})`,
        description: "LCP measures when the main content becomes visible. Slow LCP frustrates users.",
        fix: "Preload the LCP image, serve it from a CDN, and remove render-blocking CSS/JS above the fold.",
      });
    }
    const clsScore = m.metrics.cls?.score;
    if (typeof clsScore === "number" && clsScore < 0.5) {
      issues.push({
        severity: "warning",
        title: `Layout shift detected on mobile (${m.metrics.cls?.value})`,
        description: "Content jumping during load makes the page feel broken and hurts Core Web Vitals.",
        fix: "Set explicit width/height on images and ads, and reserve space for dynamically injected content.",
      });
    }
  }

  return {
    label: "Page Speed",
    score,
    weight: 0.33,
    detail: vals.length
      ? `Mobile ${m.performanceScore ?? "—"} · Desktop ${d.performanceScore ?? "—"}`
      : "PageSpeed data unavailable",
    issues,
  };
}

function scoreSchema(report: PageLike): GradeBreakdown {
  const count = report.schema.length;
  const issues: Issue[] = [];
  let s = 0;
  if (count >= 3) s = 100;
  else if (count === 2) s = 80;
  else if (count === 1) s = 60;
  else s = 0;

  if (count === 0) {
    issues.push({
      severity: "warning",
      title: "No structured data (JSON-LD) found",
      description:
        "Schema markup unlocks rich results in Google (stars, FAQs, breadcrumbs) and helps AI engines understand your content.",
      fix: "Add JSON-LD for the page type — at minimum Organization and WebSite, plus Article, Product, or FAQPage as relevant.",
    });
  } else if (count === 1) {
    issues.push({
      severity: "info",
      title: "Only one schema type detected",
      description: "Pages typically benefit from multiple complementary schema types.",
      fix: "Layer in additional schemas like BreadcrumbList, Organization, or FAQPage where applicable.",
    });
  }

  return {
    label: "Structured Data",
    score: s,
    weight: 0.1,
    detail: count ? `${count} schema item${count > 1 ? "s" : ""} detected` : "No JSON-LD schema found",
    issues,
  };
}

// Schema types that strongly help Answer Engines (ChatGPT, Perplexity, Google AI Overviews)
const AEO_SCHEMA_TYPES = new Set([
  "FAQPage",
  "QAPage",
  "HowTo",
  "Article",
  "NewsArticle",
  "BlogPosting",
  "Product",
  "Organization",
  "Person",
  "BreadcrumbList",
  "WebSite",
  "Recipe",
  "Event",
  "LocalBusiness",
]);

const QUESTION_RE = /^(who|what|when|where|why|how|can|do|does|is|are|should|will|which)\b|\?\s*$/i;

function scoreAEO(report: PageLike): GradeBreakdown {
  const op = report.onPage;
  let s = 0;
  const issues: Issue[] = [];

  // 1) AEO-friendly schema (30)
  const types = report.schema.map((s) => s.type);
  const aeoTypes = types.filter((t) => AEO_SCHEMA_TYPES.has(t));
  const hasFAQorQA = aeoTypes.some((t) => t === "FAQPage" || t === "QAPage" || t === "HowTo");
  if (hasFAQorQA) s += 30;
  else if (aeoTypes.length >= 2) s += 22;
  else if (aeoTypes.length === 1) s += 14;
  else
    issues.push({
      severity: "warning",
      title: "No AEO-friendly schema detected",
      description:
        "Answer engines (ChatGPT, Perplexity, Google AI Overviews) rely on schema like FAQPage, HowTo, and Article to extract and cite your content.",
      fix: "Add JSON-LD for FAQPage (for Q&A sections), HowTo (for step-by-step guides), or Article (for editorial content).",
    });

  // 2) Question-style headings (20)
  const subheads = op.headings.filter((h) => h.tag === "h2" || h.tag === "h3");
  const questionHeads = subheads.filter((h) => QUESTION_RE.test(h.text.trim()));
  if (questionHeads.length >= 3) s += 20;
  else if (questionHeads.length >= 1) s += 12;
  else
    issues.push({
      severity: "warning",
      title: "No question-style headings (H2/H3)",
      description:
        "AI search engines prefer pages structured as direct Q&A — they lift these as cited answers.",
      fix: 'Reframe key subheadings as the questions your audience asks, e.g. "How does X work?" or "What is Y?".',
    });

  // 3) Heading hierarchy (15)
  const h2Count = op.headings.filter((h) => h.tag === "h2").length;
  if (op.h1Count === 1 && h2Count >= 2) {
    s += 15;
  } else if (op.h1Count === 1 && h2Count >= 1) {
    s += 9;
    issues.push({
      severity: "info",
      title: "Thin heading structure",
      description: "Pages with only one H2 are harder for AI engines to break into cite-able sections.",
      fix: "Add 2–5 descriptive H2s that map to the page's main subtopics.",
    });
  } else {
    issues.push({
      severity: "warning",
      title: "Weak heading hierarchy",
      description:
        "AI engines extract answers along heading boundaries — a flat or broken hierarchy hides your content.",
      fix: "Use one H1 for the page topic, then H2s for major sections and H3s for sub-points.",
    });
  }

  // 4) Snippet-ready meta description (10)
  if (op.metaDescription && op.metaDescriptionLength >= 100 && op.metaDescriptionLength <= 200) {
    s += 10;
  } else if (op.metaDescription) {
    s += 5;
    issues.push({
      severity: "info",
      title: "Meta description not snippet-ready",
      description:
        "Answer engines often quote the meta description verbatim — too short or long reduces the chance of being cited cleanly.",
      fix: "Aim for 100–200 characters that directly answer the page's core question.",
    });
  }

  // 5) Title clarity (10)
  if (op.title && op.titleLength >= 25 && op.titleLength <= 70) s += 10;
  else if (op.title) s += 5;

  // 6) Language (5)
  if (op.lang) s += 5;
  // (covered by On-Page issue if missing)

  // 7) Canonical (5)
  if (op.canonical) s += 5;

  // 8) Entity signal (5)
  if (types.includes("Organization") || types.includes("Person")) {
    s += 5;
  } else {
    issues.push({
      severity: "info",
      title: "No Organization or Person schema",
      description:
        "Answer engines build entity graphs — without an Organization/Person schema, your brand is harder to attribute as a source.",
      fix: 'Add JSON-LD with @type "Organization" (with name, url, logo, sameAs) on key pages.',
    });
  }

  return {
    label: "AEO (Answer Engine)",
    score: clamp(s),
    weight: 0.25,
    detail: issues.length
      ? `${issues.length} issue${issues.length === 1 ? "" : "s"} to address`
      : `${aeoTypes.length} AEO schema · ${questionHeads.length} question heading${questionHeads.length === 1 ? "" : "s"}`,
    issues,
  };
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function computeGrade(report: AuditReport): OverallGrade {
  const breakdown = [scoreOnPage(report), scoreSpeed(report), scoreSchema(report), scoreAEO(report)];
  const total = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  const score = Math.round(total);
  const letter = letterFor(score);
  const summary =
    score >= 85
      ? "Excellent — strong SEO and AEO signals across the board."
      : score >= 70
      ? "Good — a few targeted improvements will lift SEO & AEO further."
      : score >= 50
      ? "Needs work — gaps in SEO and answer-engine readiness."
      : "Critical — major SEO/AEO issues are holding this page back.";

  const topIssues = breakdown
    .flatMap((b) => b.issues)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return { score, letter, summary, breakdown, topIssues };
}
