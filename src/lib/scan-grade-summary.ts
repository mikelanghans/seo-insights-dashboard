import type { AuditReport, SiteAuditReport } from "@/lib/seo-types";
import { computeGrade, computeSiteGrade } from "@/lib/seo-grade";

export interface ScanGradeSummary {
  grade_letter: string;
  grade_score: number;
}

function letterFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/** Compute the persistable grade summary for a site scan. */
export function summarizeSiteReport(report: SiteAuditReport): ScanGradeSummary {
  const g = computeSiteGrade(report);
  return { grade_letter: g.overall.letter, grade_score: g.overall.score };
}

/** Compute the persistable grade summary for a single-page scan. */
export function summarizePageReport(report: AuditReport): ScanGradeSummary {
  // For accessibility scans, grade by the a11y score so the badge reflects
  // what the scan actually measured (not unrelated SEO signals).
  if (report.auditType === "a11y" && report.accessibility) {
    const score = report.accessibility.score;
    return { grade_letter: letterFromScore(score), grade_score: score };
  }
  const g = computeGrade(report);
  return { grade_letter: g.letter, grade_score: g.score };
}
