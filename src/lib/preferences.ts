import { createHash } from "node:crypto";
import type { AppState, Feedback, Paper, Recommendation } from "./types";

export const preferencePolicy = "preferences-v1";
export type Interest = { id: string; label: string; strength: "stronger" | "normal" | "less" | "off"; /** Private, source-supported retrieval phrases. */ aliases?: string[] };
export type SuggestedInterest = { id: string; label: string; reason: string; evidence: {paperId: string; title: string}[] };
export type PreferenceSummary = { revision: number; learningFromReading: boolean; interests: Interest[];
  suggestedInterests?: SuggestedInterest[]; interestDiscoveryStatus?: "idle" | "queued" | "running" | "failed" };
export type PreferenceEvent = { id: string; paperId: string; kind: "save" | "prepare" | "reading" | "engaged" | "feedback"; at: string; value?: Feedback["value"]; day?: string; undoneAt?: string; recommendation?: Recommendation };
export type PaperFeatures = { version: "canonical-features-v1"; primaryInterests: string[]; digest: string; vocabularyDigest?: string; interests: string[]; mechanisms: string[] };
export type PreferenceLedger = PreferenceSummary & { version: 1; enabled: boolean; events: PreferenceEvent[]; features: Record<string, PaperFeatures>;
  interestDiscovery?: import("./interest-suggestions").InterestDiscoveryLedger };
const patterns = [
  ["world-models", "World models", /world models?|learned dynamics|latent dynamics|model-based (?:agents?|reinforcement)|generative (?:interactive )?environments?|dreamer|v-jepa|genie/i],
  ["sparse-compute", "Sparse compute and MoE", /mixture.of.experts?|\bmoe\b|expert (?:choice|routing)|sparse routing|conditional comput/i],
  ["linear-attention", "Linear attention", /linear attention|gated delta|delta(?:net|rule)|kimi linear|state.space models?|\bssm\b/i],
  ["systems", "Efficient model systems", /block.sparse|inference|distributed training|kv.cache|quantization|low.rank adaptation/i],
] as const;
const mechanismPatterns = [
  ["expert-choice", /expert choice/i],
  ["token-topk", /token.level routing|token.choice|top.[12k] (?:experts?|routing)|router selects two experts/i],
  ["sequence-routing", /sequence.level routing|route experts by sequence|seqtopk/i],
  ["load-balancing", /load.balanc|auxiliary.loss.free/i],
  ["linear-recurrence", /linear attention|delta(?:net|rule)|gated delta|state.space/i],
  ["latent-dynamics", /world model|latent dynamics|learned dynamics|dreamer|model-based reinforcement/i],
  ["visual-prediction", /video prediction|v-jepa|generative interactive|genie/i],
  ["network-operations", /netops|aiops|network operations/i],
  ["sparse-kernels", /block.sparse|megablocks/i],
  ["quantization", /quantization|quantized|qlora/i],
] as const;
/** Phrase matching adds owner-selected topics without making generated tags evidence. */
export function normalizeInterestText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function matchesInterest(text: string, interest: Interest) {
  const normalized = ` ${normalizeInterestText(text)} `;
  return [interest.label, ...(interest.aliases || [])].some(value => {
    const phrase = normalizeInterestText(value);
    return phrase.length >= 2 && normalized.includes(` ${phrase} `);
  });
}
export function canonicalFeatures(paper: Pick<Paper, "title" | "abstract">, interests: Interest[] = []): PaperFeatures {
  const text = `${paper.title}\n${paper.abstract}`;
  const dynamic = interests.filter(i => !patterns.some(([id]) => id === i.id));
  const primary = patterns.filter(([, , re]) => re.test(paper.title)).map(([id]) => id as string);
  const related = patterns.filter(([, , re]) => re.test(text)).map(([id]) => id as string);
  for (const interest of dynamic) {
    if (matchesInterest(paper.title, interest)) primary.push(interest.id);
    if (matchesInterest(text, interest)) related.push(interest.id);
  }
  // Metadata identity remains stable; the separate vocabulary digest invalidates cached matching.
  const vocabulary = dynamic.length ? "\n" + JSON.stringify(dynamic.map(({id,label,aliases}) => ({id,label,aliases})).sort((a,b) => a.id.localeCompare(b.id))) : "";
  return { version: "canonical-features-v1",primaryInterests: [...new Set(primary)],digest: createHash("sha256").update(preferencePolicy+"\n"+text).digest("hex"),
    ...(vocabulary ? {vocabularyDigest:createHash("sha256").update(vocabulary).digest("hex")} : {}),
    interests: [...new Set(related)], mechanisms: mechanismPatterns.filter(([, re]) => re.test(text)).map(([id]) => id) };
}
function addEvent(p: PreferenceLedger, e: PreferenceEvent) {
  if (p.events.some(x => x.id === e.id)) return false;
  p.events.push(e); p.revision++; return true;
}
/** Idempotent confirmed-action backfill. No historical open is inferred. */
export function ensurePreferences(s: AppState): PreferenceLedger {
  const p: PreferenceLedger = s.preferences ||= {version: 1, revision: 1, enabled: false, learningFromReading: true,
    interests: patterns.map(([id,label]) => ({id,label,strength: "normal" as const})), events: [], features: {}};
  for (const paper of s.papers) {
    const f = canonicalFeatures(paper, p.interests);
    if (p.features[paper.id]?.digest !== f.digest || p.features[paper.id]?.version !== f.version || p.features[paper.id]?.vocabularyDigest !== f.vocabularyDigest) {
      if (p.features[paper.id]) p.revision++;
      p.features[paper.id] = f;
    }
  }
  for (const e of Object.values(s.entries)) {
    addEvent(p, {id: `backfill:save:${e.paperId}`, paperId: e.paperId, kind: "save", at: e.savedAt});
    if (["reading","read"].includes(e.status)) addEvent(p, {id: `backfill:reading:${e.paperId}:${e.updatedAt}`, paperId: e.paperId, kind: "reading", at: e.updatedAt});
  }
  for (const j of s.jobs) if (j.paperId && ["generate","study"].includes(j.type)) {
    if (!p.events.some(e => e.paperId === j.paperId && e.kind === "prepare"))
      addEvent(p, {id: `backfill:prepare:${j.paperId}`, paperId: j.paperId, kind: "prepare", at: j.createdAt});
  }
  for (const f of s.feedback) {
    f.eventId ||= `legacy:${f.paperId}:${f.at}:${f.value}`;
    addEvent(p, {id: f.eventId, paperId: f.paperId, kind: "feedback", at: f.at, value: f.value, undoneAt: f.undoneAt});
  }
  // These are owner-stated choices, not fabricated reading activity.
  for (const paperId of ["2510.26692", "2412.19437"]) addEvent(p,
    {id: `owner-stated:${paperId}`, paperId, kind: "feedback", value: "useful", at: "2026-10-03T00:00:00.000Z"});
  return p;
}
export function preferenceSummary(s: AppState): PreferenceSummary {
  const p = ensurePreferences(s);
  const active = s.jobs.find(j => j.type === "interests" && ["queued", "running"].includes(j.status));
  const latest = [...s.jobs].reverse().find(j => j.type === "interests");
  const suggestedInterests = (p.interestDiscovery?.pending || []).filter(suggestion => suggestion.evidence.every(e =>
    p.features[e.paperId]?.digest === e.metadataDigest && paperSignal(p,e.paperId) >= .1 &&
    (p.learningFromReading || e.explicit))).map(suggestion => ({id: suggestion.id, label: suggestion.label,
      reason: suggestion.reason, evidence: suggestion.evidence.map(({paperId}) => ({paperId, title: s.papers.find(paper => paper.id === paperId)!.title}))}));
  return {revision: p.revision, learningFromReading: p.learningFromReading,
    interests: p.interests.map(({id,label,strength}) => ({id,label,strength})), suggestedInterests,
    interestDiscoveryStatus: active?.status === "running" ? "running" : active ? "queued" : latest?.status === "failed" ? "failed" : "idle"};
}
export function recordChoice(s: AppState, e: PreferenceEvent) {
  const p = ensurePreferences(s);
  if (e.kind === "prepare" && p.events.some(x => x.paperId === e.paperId && x.kind === "prepare")) return false;
  const existing = p.events.find(x => x.id === e.id);
  if (existing && e.recommendation) existing.recommendation = e.recommendation;
  return addEvent(p,e);
}
export function latestRatings(p: PreferenceLedger) {
  const latest = new Map<string, PreferenceEvent>();
  for (const e of p.events) if (e.kind === "feedback" && e.value !== "later" && !e.undoneAt) {
    const old = latest.get(e.paperId);
    if (!old || Date.parse(e.at) >= Date.parse(old.at)) latest.set(e.paperId,e);
  }
  return latest;
}
export function paperSignal(p: PreferenceLedger, paperId: string, now = Date.now()) {
  const rating = latestRatings(p).get(paperId);
  if (rating?.value === "useful") return 4;
  if (rating?.value === "irrelevant") return -0.5;
  if (rating?.value === "known" || rating?.value === "advanced") return 0;
  const decay = (at: string) => Math.pow(0.5, Math.max(0,now-Date.parse(at))/(90*86400000));
  const events = p.events.filter(e => e.paperId === paperId && !e.undoneAt);
  const implicit = Math.max(0,...events.filter(e => e.kind !== "feedback" && e.kind !== "engaged").map(e =>
    ({save: 1, prepare: 1.5, reading: 2}[e.kind as "save"|"prepare"|"reading"] || 0)*decay(e.at)));
  const passive = !p.learningFromReading ? 0 : Math.min(0.5, events.filter(e => e.kind === "engaged").reduce((sum,e) => sum+0.25*decay(e.at),0));
  return Math.max(implicit, passive);
}
/** Negative evidence transfers only through close canonical mechanisms. */
export function interestEligible(p: PreferenceLedger | undefined, f: PaperFeatures | undefined) {
  if (!p || !f) return true;
  const interests = f.primaryInterests.length ? f.primaryInterests : f.interests;
  return !interests.length || interests.some(id => p.interests.some(i => i.id === id && i.strength !== "off"));
}
export function learnedAdjustment(p: PreferenceLedger | undefined, f: PaperFeatures, now = Date.now()) {
  if (!p?.enabled) return 0;
  let evidence = 0;
  for (const id of new Set(p.events.map(e => e.paperId))) {
    const known = p.features[id]; if (!known) continue;
    const signal = paperSignal(p,id,now);
    const mechanismOverlap = known.mechanisms.filter(m => f.mechanisms.includes(m)).length;
    const overlap = signal < 0 ? mechanismOverlap > 0 : mechanismOverlap > 0 || known.interests.some(i => f.interests.includes(i));
    if (overlap) evidence += signal;
  }
  return Math.max(-0.05, Math.min(0.05, evidence*0.01));
}
export function recordEngagement(s: AppState, id: string, paperId: string, seconds: number, day: string, now: string) {
  const p = ensurePreferences(s);
  if (!p.enabled || !p.learningFromReading || seconds < 45 || day !== now.slice(0,10) || !s.papers.some(x => x.id === paperId)) return false;
  const previous = p.events.filter(e => e.paperId === paperId && e.kind === "engaged");
  if (previous.some(e => e.day === day || e.id === id)) return false;
  return addEvent(p,{id,paperId,kind: "engaged",day,at: now});
}
export function undoFeedback(s: AppState, eventId: string, now: string) {
  const p = ensurePreferences(s), e = p.events.find(x => x.id === eventId && x.kind === "feedback");
  if (!e || e.undoneAt) return false;
  // Do not roll a newer choice back when a late Undo arrives.
  if (latestRatings(p).get(e.paperId)?.id !== e.id) return false;
  e.undoneAt = now;
  if (e.recommendation && !s.entries[e.paperId]) s.recommendations = [e.recommendation,...s.recommendations.filter(r => r.paperId !== e.paperId)].slice(0,3);
  const f = s.feedback.find(x => x.eventId === eventId); if (f) f.undoneAt = now;
  p.revision++; return true;
}
