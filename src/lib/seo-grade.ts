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
    weight: 0.4,
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
    weight: 0.45,
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
    weight: 0.15,
    detail: count ? `${count} schema item${count > 1 ? "s" : ""} detected` : "No JSON-LD schema found",
  };
}

export function computeGrade(report: AuditReport): OverallGrade {
  const breakdown = [scoreOnPage(report), scoreSpeed(report), scoreSchema(report)];
  const total = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  const score = Math.round(total);
  const letter = letterFor(score);
  const summary =
    score >= 85
      ? "Excellent — this page is in great SEO shape."
      : score >= 70
      ? "Good — a few targeted improvements will lift this further."
      : score >= 50
      ? "Needs work — address the issues below to improve rankings."
      : "Critical — major SEO issues are holding this page back.";
  return { score, letter, summary, breakdown };
}
