import { createHash } from "node:crypto";
import { z } from "zod";
import { ensurePreferences, latestRatings, normalizeInterestText, paperSignal } from "./preferences";
import type { Interest } from "./preferences";
import type { AppState, Job } from "./types";

export const interestSuggestionPolicy = "interest-suggestions-v1";
export const interestSuggestionResultSchema = z.object({ candidates: z.array(z.object({
  label: z.string().trim().min(2).max(70),
  aliases: z.array(z.string().trim().min(2).max(70)).max(6),
  reason: z.string().trim().min(10).max(280),
  evidence: z.array(z.object({paperId: z.string().min(1).max(40), quote: z.string().trim().min(12).max(400)})).min(2).max(6),
})).max(5) });
export type InterestSuggestionResult = z.infer<typeof interestSuggestionResultSchema>;
type Evidence = {paperId: string; title: string; metadataDigest: string; quote: string; explicit: boolean};
type PendingInterest = {id: string; key: string; label: string; aliases: string[]; reason: string; evidence: Evidence[]; createdAt: string};
type TopicIdentity = {label: string; aliases: string[]};
export type InterestDiscoveryLedger = {
  version: 1;
  pending: PendingInterest[];
  ignored: (TopicIdentity & {key: string; at: string; interestId?: string})[];
  decisions: Record<string, {action: "manual" | "add" | "ignore" | "refresh" | "remove"; target: string; at: string; interestId?: string; queued?: boolean}>;
  processedFingerprint?: string;
  attemptedFingerprints?: string[];
  receipts: {policy: string; at: string; fingerprint: string; outcome: "published" | "stale" | "disabled"; accepted: string[]; omitted: number}[];
};
function ledger(s: AppState) {
  return ensurePreferences(s).interestDiscovery ||= {version: 1, pending: [], ignored: [], decisions: {}, receipts: []};
}
function hash(text: string) { return createHash("sha256").update(text).digest("hex"); }
function cleanLabel(label: string) {
  const clean = label.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 70 || /[\p{Cc}\p{Cf}]/u.test(clean) || !/[\p{L}\p{N}]/u.test(clean))
    throw new Error("Use an interest name between 2 and 70 characters.");
  return clean;
}
function topicKey(label: string) {
  return normalizeInterestText(label).split(" ").map(word => word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0,-1) : word).join(" ");
}
function identities(topic: TopicIdentity) { return new Set([topic.label,...topic.aliases].map(topicKey).filter(Boolean)); }
function overlaps(left: TopicIdentity, right: TopicIdentity) {
  const a = identities(left); return [...identities(right)].some(key => a.has(key));
}
function explicitChoice(s: AppState, paperId: string, now: number) {
  const p = ensurePreferences(s);
  return latestRatings(p).get(paperId)?.value === "useful" || p.events.some(e => {
    if (e.paperId !== paperId || e.undoneAt || !["save","prepare","reading"].includes(e.kind)) return false;
    const weight = {save:1,prepare:1.5,reading:2}[e.kind as "save"|"prepare"|"reading"];
    return weight*Math.pow(.5,Math.max(0,now-Date.parse(e.at))/(90*86400000)) >= .1;
  });
}
/** The model receives only actual positive choices and canonical paper metadata. */
export function interestSuggestionInput(s: AppState, now = Date.now()) {
  const p = ensurePreferences(s), d = ledger(s);
  const eligible = s.papers.map(paper => ({id: paper.id, title: paper.title, abstract: paper.abstract,
    metadataDigest: p.features[paper.id].digest, signal: paperSignal(p,paper.id,now), explicit: explicitChoice(s,paper.id,now)}))
    .filter(paper => paper.signal >= .1 && paper.abstract.trim().length >= 20);
  const recency = new Map<string,number>();
  for (const e of p.events) if (!e.undoneAt && (p.learningFromReading || e.kind !== "engaged") &&
    (e.kind !== "feedback" || e.value === "useful")) recency.set(e.paperId,Math.max(recency.get(e.paperId) || 0,Date.parse(e.at)));
  // Reserve half the bounded context for recent activity so an old collection of
  // Useful papers cannot permanently crowd out a newly emerging subject.
  const recent = [...eligible].sort((a,b) => (recency.get(b.id)||0)-(recency.get(a.id)||0) || a.id.localeCompare(b.id)).slice(0,30);
  const selected = new Set(recent.map(paper => paper.id));
  const strongest = eligible.filter(paper => !selected.has(paper.id)).sort((a,b) => b.signal-a.signal || a.id.localeCompare(b.id)).slice(0,60-recent.length);
  const papers = [...recent,...strongest];
  const interests = p.interests.map(({id,label,strength,aliases}) => ({id,label,strength,aliases: aliases || []}));
  const ignored = d.ignored.map(({label,aliases}) => ({label,aliases}));
  // Time alone must not enqueue work every heartbeat; current evidence identities and
  // feedback changes still invalidate a claim, including withdrawal and reading opt-out.
  const evidenceIds = new Set(papers.map(paper => paper.id));
  const events = p.events.filter(e => evidenceIds.has(e.paperId) && (p.learningFromReading || e.kind !== "engaged"))
    .map(({id,paperId,kind,value,at,undoneAt}) => ({id,paperId,kind,value,at,undoneAt}));
  const digest = hash(JSON.stringify({policy: interestSuggestionPolicy, enabled: p.enabled,
    reading: p.learningFromReading, papers: papers.map(({signal,...paper}) => paper), events, interests, ignored}));
  return {digest,papers,interests,ignored};
}
export type InterestSuggestionInput = ReturnType<typeof interestSuggestionInput>;
export function sufficientInterestEvidence(papers: InterestSuggestionInput["papers"]) {
  if (papers.length < 2) return false;
  if (papers.filter(paper => paper.explicit).length >= 2) return true;
  return papers.length >= 4 && papers.reduce((sum,paper) => sum+paper.signal,0) >= 1.5;
}
export function canDiscoverInterests(s: AppState, now = Date.now()) {
  return ensurePreferences(s).enabled && sufficientInterestEvidence(interestSuggestionInput(s,now).papers);
}
/** Automatic inference is coalesced, evidence-driven and distinct from reading-kit jobs. */
export function queueInterestDiscovery(s: AppState, now: string, id: () => string, options: {force?: boolean; followup?: boolean} = {}) {
  const p = ensurePreferences(s), d = ledger(s), input = interestSuggestionInput(s,Date.parse(now));
  if (!p.enabled || !sufficientInterestEvidence(input.papers)) return false;
  if (s.jobs.some(j => j.type === "interests" && ["queued","running"].includes(j.status))) return false;
  const previous = [...s.jobs].reverse().find(j => j.type === "interests");
  if (!options.force && (d.processedFingerprint === input.digest || d.attemptedFingerprints?.includes(input.digest) || s.jobs.some(j => j.type === "interests" && j.interestEvidenceFingerprint === input.digest))) return false;
  if (options.force && previous && Date.parse(now)-Date.parse(previous.createdAt) < 60000) throw new Error("Wait a minute before checking for interests again.");
  const recent = s.jobs.filter(j => Date.parse(now)-Date.parse(j.createdAt) < 3600000);
  if (recent.length >= 12 || recent.filter(j => j.type === "interests").length >= 2) {
    if (options.force) throw new Error("Interest checks are taking a short break. Try again in an hour.");
    return false;
  }
  d.attemptedFingerprints ||= [];
  if (!d.attemptedFingerprints.includes(input.digest)) d.attemptedFingerprints.push(input.digest);
  s.jobs.push({id: id(), type: "interests", status: "queued", createdAt: now, attempts: 0,
    interestEvidenceFingerprint: input.digest, ...(options.followup ? {interestFollowup: true} : {})});
  s.jobs = s.jobs.slice(-100);
  return true;
}
function existingInterest(interests: Interest[], topic: TopicIdentity) {
  return interests.find(interest => overlaps({label: interest.label, aliases: interest.aliases || []},topic));
}
function rememberDecision(s: AppState, eventId: string, action: "manual"|"add"|"ignore"|"refresh"|"remove", target: string) {
  const d = ledger(s), old = d.decisions[eventId];
  if (old && (old.action !== action || old.target !== target)) throw new Error("Interest action already used.");
  return old;
}
/** Replaying the same explicit check cannot schedule a second model call. */
export function requestInterestDiscovery(s: AppState, eventId: string, now: string, id: () => string) {
  const previous = rememberDecision(s,eventId,"refresh","refresh");
  if (previous) return previous.queued || false;
  const queued = queueInterestDiscovery(s,now,id,{force:true});
  ledger(s).decisions[eventId] = {action:"refresh",target:"refresh",at:now,queued};
  return queued;
}
function insertInterest(s: AppState, topic: TopicIdentity) {
  const p = ensurePreferences(s), d = ledger(s);
  let interest = existingInterest(p.interests,topic);
  if (interest) {
    // An explicit Add restores a paused matching interest without creating duplicates.
    if (interest.strength === "off") interest.strength = "normal";
  } else {
    if (p.interests.length >= 24) throw new Error("You can keep up to 24 reading interests.");
    const retired = d.ignored.find(item => item.interestId && overlaps(item,topic));
    interest = {id: retired?.interestId || `topic-${hash(topicKey(topic.label)).slice(0,20)}`,label: topic.label,strength: "normal",aliases: [...new Set([...topic.aliases,...(retired?.aliases || [])])]};
    p.interests.push(interest);
  }
  d.pending = d.pending.filter(item => !overlaps(item,topic));
  d.ignored = d.ignored.filter(item => !overlaps(item,topic));
  p.revision++;
  ensurePreferences(s); // Rebind canonical feature cache to the accepted vocabulary.
  return interest;
}
/** Manual interests are unrestricted research topics; adding never implies reading. */
export function addInterest(s: AppState, label: string, eventId: string, now: string) {
  const clean = cleanLabel(label), key = topicKey(clean), previous = rememberDecision(s,eventId,"manual",key);
  if (previous) return ensurePreferences(s).interests.find(i => i.id === previous.interestId)!;
  const interest = insertInterest(s,{label: clean,aliases: []});
  ledger(s).decisions[eventId] = {action: "manual",target: key,at:now,interestId: interest.id};
  return interest;
}
/** Removing a row frees capacity while retaining feedback and topic suppression. */
export function retireInterest(s: AppState, interestId: string, eventId: string, now: string) {
  if (rememberDecision(s,eventId,"remove",interestId)) return;
  const p = ensurePreferences(s), d = ledger(s), interest = p.interests.find(item => item.id === interestId);
  if (!interest) throw new Error("This interest is no longer available.");
  const topic = {label:interest.label,aliases:interest.aliases || []};
  d.ignored = [...d.ignored.filter(item => !overlaps(item,topic)),{...topic,key:topicKey(interest.label),interestId,at:now}];
  d.pending = d.pending.filter(item => !overlaps(item,topic));
  p.interests = p.interests.filter(item => item.id !== interestId);
  p.revision++;
  d.decisions[eventId] = {action:"remove",target:interestId,at:now,interestId};
  ensurePreferences(s);
}
export function decideInterestSuggestion(s: AppState, suggestionId: string, decision: "add"|"ignore", eventId: string, now: string) {
  const previous = rememberDecision(s,eventId,decision,suggestionId);
  if (previous) return previous.interestId;
  const p = ensurePreferences(s), d = ledger(s), suggestion = d.pending.find(item => item.id === suggestionId);
  if (!suggestion) throw new Error("This interest suggestion is no longer available.");
  const current = interestSuggestionInput(s,Date.parse(now));
  const valid = suggestion.evidence.every(e => current.papers.some(paper => paper.id === e.paperId && paper.metadataDigest === e.metadataDigest));
  if (!valid) throw new Error("This interest suggestion has changed. Refresh and try again.");
  let interestId: string | undefined;
  if (decision === "add") interestId = insertInterest(s,suggestion).id;
  else {
    d.ignored.push({key:suggestion.key,label:suggestion.label,aliases:suggestion.aliases,at:now});
    d.pending = d.pending.filter(item => !overlaps(item,suggestion));
    p.revision++;
  }
  d.decisions[eventId] = {action:decision,target:suggestionId,at:now,...(interestId ? {interestId} : {})};
  return interestId;
}
function recordReceipt(s: AppState, value: InterestDiscoveryLedger["receipts"][number]) {
  const d = ledger(s); d.receipts = [...d.receipts,value].slice(-24);
}
/** Publish safe topic previews only after fresh-state and canonical-evidence checks. */
export function publishInterestSuggestions(s: AppState, job: Job, raw: InterestSuggestionResult, now: string, id: () => string) {
  const result = interestSuggestionResultSchema.parse(raw), p = ensurePreferences(s), d = ledger(s), input = interestSuggestionInput(s,Date.parse(now));
  const receipt = {policy:interestSuggestionPolicy,at:now,fingerprint:job.interestEvidenceFingerprint || "",accepted:[] as string[],omitted:result.candidates.length};
  job.status = "complete";
  if (!p.enabled) { recordReceipt(s,{...receipt,outcome:"disabled"}); return false; }
  if (job.interestEvidenceFingerprint !== input.digest || (job.preferenceRevision !== undefined && job.preferenceRevision !== p.revision)) {
    recordReceipt(s,{...receipt,outcome:"stale"});
    if (!job.interestFollowup) queueInterestDiscovery(s,now,id,{followup:true});
    else d.processedFingerprint = input.digest;
    return false;
  }
  const eligible = new Map(input.papers.map(paper => [paper.id,paper]));
  d.pending = d.pending.filter(item => item.evidence.every(e => eligible.get(e.paperId)?.metadataDigest === e.metadataDigest));
  for (const candidate of result.candidates) {
    if (d.pending.length >= 3) break;
    let label: string;
    try { label = cleanLabel(candidate.label); } catch { continue; }
    const papers = candidate.evidence.map(e => eligible.get(e.paperId));
    if (new Set(candidate.evidence.map(e => e.paperId)).size !== candidate.evidence.length || papers.some(paper => !paper)) continue;
    const sources = papers as InterestSuggestionInput["papers"];
    if (!sufficientInterestEvidence(sources)) continue;
    if (candidate.evidence.some((e,i) => !`${sources[i].title}\n${sources[i].abstract}`.includes(e.quote))) continue;
    // Aliases become deterministic matching rules: each must be present in a
    // supporting canonical source, rather than a model-created broad shortcut.
    const aliases = [...new Set(candidate.aliases.map(value => cleanLabel(value)))].filter(alias =>
      sources.some(paper => ` ${normalizeInterestText(paper.title+" "+paper.abstract)} `.includes(` ${normalizeInterestText(alias)} `)));
    const topic = {label,aliases};
    if (existingInterest(p.interests,topic) || d.ignored.some(item => overlaps(item,topic)) || d.pending.some(item => overlaps(item,topic))) continue;
    // The worker independently reviews this bounded explanation against the same
    // source identities and actual choice evidence before submitting it.
    const reason = candidate.reason;
    const key = topicKey(label), suggestionId = `suggestion-${hash(key+"\n"+input.digest).slice(0,24)}`;
    d.pending.push({id:suggestionId,key,label,aliases,reason,createdAt:now,evidence:candidate.evidence.map((e,i) =>
      ({paperId:e.paperId,title:sources[i].title,metadataDigest:sources[i].metadataDigest,quote:e.quote,explicit:sources[i].explicit}))});
    receipt.accepted.push(suggestionId);
    if (d.pending.length >= 3) break;
  }
  d.pending = d.pending.slice(0,3);
  d.processedFingerprint = input.digest;
  recordReceipt(s,{...receipt,outcome:"published",omitted:result.candidates.length-receipt.accepted.length});
  p.revision++;
  return true;
}
