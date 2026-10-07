import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { layoutSubjectMechanism, layoutMechanismGlyphs } from "../src/lib/subject-mechanism";
import { diagramText, escapeXml } from "../src/lib/diagram-text";
import { subjectRendererBoundary } from "../src/lib/subject-renderer-boundary";

test("the extracted helper and every published Subjects layout equal the approved runtime",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"subject-renderer-equivalence-"));
  try {
    const archive=execFileSync("git",["archive",subjectRendererBoundary.baselineCommit,"src/lib"],{maxBuffer:10*1024*1024});
    execFileSync("tar",["xf","-","-C",root],{input:archive});
    await symlink(await realpath("node_modules"),path.join(root,"node_modules"),"dir");
    const old=await import(pathToFileURL(path.join(root,"src/lib/subject-mechanism.ts")).href);
    const oldScene=await import(pathToFileURL(path.join(root,"src/lib/scene.ts")).href);
    for(const label of ['A & B < C > D "quoted"',"x₁ + hᵀ + W^T + x_2","ᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ ⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺"]){
      assert.equal(diagramText(label),oldScene.diagramText(label));assert.equal(escapeXml(label),oldScene.escapeXml(label));
    }
    const directory="src/content/subjects/mechanisms";
    const files=(await readdir(directory)).filter(file=>file.endsWith(".json"));assert.equal(files.length,14);
    for(const file of files){
      const mechanism=JSON.parse(await readFile(path.join(directory,file),"utf8"));
      for(const width of [380,450,600,660,760,900,1440]){
        const current=layoutSubjectMechanism(mechanism,width);
        assert.deepEqual(current,old.layoutSubjectMechanism(mechanism,width),`${file} at ${width}`);
        for(const beat of mechanism.beats)for(const node of current.nodes){
          const state=beat.objects.find((item:{objectId:string})=>item.objectId===node.id);
          const labels=state.entityIds.map((id:string)=>mechanism.entities.find((entity:{id:string})=>entity.id===id).label);
          assert.deepEqual(layoutMechanismGlyphs(node.w,labels),old.layoutMechanismGlyphs(node.w,labels),`${file} glyphs`);
        }
      }
    }
  } finally {await rm(root,{recursive:true,force:true});}
});
