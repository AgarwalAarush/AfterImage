import assert from "node:assert/strict";
import test from "node:test";
import {copyFile,mkdir,mkdtemp,readFile,rm,unlink,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {getSubjectLesson,subjectCatalog} from "../src/lib/subject-library";
import mechanismCatalog from "../src/content/subjects/mechanism-catalog.json";
import {auditSubjectPublication,mechanismInventoryIssues} from "../scripts/audit-subject-publication";

const inventoryIssues=(issues:string[])=>issues.filter(issue=>!issue.endsWith("mechanism lacks current complete approval"));
async function copyInventory(lessonDirectory:string,mechanismDirectory:string){
  await Promise.all([mkdir(lessonDirectory),mkdir(mechanismDirectory)]);
  await Promise.all([
    ...subjectCatalog.map(entry=>copyFile(path.resolve("src/content/subjects/lessons",entry.id+".json"),path.join(lessonDirectory,entry.id+".json"))),
    ...mechanismCatalog.lessonIds.map(id=>copyFile(path.resolve("src/content/subjects/mechanisms",id+".json"),path.join(mechanismDirectory,id+".json"))),
  ]);
}

test("release audit rejects a deleted catalog lesson even when every remaining publication passes",async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),"afterimage-publication-inventory-")),lessonDirectory=path.join(directory,"lessons"),mechanismDirectory=path.join(directory,"mechanisms");
  try{
    await copyInventory(lessonDirectory,mechanismDirectory);
    // Only the isolated inventory is mutated; loaders still validate the actual
    // reviewed publications. This specifically exercises deployment deletion.
    const complete=await auditSubjectPublication({lessonDirectory,mechanismDirectory});
    assert.equal(complete.catalog,subjectCatalog.length);
    assert.equal(complete.lessons,subjectCatalog.length);
    assert.deepEqual(inventoryIssues(complete.issues),[]);
    const removed=subjectCatalog[0].id;
    await unlink(path.join(lessonDirectory,removed+".json"));
    const incomplete=await auditSubjectPublication({lessonDirectory,mechanismDirectory});
    assert.equal(incomplete.lessons,subjectCatalog.length-1);
    assert.deepEqual(inventoryIssues(incomplete.issues),[`${removed}: catalog lesson file is missing`]);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test("release audit rejects a deleted catalog walkthrough in an isolated complete inventory",async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),"afterimage-mechanism-inventory-")),lessonDirectory=path.join(directory,"lessons"),mechanismDirectory=path.join(directory,"mechanisms");
  try{
    await copyInventory(lessonDirectory,mechanismDirectory);
    const complete=await auditSubjectPublication({lessonDirectory,mechanismDirectory});
    assert.equal(complete.mechanismCatalog,14);
    assert.deepEqual(inventoryIssues(complete.issues),[]);
    const removed="whisper";
    await unlink(path.join(mechanismDirectory,removed+".json"));
    const incomplete=await auditSubjectPublication({lessonDirectory,mechanismDirectory});
    assert.deepEqual(inventoryIssues(incomplete.issues),[`${removed}: catalog mechanism file is missing`]);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test("mechanism inventory rejects duplicate, orphan and unknown-subject identities",()=>{
  const subjects=new Set(subjectCatalog.map(entry=>entry.id)),ids=mechanismCatalog.lessonIds;
  assert.deepEqual(mechanismInventoryIssues(mechanismCatalog,ids,subjects),[]);
  assert.ok(mechanismInventoryIssues({...mechanismCatalog,lessonIds:[...ids,ids[0]]},ids,subjects).includes("Mechanism catalog contains duplicate lesson identities"));
  const orphan=subjectCatalog.find(entry=>!ids.includes(entry.id))!.id;
  assert.deepEqual(mechanismInventoryIssues(mechanismCatalog,[...ids,orphan],subjects),[`${orphan}: mechanism publication missing from mechanism catalog`]);
  assert.deepEqual(mechanismInventoryIssues({...mechanismCatalog,lessonIds:[...ids,"unknown-subject"]},[...ids,"unknown-subject"],subjects),["unknown-subject: mechanism catalog references an unknown lesson"]);
});

test("reader loader strips injected private audit fields from an otherwise current reviewed publication",async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),"afterimage-publication-projection-")),id=subjectCatalog[0].id,file=path.join(directory,id+".json");
  try{
    const original=JSON.parse(await readFile(path.resolve("src/content/subjects/lessons",id+".json"),"utf8"));
    const injected=structuredClone(original),marker="PRIVATE AUDIT ONLY: do not serialize this fixture";
    injected.auditNotes={text:marker};injected.claims[0].evidence=marker;injected.sections[0].privateDraft=marker;
    injected.sources[0].excerpt=marker;injected.review.artifacts=[{path:marker}];
    await writeFile(file,JSON.stringify(injected));
    const lesson=await getSubjectLesson(id,{directory});
    assert.ok(lesson,"added private fields do not invalidate otherwise unchanged public content");
    assert.deepEqual(lesson,original,"only the allowlisted validated reader projection may be returned");
    assert.equal(JSON.stringify(lesson).includes(marker),false);
    assert.equal(lesson.review.contentDigest,original.review.contentDigest,"sanitization must preserve the reviewed public binding");
    injected.createdAt={privateValue:marker};await writeFile(file,JSON.stringify(injected));
    assert.equal(await getSubjectLesson(id,{directory}),null,"metadata must be validated too, rather than blindly copied");
  }finally{await rm(directory,{recursive:true,force:true});}
});
