import { z } from "zod";
import { recommendationSchema } from "../src/lib/scene";
import type { Recommendation } from "../src/lib/types";

/** Verified index metadata, never an AI estimate of a paper's popularity. */
export type PaperPopularity = { citedByCount: number; normalizedPercentile: number | null };

export const recommendationAssessmentSchema = z.object({
  recommendations: z.array(recommendationSchema.shape.recommendations.element.extend({
    relevance: z.number().min(0).max(1),
    nextStep: z.number().min(0).max(1),
    thread: z.enum(["main", "adjacent"]),
  })).max(12),
});

export function popularityScore(signal?: PaperPopularity) {
  // Missing index coverage is neutral. It does not mean zero citations.
  if (!signal) return 0.5;
  const citations = Math.min(1, Math.log10(1 + signal.citedByCount) / 4);
  return signal.normalizedPercentile === null ? citations
    : 0.6 * citations + 0.4 * signal.normalizedPercentile;
}

/** Relevance gates admission; measured influence contributes 20% of the rank. */
export function rankRecommendations(
  assessments: z.infer<typeof recommendationAssessmentSchema>["recommendations"],
  popularity: Record<string, PaperPopularity>,
  recentIds: Set<string>,
): Recommendation[] {
  const ranked = assessments.filter(rec => rec.relevance >= 0.6).map(rec => ({
    ...rec,
    score: 0.7 * rec.relevance + 0.1 * rec.nextStep + 0.2 * popularityScore(popularity[rec.paperId]),
  })).sort((a, b) => b.score - a.score || b.relevance - a.relevance || a.paperId.localeCompare(b.paperId));
  const selected = ranked.slice(0, 3);
  // Keep the adjacent exploration when it is a strong fit, and protect a strong
  // recent match from the cumulative-citation advantage of established work.
  const adjacent = ranked.find(rec => rec.thread === "adjacent" && rec.relevance >= 0.75);
  if (adjacent && selected.length === 3 && !selected.some(rec => rec.thread === "adjacent")) selected[2] = adjacent;
  const recent = ranked.find(rec => recentIds.has(rec.paperId) && rec.relevance >= 0.85);
  if (recent && selected.length === 3 && !selected.some(rec => recentIds.has(rec.paperId))) {
    const replace = selected[2].thread === "adjacent" && recent.thread !== "adjacent" ? 1 : 2;
    selected[replace] = recent;
  }
  return selected.map(({paperId, role, reason, focus, depth}) => ({paperId, role, reason, focus, depth}));
}
