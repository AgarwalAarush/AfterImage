import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

test("recommendation completion leaves generation on demand; requesting a kit saves once and deduplicates", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "afterimage-kit-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import {mutate,snapshot} from './src/lib/store.ts';
      import {POST as complete} from './src/app/api/worker/route.ts';
      import {POST as action} from './src/app/api/state/route.ts';
      const paperId='2401.04088';
      await mutate(s=>{
        const p=s.papers.find(p=>p.id===paperId);
        p.recall=null;p.scene=null;delete p.visual;p.generationStatus='failed';p.generationError='Private review error';
        s.jobs=[{id:'recommend',type:'recommend',status:'running',leaseToken:'test-lease',createdAt:new Date().toISOString(),attempts:1}];
      });
      const result=await complete(new Request('http://localhost/api/worker',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-worker'},body:JSON.stringify({action:'complete',jobId:'recommend',leaseToken:'test-lease',result:{recommendations:[{paperId,role:'Next',reason:'A useful mechanism.',focus:'Routing.',depth:'Explore'}]}})}));
      assert.equal(result.status,200,await result.text());
      let s=(await snapshot()).data;
      assert.equal(s.recommendations[0].paperId,paperId);
      assert.equal(s.jobs.filter(j=>j.type==='generate').length,0);
      assert.equal(s.papers.find(p=>p.id===paperId).generationStatus,'failed');
      for(let i=0;i<2;i++){
        const r=await action(new Request('http://localhost/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate',paperId})}));
        assert.equal(r.status,200,await r.text());
      }
      s=(await snapshot()).data;
      assert.equal(s.jobs.filter(j=>j.type==='generate').length,1);
      assert.equal(s.entries[paperId].status,'saved');
      assert.equal(s.papers.find(p=>p.id===paperId).generationStatus,'queued');
      assert.equal(s.papers.find(p=>p.id===paperId).generationError,undefined);
    `], {cwd: process.cwd(), env:{...process.env, NODE_ENV:"development", VERCEL:"", AFTERIMAGE_STORAGE:"sqlite", AFTERIMAGE_SQLITE_PATH:path.join(directory,"test.sqlite"), AFTERIMAGE_WORKER_TOKEN:"test-worker"},stdio:"pipe"});
  } finally {
    rmSync(directory, {recursive:true, force:true});
  }
});
