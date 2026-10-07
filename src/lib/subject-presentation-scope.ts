import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import baselineJson from "./subject-presentation-baseline.json";
import { auditSubjectFeatureIsolation, subjectFeatureRoots } from "./subject-presentation-isolation";
import { auditSubjectPresentationCoverage } from "./subject-presentation-coverage";
import { auditSubjectRouteInventory } from "./subject-presentation-routes";
import { subjectDiagramTextFile, subjectDiagramTextIsHistorical, subjectRendererBoundary, subjectRendererSource } from "./subject-renderer-boundary";

type Manifest = [string, string][];
type Baseline = {
  version: number;
  baselineCommit: string;
  legacyPresentationDigest: string;
  legacySourceManifest: Manifest;
  legacyFontDirectories: string[];
  unchangedCoreManifest: Manifest;
  extractions: {legacyFile:string;legacyFileDigest:string;targetFile:string;startAnchor:string;endAnchor:string;fragmentDigest:string;targetFileDigest:string}[];
};
const baseline = baselineJson as Baseline;
export const subjectPresentationScopeVersion = "subjects-scoped-v1" as const;
/** Hashes only: no copied application implementation, review artifacts or private state. */
export const subjectPresentationBaseline = baseline;
export const subjectPresentationFontDirectories = baseline.legacyFontDirectories;
// Subjects uses the pure text helper and routing, not Library scene rendering.
// The entire Library runtime closure remains bound to workspace integration.
export const subjectLibraryRendererFiles = [...baseline.unchangedCoreManifest.map(([file])=>file).filter(file=>file.startsWith("src/lib/scene")&&file!=="src/lib/scene-layout.ts"),"src/lib/scene-matrix-svg.ts","src/lib/scene-routing-svg.ts"].sort();
export const subjectCorePresentationFiles = [...baseline.unchangedCoreManifest.map(([file]) => file).filter(file=>!subjectLibraryRendererFiles.includes(file)), ...baseline.extractions.map(item => item.targetFile), subjectDiagramTextFile].sort();
/** Shared hooks, prop wiring, overlays, route layout and the acceptance policy need their own current review. */
export const subjectIntegrationPresentationFiles = [
  "src/app/layout.tsx", "src/components/app.tsx", "src/components/app-context.tsx",
  "src/components/paper-loading.tsx",
  "src/components/app-notifications.tsx", "src/components/app-notifications.module.css", "src/components/paper-palette.tsx",
  "src/lib/client-request.ts", "src/lib/library-client.ts", "src/lib/subject-visual-review.ts",
  "src/lib/subject-visual-review-schema.ts", "src/lib/subject-mechanism-quality.ts", "src/lib/subject-mechanism-store.ts",
  "src/lib/subject-workspace-review.ts", "src/lib/subject-presentation-scope.ts", "src/lib/subject-presentation-baseline.json",
  "src/lib/subject-presentation-isolation.ts", "src/lib/subject-presentation-coverage.ts", "src/lib/subject-presentation-routes.ts",
  "next.config.ts",
  "src/lib/subject-renderer-boundary.ts", "src/lib/subject-renderer-boundary.json", ...subjectLibraryRendererFiles,
].sort();
export const subjectScopedPresentationFiles = [...new Set([...subjectCorePresentationFiles,...subjectIntegrationPresentationFiles])].sort();
export type SubjectPresentationSources = Readonly<Record<string,string|Buffer|undefined>>;
const hash = (value:string|Buffer) => createHash("sha256").update(value).digest("hex");
const sortManifest = (manifest:Manifest) => [...manifest].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
function source(sources:SubjectPresentationSources,file:string) {
  const value=sources[file];
  if(value===undefined)throw new Error(`Missing scoped presentation source: ${file}`);
  return Buffer.isBuffer(value)?value.toString("utf8"):value;
}
function manifest(sources:SubjectPresentationSources,files:string[]):Manifest {
  return files.map(file=>[file,hash(source(sources,file))]);
}
function extraction(text:string,start:string,end:string) {
  const first=text.indexOf(start),last=text.indexOf(end,first+start.length);
  if(first<0||last<0||text.indexOf(start,first+start.length)>=0||text.indexOf(end,last+end.length)>=0)return null;
  return text.slice(first,last+end.length);
}
function baselineCoreBytes(file:string,text:string,sources:SubjectPresentationSources) {
  // A literal import relocation points at the separately reviewed identical context
  // contract. Every other byte of this actual Subjects component stays bound.
  if(file!=="src/components/paper-assistant.tsx")return subjectRendererSource(file,text,sources[subjectDiagramTextFile]);
  const relocated='import { useApp } from "./app-context";';
  if(text.split(relocated).length!==2)return text;
  return text.replace(relocated,'import { useApp } from "./app";');
}
/**
 * Mechanical equality evidence only. This function does not accept publication,
 * change a legacy report, or grant the required independent workspace review.
 */
export function evaluateSubjectPresentationScope(sources:SubjectPresentationSources,fontManifest:Manifest,coveredIntegrationFiles:readonly string[]=[]) {
  const failures:string[]=[];
  const validFont = (file:string,digest:string) => /^[a-f0-9]{64}$/.test(digest) &&
    baseline.legacyFontDirectories.some(directory=>file.startsWith(directory+"/")) && /\.(?:woff2?|css)$/.test(file);
  if(new Set(fontManifest.map(([file])=>file)).size!==fontManifest.length || fontManifest.some(([file,digest])=>!validFont(file,digest)))
    throw new Error("Invalid scoped font manifest");
  // Reconstruct the exact historical full-manifest preimage with current font bytes.
  // The old application hashes remain historical values, not aliases for new files.
  const reconstructedLegacyDigest=hash(JSON.stringify(sortManifest([...baseline.legacySourceManifest,...fontManifest])));
  if(reconstructedLegacyDigest!==baseline.legacyPresentationDigest)failures.push("legacy-manifest-or-fonts-changed");
  if(subjectRendererBoundary.baselineCommit!==baseline.baselineCommit||!baseline.unchangedCoreManifest.some(([file,digest])=>file===subjectRendererBoundary.legacyFile&&digest===subjectRendererBoundary.legacyFileDigest))failures.push("unbound-diagram-text-extraction");
  if(!subjectDiagramTextIsHistorical(sources[subjectDiagramTextFile]))failures.push(`core-changed:${subjectDiagramTextFile}`);
  for(const [file,expected] of baseline.unchangedCoreManifest) {
    if(subjectLibraryRendererFiles.includes(file))continue;
    if(hash(baselineCoreBytes(file,source(sources,file),sources))!==expected)failures.push(`core-changed:${file}`);
  }
  for(const witness of baseline.extractions) {
    if(!baseline.legacySourceManifest.some(([file,digest])=>file===witness.legacyFile&&digest===witness.legacyFileDigest))
      failures.push(`unbound-extraction:${witness.targetFile}`);
    const text=source(sources,witness.targetFile),fragment=extraction(text,witness.startAnchor,witness.endAnchor);
    if(fragment===null||hash(fragment)!==witness.fragmentDigest)failures.push(`extraction-changed:${witness.targetFile}`);
    // Pin imports, wrapper and prop contract too: unchanged inner JSX alone cannot
    // rule out a new hook, wrapper, substituted component or surrounding side effect.
    if(hash(text)!==witness.targetFileDigest)failures.push(`extraction-wrapper-changed:${witness.targetFile}`);
  }
  const coreDigest=hash(JSON.stringify({version:subjectPresentationScopeVersion,files:manifest(sources,subjectCorePresentationFiles),fonts:sortManifest(fontManifest)}));
  const integrationFiles=[...new Set([...subjectIntegrationPresentationFiles,...coveredIntegrationFiles])].sort();
  const integrationDigest=hash(JSON.stringify({version:subjectPresentationScopeVersion,files:manifest(sources,integrationFiles)}));
  return {version:subjectPresentationScopeVersion,coreDigest,integrationDigest,legacyCore:{
    equivalent:failures.length===0,legacyPresentationDigest:baseline.legacyPresentationDigest,reconstructedLegacyDigest,failures,
  }};
}
export async function readSubjectPresentationFonts(root=process.cwd()):Promise<Manifest> {
  const files:string[]=[];
  async function visit(relative:string) {
    for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})) {
      const file=path.posix.join(relative,entry.name);
      if(entry.isDirectory())await visit(file);
      else if(/\.(?:woff2?|css)$/.test(entry.name))files.push(file);
    }
  }
  for(const directory of subjectPresentationFontDirectories)await visit(directory);
  return Promise.all(files.sort().map(async file=>[file,hash(await readFile(path.join(root,file)))] as [string,string]));
}
async function computeSubjectPresentationScope(root:string) {
  // Feature implementation and its full import closure stay outside the core
  // digest but remain integration-bound. CSS isolation is an additional check,
  // not a claim that arbitrary JavaScript has no global effects or an approval.
  await auditSubjectFeatureIsolation({root});
  const routes=await auditSubjectRouteInventory(root);
  const coverage=await auditSubjectPresentationCoverage({root,coreFiles:subjectCorePresentationFiles,
    integrationRoots:subjectIntegrationPresentationFiles,featureRoots:subjectFeatureRoots,routeFiles:routes.sourceFiles,forbiddenCoreImports:subjectLibraryRendererFiles});
  const [entries,fonts]=await Promise.all([
    Promise.all([...new Set([...subjectScopedPresentationFiles,...coverage.integrationFiles])].map(async file=>[file,await readFile(path.join(root,file))] as const)),
    readSubjectPresentationFonts(root),
  ]);
  return evaluateSubjectPresentationScope(Object.fromEntries(entries),fonts,coverage.integrationFiles);
}
// Deployed source bytes are immutable. Explicit fixture roots and development
// always rerun the audit so edits cannot reuse a stale computed digest.
let productionScope:Promise<Awaited<ReturnType<typeof computeSubjectPresentationScope>>>|undefined;
export function subjectPresentationScope(root?:string) {
  if(root===undefined&&process.env.NODE_ENV==="production")return productionScope??=computeSubjectPresentationScope(process.cwd());
  return computeSubjectPresentationScope(root??process.cwd());
}
