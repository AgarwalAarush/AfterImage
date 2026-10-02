import {z} from "zod";
import type {SubjectLesson} from "./subjects";

export type SubjectEvidencePassage={id:string;sourceId:string;start:number;end:number;text:string};
type SourceExcerpt={id:string;excerpt:string};

/** Every candidate is a literal range of a supplied primary excerpt, never synthesized text. */
export function subjectEvidencePassages(sources:SourceExcerpt[]):SubjectEvidencePassage[]{
  const passages:SubjectEvidencePassage[]=[];
  const segmenter=new Intl.Segmenter("en",{granularity:"sentence"});
  for(const source of sources){
    const seen=new Set<string>();let identity=0;
    function append(start:number,end:number){
      while(start<end&&/\s/.test(source.excerpt[start]))start++;
      while(end>start&&/\s/.test(source.excerpt[end-1]))end--;
      const text=source.excerpt.slice(start,end),key=`${start}:${end}`;
      if(text.length<20||text.length>350||seen.has(key)||/\[(?:SOURCE BUDGET|EXTRACTION TRUNCATED)/.test(text))return;
      seen.add(key);passages.push({id:`${source.id}:passage-${identity++}`,sourceId:source.id,start,end,text});
    }
    for(const paragraph of source.excerpt.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g))append(paragraph.index!,paragraph.index!+paragraph[0].length);
    const sentences=[...segmenter.segment(source.excerpt)];
    for(let sentenceIndex=0;sentenceIndex<sentences.length;sentenceIndex++){
      const sentence=sentences[sentenceIndex];
      append(sentence.index,sentence.index+sentence.segment.length);
      // Preserve adjacent short statements or a local equation context as one exact passage.
      let nextIndex=sentenceIndex;
      while(nextIndex+1<sentences.length&&sentences[nextIndex+1].index+sentences[nextIndex+1].segment.length-sentence.index<=350)nextIndex++;
      const nextEnd=sentences[nextIndex];
      append(sentence.index,nextEnd.index+nextEnd.segment.length);
      if(sentence.segment.trim().length>350){
        for(let start=sentence.index;start<sentence.index+sentence.segment.length;){
          let end=Math.min(start+320,sentence.index+sentence.segment.length);
          if(end<sentence.index+sentence.segment.length){const boundary=source.excerpt.lastIndexOf(" ",end);if(boundary>start+160)end=boundary;}
          append(start,end);
          if(end>=sentence.index+sentence.segment.length)break;
          let next=Math.max(start+1,end-130);
          const boundary=source.excerpt.indexOf(" ",next);if(boundary>=0&&boundary<end)next=boundary+1;
          start=next;
        }
      }
    }
  }
  return passages;
}

export function subjectEvidenceSelectionSchema(lesson:SubjectLesson,passages:SubjectEvidencePassage[]){
  const choices=lesson.claims.map(claim=>{
    const eligible=passages.filter(passage=>claim.sourceIds.includes(passage.sourceId));
    if(!eligible.length)throw new Error(`Claim ${claim.id} has no bounded passages in its declared primary sources`);
    return z.object({claimId:z.literal(claim.id),passageId:z.enum(eligible.map(passage=>passage.id)as[string,...string[]])});
  });
  return z.object({selections:z.array(z.union(choices as [typeof choices[number],typeof choices[number],...typeof choices[number][]])).length(lesson.claims.length)});
}

/** This establishes literal attribution only; the independent semantic review still checks support. */
export function bindSubjectEvidence(lesson:SubjectLesson,passages:SubjectEvidencePassage[],selection:{selections:{claimId:string;passageId:string}[]}){
  subjectEvidenceSelectionSchema(lesson,passages).parse(selection);
  const byId=new Map(passages.map(passage=>[passage.id,passage])),seen=new Set<string>();
  const next=structuredClone(lesson);
  for(const chosen of selection.selections){
    if(seen.has(chosen.claimId))throw new Error("Evidence selector repeated a claim identity");seen.add(chosen.claimId);
    const claim=next.claims.find(claim=>claim.id===chosen.claimId)!;
    claim.evidence=byId.get(chosen.passageId)!.text;
  }
  if(seen.size!==lesson.claims.length)throw new Error("Evidence selector omitted a claim");
  return next;
}
