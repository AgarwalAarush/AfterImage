import test, {before} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {evaluateSubjectPresentationScope,subjectPresentationScope,readSubjectPresentationFonts,subjectPresentationBaseline,subjectScopedPresentationFiles,subjectCorePresentationFiles,subjectIntegrationPresentationFiles,type SubjectPresentationSources} from "../src/lib/subject-presentation-scope";
const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
let sources:SubjectPresentationSources,fonts:[string,string][];
before(async()=>{sources=Object.fromEntries(await Promise.all(subjectScopedPresentationFiles.map(async file=>[file,await readFile(file)])));fonts=await readSubjectPresentationFonts();});
test("hash-only witness reconstructs the exact legacy presentation approval and current extracted core",()=>{
  const result=evaluateSubjectPresentationScope(sources,fonts);
  assert.equal(result.legacyCore.reconstructedLegacyDigest,"76a8196b47300566afdb94d5001d9a6a0d802cffe6c797fd3e7c66fba3ffeac2");
  assert.deepEqual(result.legacyCore.failures,[]);assert.equal(result.legacyCore.equivalent,true);
  assert.notEqual(result.coreDigest,result.integrationDigest);
});
test("source extraction witnesses are exact fragments of the approved Git source",()=>{
  // Development verification of provenance; production needs neither Git nor the
  // historical application implementation. Its complete source hashes are public.
  for(const witness of subjectPresentationBaseline.extractions) {
    const original=execFileSync("git",["show",`${subjectPresentationBaseline.baselineCommit}:${witness.legacyFile}`],{encoding:"utf8"});
    assert.equal(hash(original),witness.legacyFileDigest);
    const start=original.indexOf(witness.startAnchor),end=original.indexOf(witness.endAnchor,start+witness.startAnchor.length);
    assert.ok(start>=0&&end>=0);assert.equal(hash(original.slice(start,end+witness.endAnchor.length)),witness.fragmentDigest);
  }
});
test("real reader, diagram, theme and global CSS changes fail legacy core equivalence",()=>{
  const original=evaluateSubjectPresentationScope(sources,fonts);
  for(const file of ["src/components/subject-reader.tsx","src/components/subject-mechanism.tsx","src/app/ui.css","src/app/theme.css","src/components/library-content.tsx"]) {
    const changed={...sources,[file]:String(sources[file])+"\n/* changed */"};
    const result=evaluateSubjectPresentationScope(changed,fonts);
    assert.equal(result.legacyCore.equivalent,false,file);assert.notEqual(result.coreDigest,original.coreDigest,file);
  }
});
test("frame geometry and imports are both bound even when one remains unchanged",()=>{
  const file="src/components/workspace-frame.tsx",text=String(sources[file]);
  for(const changed of [text.replace('className="app-shell"','className="changed-shell"'),text.replace('from "./app-mark"','from "./different-mark"'),text+"\nvoid 0;\n"]) {
    const result=evaluateSubjectPresentationScope({...sources,[file]:changed},fonts);assert.equal(result.legacyCore.equivalent,false);
  }
});
test("font changes, omissions and additions cannot reuse legacy visual acceptance",()=>{
  for(const changed of [fonts.map((entry,index)=>index===0?[entry[0],"0".repeat(64)] as [string,string]:entry),fonts.slice(1),[...fonts,["public/fonts/new.woff2","0".repeat(64)] as [string,string]]])
    assert.equal(evaluateSubjectPresentationScope(sources,changed).legacyCore.equivalent,false);
  assert.throws(()=>evaluateSubjectPresentationScope(sources,[...fonts,fonts[0]]),/Invalid/);
});
test("provider, overlays and policy changes require a new integration review without claiming changed diagram bytes",()=>{
  const original=evaluateSubjectPresentationScope(sources,fonts);
  for(const file of ["src/components/app.tsx","src/components/app-context.tsx","src/components/app-notifications.tsx","src/components/app-notifications.module.css","src/app/layout.tsx","src/lib/subject-workspace-review.ts","src/lib/subject-presentation-scope.ts","src/lib/subject-presentation-baseline.json","src/lib/subject-presentation-isolation.ts"]) {
    assert.ok(subjectIntegrationPresentationFiles.includes(file));
    const result=evaluateSubjectPresentationScope({...sources,[file]:String(sources[file])+"\n/* integration changed */"},fonts);
    assert.equal(result.coreDigest,original.coreDigest,file);assert.notEqual(result.integrationDigest,original.integrationDigest,file);
  }
});
test("pure evaluator binds discovered feature implementation to integration without changing core",()=>{
  const original=evaluateSubjectPresentationScope(sources,fonts);
  for(const file of ["src/components/reading-interests.tsx","src/components/reading-interests.module.css","src/components/home.tsx","src/components/home.module.css","src/components/paper-feedback.tsx","src/components/paper-feedback.module.css","src/components/reading-direction.tsx"]) {
    assert.equal(subjectCorePresentationFiles.includes(file),false);assert.equal(subjectIntegrationPresentationFiles.includes(file),false);
    const result=evaluateSubjectPresentationScope({...sources,[file]:"arbitrary feature-only change"},fonts,[file]);
    assert.equal(result.coreDigest,original.coreDigest);assert.notEqual(result.integrationDigest,original.integrationDigest);
  }
});
test("only the exact context import relocation is permitted for the shared reader assistant",()=>{
  const file="src/components/paper-assistant.tsx",text=String(sources[file]);
  const restored=text.replace('import { useApp } from "./app-context";','import { useApp } from "./app";');
  assert.equal(evaluateSubjectPresentationScope({...sources,[file]:restored},fonts).legacyCore.equivalent,true);
  const unsafe=restored.replace('import { useApp } from "./app";','import { useApp } from "./other-context";');
  assert.equal(evaluateSubjectPresentationScope({...sources,[file]:unsafe},fonts).legacyCore.equivalent,false);
});
test("missing sources fail closed and no acceptance is produced by the scope helper",()=>{
  assert.throws(()=>evaluateSubjectPresentationScope({...sources,"src/components/subject-reader.tsx":undefined},fonts),/Missing scoped/);
  const result=evaluateSubjectPresentationScope(sources,fonts);
  assert.equal("accepted" in result,false);assert.equal("visualAcceptance" in result,false);
});

test("filesystem scope rejects a feature CSS leak before it can return digests",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"subject-scope-isolation-"));
  try {
    const components=path.join(root,"src/components");
    await mkdir(components,{recursive:true});
    await Promise.all([
      writeFile(path.join(components,"home.tsx"),'import "./leak.css"; export function Home(){return null;}'),
      ...["reading-direction","paper-feedback","reading-interests"].map(name=>writeFile(path.join(components,`${name}.tsx`),'export default function Feature(){return null;}')),
      writeFile(path.join(components,"leak.css"),'body { color: red; }'),
    ]);
    await assert.rejects(subjectPresentationScope(root),/Feature CSS isolation failed.*CSS Modules/);
  } finally {await rm(root,{recursive:true,force:true});}
});

test("all historical source hashes are independently anchored to the approved Git revision",()=>{
  for(const [file,expected] of [...subjectPresentationBaseline.legacySourceManifest,...subjectPresentationBaseline.unchangedCoreManifest]) {
    const original=execFileSync("git",["show",`${subjectPresentationBaseline.baselineCommit}:${file}`]);
    assert.equal(hash(original),expected,file);
  }
});
