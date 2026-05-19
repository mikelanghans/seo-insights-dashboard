import type { AuditReport, SiteAuditReport } from "@/lib/seo-types";
import { computeGrade, computeSiteGrade } from "@/lib/seo-grade";

export interface ScanGradeSummary {
  grade_letter: string;
  grade_score: number;
}

/** Compute the persistable grade summary for a site scan. */
export function summarizeSiteReport(report: SiteAuditReport): ScanGradeSummary {
  const g = computeSiteGrade(report);
  return { grade_letter: g.overall.letter, grade_score: g.overall.score };
}

/** Compute the persistable grade summary for a single-page scan. */
export function summarizePageReport(report: AuditReport): ScanGradeSummary {
  const g = computeGrade(report);
  return { grade_letter: g.letter, grade_score: g.score };
}
