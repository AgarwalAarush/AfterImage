import { z } from "zod";

export const subjectVisualReviewPolicyVersion = 2;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.string().min(1).max(160);
const check = z.object({ passed: z.literal(true), observation: z.string().min(20).max(1200) }).strict();
export const subjectVisualFrameChecks = z.object({
  textLegible: check, themeContrast: check, geometryClear: check, labelGrouping: check, spacingBalanced: check,
  stateIdentityCorrect: check, relationshipDirectionsCorrect: check,
  explanationConsistent: check, interactionControlsVisible: check,
}).strict();
export const subjectVisualTransitionChecks = z.object({
  identityPreserved: check, geometryContinuous: check,
  relationshipAvailabilityCorrect: check, motionSemanticsCorrect: check,
}).strict();
const artifact = z.object({
  path: z.string().min(1).max(1200), sha256: digest,
  width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000),
  regions: z.array(z.enum(["diagram", "narration", "controls"])).min(1).max(3),
}).strict();
const rect=z.object({x:z.number().finite(),y:z.number().finite(),w:z.number().finite().positive().max(20000),h:z.number().finite().positive().max(20000)}).strict();
/** Actual browser font outlines and DOM identities are bound to the screenshots reviewed. */
export const subjectVisualBrowserAuditSchema=z.object({
  version:z.literal(1),lessonId:z.string(),contentDigest:digest,parentContentDigest:digest,rendererDigest:digest,presentationDigest:digest,
  frameId:identity,viewId:z.enum(["wide-light","wide-dark","narrow-light","narrow-dark"]),beatIndex:z.number().int().min(0).max(5),stateDigest:digest,
  artifactDigests:z.array(digest).min(1).max(4),
  facts:z.object({
    theme:z.enum(["light","dark"]),viewportWidth:z.union([z.literal(900),z.literal(1440)]),
    canvasWidth:z.number().finite().min(380).max(1600),viewBox:z.string().min(5).max(100),
    introGap:z.number().finite().min(24).max(64),fonts:z.array(z.string().min(1).max(300)).min(1).max(8),
    objects:z.array(z.object({
      id:z.string().min(1).max(30),status:z.enum(["pending","active","retained"]),bounds:rect,
      labels:z.array(rect.extend({text:z.string().min(1).max(160)})).min(1).max(12),
      entities:z.array(rect.extend({id:z.string().min(1).max(30),pill:rect,text:z.string().min(1).max(8)})).max(5),
    }).strict()).min(5).max(8),findings:z.array(z.string()).length(0),
  }).strict(),
}).strict();
const frame = z.object({
  id: identity, viewId: z.enum(["wide-light", "wide-dark", "narrow-light", "narrow-dark"]),
  beatIndex: z.number().int().nonnegative().max(5), stateDigest: digest,
  svgWidth: z.number().finite().min(380).max(1600), svgHeight: z.number().finite().positive().max(10000),
  captureSource: z.literal("browser"), fontsReady: z.literal(true), resolvedFontFamily: z.string().min(5).max(300),
  artifacts: z.array(artifact).min(1).max(4), checks: subjectVisualFrameChecks,
  browserAudit:z.object({path:z.string().min(1).max(1200),sha256:digest}).strict(),
}).strict();
const transition = z.object({
  viewId: frame.shape.viewId, fromBeatIndex: frame.shape.beatIndex, toBeatIndex: frame.shape.beatIndex,
  beforeFrameId: identity, afterFrameId: identity,
  motion: z.object({
    mode: z.enum(["status-only", "spatial"]), geometryStable: z.boolean(),
    properties: z.array(z.string().min(1).max(40)).min(1).max(10),
    durationMs: z.number().finite().nonnegative().max(10000),
    midpoint: z.object({ progress: z.number().min(.25).max(.75), artifacts: z.array(artifact).min(1).max(4) }).strict().optional(),
  }).strict(), checks: subjectVisualTransitionChecks,
}).strict();
export const subjectVisualReviewSchema = z.object({
  version: z.literal(subjectVisualReviewPolicyVersion), lessonId: z.string().regex(/^[a-z0-9-]+$/).max(150),
  contentDigest: digest, parentContentDigest: digest, rendererDigest: digest, presentationDigest: digest,
  semanticPolicyVersion: z.string().min(1).max(100),
  authorId: identity, reviewerId: identity, reviewerRole: z.literal("independent"),
  reviewedAt: z.string().datetime(), passed: z.literal(true), findings: z.array(z.string()).length(0),
  views: z.array(z.object({
    id: frame.shape.viewId, viewportWidth: z.union([z.literal(1440), z.literal(900)]),
    viewportHeight: z.literal(900), theme: z.enum(["light", "dark"]),
  }).strict()).length(4),
  frames: z.array(frame).min(12).max(24), transitions: z.array(transition).min(8).max(20),
}).strict();
export type SubjectVisualReview = z.infer<typeof subjectVisualReviewSchema>;
/** Public proof contains coverage and fingerprints, never private artifact paths or quotations. */
export const subjectVisualAcceptanceSchema = z.object({
  version: z.literal(subjectVisualReviewPolicyVersion), reportDigest: digest,
  presentationDigest: digest, semanticPolicyVersion: z.string().min(1).max(100),
  reviewerId: identity, viewCount: z.literal(4), beatCount: z.number().int().min(3).max(6),
  transitionCount: z.number().int().min(8).max(20),
}).strict();
export type SubjectVisualAcceptance = z.infer<typeof subjectVisualAcceptanceSchema>;
