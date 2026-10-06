import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { getSubjectMechanism, mechanismDigest, validateMechanismMath, subjectMechanismRendererDigest } from "../src/lib/subject-mechanism-store";
import { getSubjectLesson } from "../src/lib/subject-library";
import { publishedSubjectMechanismSchema, subjectMechanismSchema, validateSubjectMechanism } from "../src/lib/subject-mechanism";
import { validateSubjectMechanismQuality } from "../src/lib/subject-mechanism-quality";
import { subjectPresentationScope, subjectPresentationBaseline, subjectCorePresentationFiles, subjectIntegrationPresentationFiles, readSubjectPresentationFonts } from "../src/lib/subject-presentation-scope";
import { auditSubjectPresentationCoverage } from "../src/lib/subject-presentation-coverage";
import { auditSubjectRouteInventory } from "../src/lib/subject-presentation-routes";
import { subjectFeatureRoots } from "../src/lib/subject-presentation-isolation";
import { subjectWorkspaceAccepted } from "../src/lib/subject-workspace-review";

// All fixture mutations, including synthetic receipts, are confined to this
// disposable directory. No source, review, font or receipt in the repository is changed.
test("actual mechanism publication preserves every gate across scoped legacy compatibility",async t=>{
  const originalCwd=process.cwd(),originalEnvironment=process.env.NODE_ENV;
  const root=await mkdtemp(path.join(os.tmpdir(),"subject-publication-fixture-"));
  const mechanismFile="src/content/subjects/mechanisms/resnet.json",lessonFile="src/content/subjects/lessons/resnet.json";
  const receiptFile="src/content/subjects/workspace-acceptance.json";
  try {
    const routes=await auditSubjectRouteInventory(originalCwd);
    const coverage=await auditSubjectPresentationCoverage({root:originalCwd,coreFiles:subjectCorePresentationFiles,integrationRoots:subjectIntegrationPresentationFiles,featureRoots:subjectFeatureRoots,routeFiles:routes.sourceFiles});
    const fonts=await readSubjectPresentationFonts(originalCwd);
    await Promise.all([...new Set([...coverage.sourceFiles,...fonts.map(([file])=>file),mechanismFile,lessonFile])].map(async file=>{
      await mkdir(path.dirname(path.join(root,file)),{recursive:true});
      await copyFile(path.join(originalCwd,file),path.join(root,file));
    }));
    const reconciledCoreFiles=["src/lib/scene-illustration.ts","src/lib/scene-illustration-svg.ts"];
    const currentRenderers=Object.fromEntries(await Promise.all(reconciledCoreFiles.map(async file=>[file,await readFile(path.join(root,file))])));
    // Preserve a real historical compatibility fixture while the checkout moves
    // forward. These approved bytes are written only into the temporary fixture.
    for(const file of reconciledCoreFiles)await writeFile(path.join(root,file),execFileSync("git",["show",`${subjectPresentationBaseline.baselineCommit}:${file}`],{cwd:originalCwd}));
    Object.assign(process.env,{NODE_ENV:"test"});
    process.chdir(root);
    const lesson=await getSubjectLesson("resnet");assert.ok(lesson,"public lesson fixture must pass its own publication checks");
    const original=publishedSubjectMechanismSchema.parse(JSON.parse(await readFile(mechanismFile,"utf8")));
    const legacyDigest=original.review.visualAcceptance!.presentationDigest;
    const scope=await subjectPresentationScope(root);
    assert.equal(scope.legacyCore.equivalent,true);assert.equal(scope.legacyCore.legacyPresentationDigest,legacyDigest);
    async function receipt(current=scope,overrides:Record<string,unknown>={}) {
      await writeFile(receiptFile,JSON.stringify({version:1,policy:"subjects-scoped-v1",coreDigest:current.coreDigest,integrationDigest:current.integrationDigest,
        legacyPresentationDigest:current.legacyCore.legacyPresentationDigest,reportDigest:"a".repeat(64),reviewerId:"synthetic-test-only",reviewedAt:"2026-10-03T20:00:00.000Z",viewCount:4,...overrides}));
    }
    async function resetMechanism(){await writeFile(mechanismFile,JSON.stringify(original));}

    await t.test("missing workspace receipt withholds an otherwise valid legacy mechanism",async()=>{
      await rm(receiptFile,{force:true});
      assert.equal(await getSubjectMechanism(lesson),null);
      assert.ok(await getSubjectMechanism(lesson,{allowSourcePassed:true}),"development source review still uses the scientific gates without granting publication");
    });
    await t.test("exact legacy core and matching current workspace receipt preserve the original per-beat approval",async()=>{
      await receipt();
      const result=await getSubjectMechanism(lesson);assert.ok(result);
      assert.deepEqual(result.review,original.review,"legacy approval bytes must not be rewritten or synthesized");
    });
    await t.test("stale or malformed workspace receipts reject publication",async()=>{
      for(const key of ["coreDigest","integrationDigest","legacyPresentationDigest"]) {
        await receipt(scope,{[key]:"0".repeat(64)});
        assert.equal(await getSubjectMechanism(lesson),null,key);
      }
      await receipt(scope,{viewCount:3});assert.equal(await getSubjectMechanism(lesson),null);
      await receipt();assert.ok(await getSubjectMechanism(lesson));
    });
    await t.test("a changed core rejects legacy approval even with a receipt matching those changed bytes",async()=>{
      const file="src/components/subject-reader.tsx",bytes=await readFile(file);
      try {
        await writeFile(file,Buffer.concat([bytes,Buffer.from("\n/* synthetic core change */\n")]));
        const changed=await subjectPresentationScope(root);assert.equal(changed.legacyCore.equivalent,false);
        await receipt(changed);assert.equal(await subjectWorkspaceAccepted(changed),true);
        assert.equal(await getSubjectMechanism(lesson),null);
      } finally {await writeFile(file,bytes);await receipt();}
    });
    await t.test("Library renderer reconciliation retains diagram approval only with a fresh matching workspace receipt",async()=>{
      const historical=Object.fromEntries(await Promise.all(reconciledCoreFiles.map(async file=>[file,await readFile(file)])));
      try {
        for(const file of reconciledCoreFiles)await writeFile(file,currentRenderers[file]);
        const changed=await subjectPresentationScope(root);assert.equal(changed.legacyCore.equivalent,true);
        assert.equal(changed.coreDigest,scope.coreDigest);assert.notEqual(changed.integrationDigest,scope.integrationDigest);
        assert.equal(await getSubjectMechanism(lesson),null,"old workspace receipt must not accept a changed Library integration");
        await receipt(changed);assert.equal(await subjectWorkspaceAccepted(changed),true);
        assert.deepEqual((await getSubjectMechanism(lesson))?.review,original.review,"diagram approvals remain byte-identical");
      } finally {
        for(const file of reconciledCoreFiles)await writeFile(file,historical[file]);
        await receipt();
      }
    });
    await t.test("a modified extracted helper invalidates renderer and historical approval",async()=>{
      const file="src/lib/diagram-text.ts",bytes=await readFile(file),digest=await subjectMechanismRendererDigest();
      try {
        await writeFile(file,Buffer.concat([bytes,Buffer.from("\n/* altered text rendering */\n")]));
        assert.notEqual(await subjectMechanismRendererDigest(),digest);
        const changed=await subjectPresentationScope(root);assert.equal(changed.legacyCore.equivalent,false);
        await receipt(changed);assert.equal(await getSubjectMechanism(lesson),null);
      } finally {await writeFile(file,bytes);await receipt();}
    });
    await t.test("changed font bytes reject legacy approval even with a freshly matching workspace receipt",async()=>{
      const file=fonts.find(([name])=>name.startsWith("public/fonts/")&&name.endsWith(".woff2"))![0],bytes=await readFile(file);
      try {
        await writeFile(file,Buffer.concat([bytes,Buffer.from([0])]));
        const changed=await subjectPresentationScope(root);assert.equal(changed.legacyCore.equivalent,false);
        await receipt(changed);assert.equal(await subjectWorkspaceAccepted(changed),true);
        assert.equal(await getSubjectMechanism(lesson),null);
      } finally {await writeFile(file,bytes);await receipt();}
    });
    await t.test("workspace approval cannot replace per-beat, transition, policy or parent bindings",async()=>{
      for(const alter of [
        (value:typeof original)=>{delete value.review.visualAcceptance;},
        (value:typeof original)=>{value.review.visualAcceptance!.beatCount+=1;},
        (value:typeof original)=>{value.review.visualAcceptance!.transitionCount-=1;},
        (value:typeof original)=>{value.review.visualAcceptance!.semanticPolicyVersion="outdated-policy";},
        (value:typeof original)=>{value.parentContentDigest="0".repeat(64);},
        (value:typeof original)=>{value.review.rendererDigest="0".repeat(64);},
        (value:typeof original)=>{value.review.contentDigest="0".repeat(64);},
      ]) {
        const value=structuredClone(original);alter(value);await writeFile(mechanismFile,JSON.stringify(value));
        assert.equal(await getSubjectMechanism(lesson),null);
      }
      await resetMechanism();assert.ok(await getSubjectMechanism(lesson));
    });
    await t.test("source, math and semantic ownership checks still run behind valid presentation bindings",async()=>{
      const cases=[
        {alter:(value:typeof original)=>{value.beats[0].sourceIds=["unknown-source"];},check:(value:typeof original)=>validateSubjectMechanism(value,lesson,lesson.sources),message:/Unknown mechanism source/},
        {alter:(value:typeof original)=>{value.beats[0].explanation+=" A malformed formula opens here: $x.";},check:(value:typeof original)=>validateMechanismMath(value,lesson),message:/Unclosed math/},
        {alter:(value:typeof original)=>{value.entities[1].label=value.entities[0].label;},check:(value:typeof original)=>validateSubjectMechanismQuality(value),message:/share the visible alias/},
      ];
      for(const {alter,check,message} of cases) {
        const value=structuredClone(original);alter(value);
        value.review.contentDigest=mechanismDigest(JSON.stringify(subjectMechanismSchema.parse(value)));
        publishedSubjectMechanismSchema.parse(value);assert.throws(()=>check(value),message);
        await writeFile(mechanismFile,JSON.stringify(value));
        assert.equal(await getSubjectMechanism(lesson),null);
        assert.equal(await getSubjectMechanism(lesson,{allowSourcePassed:true}),null,"development review cannot bypass scientific checks");
      }
      await resetMechanism();assert.ok(await getSubjectMechanism(lesson));
    });
  } finally {
    process.chdir(originalCwd);
    if(originalEnvironment===undefined)Reflect.deleteProperty(process.env,"NODE_ENV");else Object.assign(process.env,{NODE_ENV:originalEnvironment});
    await rm(root,{recursive:true,force:true});
  }
});
