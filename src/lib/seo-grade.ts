import type { AuditReport } from "@/lib/seo-types";

export interface GradeBreakdown {
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
}

export interface OverallGrade {
  score: number; // 0-100
  letter: "A+" | "A" | "B" | "C" | "D" | "F";
  summary: string;
  breakdown: GradeBreakdown[];
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

function scoreOnPage(report: AuditReport): GradeBreakdown {
  const op = report.onPage;
  let s = 0;
  const parts: string[] = [];

  // Title (25)
  if (op.title) {
    if (op.titleLength >= 30 && op.titleLength <= 60) {
      s += 25;
    } else {
      s += 12;
      parts.push(`title length ${op.titleLength}`);
    }
  } else {
    parts.push("missing title");
  }

  // Meta description (25)
  if (op.metaDescription) {
    if (op.metaDescriptionLength >= 70 && op.metaDescriptionLength <= 160) {
      s += 25;
    } else {
      s += 12;
      parts.push(`meta length ${op.metaDescriptionLength}`);
    }
  } else {
    parts.push("missing meta description");
  }

  // H1 (15)
  if (op.h1Count === 1) s += 15;
  else if (op.h1Count > 1) {
    s += 6;
    parts.push(`${op.h1Count} H1s`);
  } else {
    parts.push("no H1");
  }

  // Canonical (10)
  if (op.canonical) s += 10;
  else parts.push("no canonical");

  // Viewport / lang (5 + 5)
  if (op.viewport) s += 5;
  else parts.push("no viewport");
  if (op.lang) s += 5;
  else parts.push("no lang");

  // Image alts (10)
  if (op.images.total === 0) {
    s += 10;
  } else {
    const ratio = 1 - op.images.missingAlt / op.images.total;
    s += Math.round(10 * ratio);
    if (op.images.missingAlt > 0) parts.push(`${op.images.missingAlt} images missing alt`);
  }

  // Open Graph (5)
  if (Object.keys(op.openGraph).length >= 3) s += 5;
  else parts.push("incomplete OG tags");

  return {
    label: "On-Page SEO",
    score: clamp(s),
    weight: 0.32,
    detail: parts.length ? parts.slice(0, 3).join(", ") : "All key on-page signals present",
  };
}

function scoreSpeed(report: AuditReport): GradeBreakdown {
  const m = report.pageSpeed.mobile;
  const d = report.pageSpeed.desktop;
  const vals: number[] = [];
  if (typeof m.performanceScore === "number") vals.push(m.performanceScore);
  if (typeof d.performanceScore === "number") vals.push(d.performanceScore);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  return {
    label: "Page Speed",
    score: clamp(Math.round(avg)),
    weight: 0.33,
    detail: vals.length
      ? `Mobile ${m.performanceScore ?? "—"} · Desktop ${d.performanceScore ?? "—"}`
      : "PageSpeed data unavailable",
  };
}

function scoreSchema(report: AuditReport): GradeBreakdown {
  const count = report.schema.length;
  let s = 0;
  if (count >= 3) s = 100;
  else if (count === 2) s = 80;
  else if (count === 1) s = 60;
  else s = 0;
  return {
    label: "Structured Data",
    score: s,
    weight: 0.1,
    detail: count ? `${count} schema item${count > 1 ? "s" : ""} detected` : "No JSON-LD schema found",
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

function scoreAEO(report: AuditReport): GradeBreakdown {
  const op = report.onPage;
  let s = 0;
  const parts: string[] = [];

  // 1) AEO-friendly schema (30)
  const types = report.schema.map((s) => s.type);
  const aeoTypes = types.filter((t) => AEO_SCHEMA_TYPES.has(t));
  const hasFAQorQA = aeoTypes.some((t) => t === "FAQPage" || t === "QAPage" || t === "HowTo");
  if (hasFAQorQA) s += 30;
  else if (aeoTypes.length >= 2) s += 22;
  else if (aeoTypes.length === 1) s += 14;
  else parts.push("no AEO-friendly schema (FAQ, HowTo, Article…)");

  // 2) Question-style headings — answer engines love Q&A structure (20)
  const subheads = op.headings.filter((h) => h.tag === "h2" || h.tag === "h3");
  const questionHeads = subheads.filter((h) => QUESTION_RE.test(h.text.trim()));
  if (questionHeads.length >= 3) s += 20;
  else if (questionHeads.length >= 1) s += 12;
  else parts.push("no question-style H2/H3s");

  // 3) Clean heading hierarchy: exactly one H1 + has H2s (15)
  const h2Count = op.headings.filter((h) => h.tag === "h2").length;
  if (op.h1Count === 1 && h2Count >= 2) s += 15;
  else if (op.h1Count === 1 && h2Count >= 1) s += 9;
  else parts.push("weak heading hierarchy");

  // 4) Substantive, descriptive meta description (answer-snippet ready) (10)
  if (op.metaDescription && op.metaDescriptionLength >= 100 && op.metaDescriptionLength <= 200) {
    s += 10;
  } else if (op.metaDescription) {
    s += 5;
  } else {
    parts.push("meta description not snippet-ready");
  }

  // 5) Title clarity for AEO — descriptive length (10)
  if (op.title && op.titleLength >= 25 && op.titleLength <= 70) s += 10;
  else if (op.title) s += 5;

  // 6) Language declared — required for multilingual answer engines (5)
  if (op.lang) s += 5;
  else parts.push("missing lang attribute");

  // 7) Canonical — prevents duplicate-answer confusion (5)
  if (op.canonical) s += 5;

  // 8) Author/Org entity signal via schema (5)
  if (types.includes("Organization") || types.includes("Person")) s += 5;
  else parts.push("no Organization/Person entity");

  return {
    label: "AEO (Answer Engine)",
    score: clamp(s),
    weight: 0.25,
    detail: parts.length
      ? parts.slice(0, 3).join(", ")
      : `${aeoTypes.length} AEO schema · ${questionHeads.length} question heading${questionHeads.length === 1 ? "" : "s"}`,
  };
}

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
  return { score, letter, summary, breakdown };
}
