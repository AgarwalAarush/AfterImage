import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { auditSubjectPresentationCoverage } from "../src/lib/subject-presentation-coverage";
import { subjectCorePresentationFiles, subjectIntegrationPresentationFiles } from "../src/lib/subject-presentation-scope";
import { subjectFeatureRoots } from "../src/lib/subject-presentation-isolation";
import { auditSubjectRouteInventory } from "../src/lib/subject-presentation-routes";
async function fixture(files:Record<string,string>,run:(root:string)=>Promise<void>) {
  const root=await mkdtemp(path.join(os.tmpdir(),"subject-import-coverage-"));
  try {for(const [file,text] of Object.entries(files)){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),text);}await run(root);}
  finally {await rm(root,{recursive:true,force:true});}
}
const audit=(root:string,integrationRoots=["src/entry.ts"],coreFiles:string[]=[])=>auditSubjectPresentationCoverage({root,integrationRoots,coreFiles});
test("actual coverage binds route, feature and previously missing transitive implementation sources",async()=>{
  const routes=await auditSubjectRouteInventory();
  const result=await auditSubjectPresentationCoverage({coreFiles:subjectCorePresentationFiles,integrationRoots:subjectIntegrationPresentationFiles,featureRoots:subjectFeatureRoots,routeFiles:routes.sourceFiles});
  for(const file of ["src/lib/subject-math.ts","src/lib/subject-library.ts","src/lib/subject-publication.ts","src/components/reading-interests.tsx","src/components/paper-card-copy.ts","src/app/direction/page.tsx"])
    assert.ok(result.integrationFiles.includes(file),file);
  for(const file of subjectCorePresentationFiles)assert.ok(!result.integrationFiles.includes(file),file);
});
test("runtime imports, reexports, aliases and dynamic imports expand the bound integration closure",async()=>{
  await fixture({"src/entry.ts":'export {value} from "./middle"; export const lazy=()=>import("@/lazy");',"src/middle.ts":'import data from "./data.json"; export const value=data;',"src/data.json":'{}',"src/lazy.ts":'require("./last");',"src/last/index.ts":'export const n=1;'},async root=>{
    assert.deepEqual((await audit(root)).integrationFiles,["src/data.json","src/entry.ts","src/last/index.ts","src/lazy.ts","src/middle.ts"]);
  });
});
test("type-only imports and reexports do not expand runtime scope",async()=>{
  await fixture({"src/entry.ts":'import type {A} from "./missing-a"; import {type B} from "./missing-b"; export type {C} from "./missing-c"; export {type D} from "./missing-d"; export type * from "./missing-e";'},async root=>{
    assert.deepEqual((await audit(root)).integrationFiles,["src/entry.ts"]);
  });
});
test("a core module cannot silently move a new dependency to integration",async()=>{
  await fixture({"src/core.ts":'import "./added";',"src/added.ts":'export const x=1;',"src/entry.ts":'export const y=2;'},async root=>{
    await assert.rejects(audit(root,["src/entry.ts"],["src/core.ts"]),/unbound core dependency/);
    const result=await audit(root,["src/entry.ts","src/added.ts"],["src/core.ts"]);
    assert.ok(result.integrationFiles.includes("src/added.ts"));
  });
});
test("unresolved, computed, unknown external and unsupported asset imports fail closed",async()=>{
  for(const statement of ['import "./missing";','const target="./other"; import(target);','require(target);','export * from "unknown-package";','import "./asset.svg";'])
    await fixture({"src/entry.ts":statement,"src/asset.svg":"<svg/>"},async root=>{await assert.rejects(audit(root),/coverage failed|nonliteral imports/);});
});
test("new global styles cannot hide inside integration or nested module CSS",async()=>{
  await fixture({"src/entry.ts":'import "./feature.module.css";',"src/feature.module.css":'@import "./global.css";',"src/global.css":'body {color:red;}'},async root=>{
    await assert.rejects(audit(root),/global stylesheet must be explicitly core-bound/);
  });
});
test("CSS composition dependencies and JSON imports enter the integration manifest",async()=>{
  await fixture({"src/entry.ts":'import "./feature.module.css";',"src/feature.module.css":'.feature {composes: other from "./other.module.css";}',"src/other.module.css":'.other {color:red;}'},async root=>{
    assert.deepEqual((await audit(root)).integrationFiles,["src/entry.ts","src/feature.module.css","src/other.module.css"]);
  });
});
test("workspace escape and source symlinks cannot alias unbound implementation bytes",async()=>{
  await fixture({"src/entry.ts":'import "../../outside";'},async root=>{await assert.rejects(audit(root),/escapes workspace/);});
  await fixture({"src/entry.ts":'import "./alias";',"src/target.ts":'export const x=1;'},async root=>{
    await symlink(path.join(root,"src/target.ts"),path.join(root,"src/alias.ts"));
    await assert.rejects(audit(root),/symlinked sources/);
  });
});
