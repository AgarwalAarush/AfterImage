import { z } from "zod";
import { recommendationSchema } from "../src/lib/scene";
import { canonicalFeatures, learnedAdjustment, interestEligible, type PreferenceLedger, type PaperFeatures } from "../src/lib/preferences";
import type { Paper, Recommendation } from "../src/lib/types";
export type PaperPopularity = { citedByCount: number; normalizedPercentile: number | null; openAlexId?: string; verifiedAt?: string };
export const recommendationAssessmentSchema = z.object({
  recommendations: z.array(recommendationSchema.shape.recommendations.element.extend({
    relevance: z.number().min(0).max(1), nextStep: z.number().min(0).max(1),
    thread: z.enum(["main","adjacent"]), interestId: z.string().max(60).optional(),
  })).max(12),
});
export type Assessment = z.infer<typeof recommendationAssessmentSchema>["recommendations"][number];
export type RankingOptions = { vacancies?: number; retained?: Recommendation[]; papers?: Paper[]; profile?: PreferenceLedger; now?: number };
export function popularityScore(signal?: PaperPopularity) {
  if (!signal) return 0; // Unknown coverage receives no popularity bonus.
  const citations = Math.min(1,Math.log10(1+signal.citedByCount)/4);
  return signal.normalizedPercentile === null ? citations : 0.6*citations+0.4*signal.normalizedPercentile;
}
export function rankWithReceipt(assessments: Assessment[], popularity: Record<string,PaperPopularity>, options: RankingOptions = {}) {
  const features = new Map((options.papers || []).map(p => [p.id,canonicalFeatures(p)]));
  const inputs = assessments.map(rec => {
    const f = features.get(rec.paperId) || {version: "canonical-features-v1" as const,primaryInterests: [],digest: "0".repeat(64),interests: [],mechanisms: []};
    const interest = options.profile?.interests.find(i => i.id === rec.interestId);
    const eligible = rec.relevance >= 0.6 && interestEligible(options.profile,f) && (!options.profile || ((rec.interestId === "research-direction" && !f.interests.length) ||
      Boolean(interest && interest.strength !== "off" && f.interests.includes(interest.id))));
    const adjustment = Math.max(-0.05,Math.min(0.05,learnedAdjustment(options.profile,f,options.now)+
      (interest?.strength === "stronger" ? 0.02 : interest?.strength === "less" ? -0.02 : 0)));
    const score = .7*rec.relevance+.1*rec.nextStep+.2*popularityScore(popularity[rec.paperId])+adjustment;
    return {rec,f,eligible,score,receipt: {paperId: rec.paperId,metadataDigest: f.digest,relevance: rec.relevance,
      nextStep: rec.nextStep,citationCount: popularity[rec.paperId]?.citedByCount ?? null,
      normalizedPercentile: popularity[rec.paperId]?.normalizedPercentile ?? null,openAlexId: popularity[rec.paperId]?.openAlexId ?? null,
      verifiedAt: popularity[rec.paperId]?.verifiedAt ?? null,popularity: popularity[rec.paperId] ? popularityScore(popularity[rec.paperId]) : null,adjustment,score}};
  });
  const seen = new Set((options.retained || []).map(r => r.paperId));
  const ranked = inputs.filter(x => x.eligible && !seen.has(x.rec.paperId)).sort((a,b) => b.score-a.score || a.rec.paperId.localeCompare(b.rec.paperId));
  const selected: Recommendation[] = [], context: PaperFeatures[] = (options.retained || []).flatMap(r => features.get(r.paperId) || []);
  const overlap = (f: PaperFeatures) => context.reduce((sum,c) => sum+(f.mechanisms.some(m => c.mechanisms.includes(m)) ? 1 : 0),0);
  for (let slot=0;slot<Math.max(0,Math.min(3,options.vacancies ?? 3));slot++) {
    const available = ranked.filter(x => !seen.has(x.rec.paperId)); if (!available.length) break;
    // Diversity only breaks close scores, and considers actual retained cards.
    const close = available.filter(x => available[0].score-x.score <= .035);
    close.sort((a,b) => (b.score-.015*overlap(b.f))-(a.score-.015*overlap(a.f)) || a.rec.paperId.localeCompare(b.rec.paperId));
    const pick = close[0];seen.add(pick.rec.paperId);context.push(pick.f);
    const {paperId,role,reason,focus,depth} = pick.rec; selected.push({paperId,role,reason,focus,depth});
  }
  return {recommendations: selected,ranking: inputs.map(x => x.receipt)};
}
export function rankRecommendations(assessments: Assessment[], popularity: Record<string,PaperPopularity>, _recentIds: Set<string>, options: RankingOptions = {}) {
  return rankWithReceipt(assessments,popularity,options).recommendations;
}
