import {subjectLessonSchema,type SubjectLesson} from "./subjects";

/** Educational review inputs are bounded public primary papers, never owner uploads. */
export function assertSubjectPrimarySources(arxivId:string,sources:{id:string;url:string;excerpt:string}[]){
  if(!/^\d{4}\.\d{4,5}$/.test(arxivId)||!sources.length)throw Error("Known public arXiv identity required");
  const identities=new Set<string>();
  for(const source of sources){
    if(!source.id||identities.has(source.id))throw Error("Duplicate or missing primary source identity");
    identities.add(source.id);
    const url=new URL(source.url),identifier=arxivId.replace(".","\\.");
    if(url.protocol!=="https:"||url.hostname!=="arxiv.org"||url.username||url.password||url.search||
      !new RegExp(`^/(?:html|abs|pdf)/${identifier}(?:v[0-9]+)?(?:\\.pdf)?$`).test(url.pathname))throw Error("Only this public primary arXiv paper may enter review");
    if(!source.excerpt.trim()||source.excerpt.length>20000)throw Error("Primary excerpt exceeds its bound");
  }
}

/** These phrases describe acquisition; scientific conditions belong in the lesson instead. */
export function subjectNarrationFindings(markdown:string){
  const patterns=[
    /\b(?:supplied|provided|accessible)\s+(?:main[- ]text|main[- ]body|paper|primary)\b/gi,
    /\b(?:supplied|provided|accessible)\s+(?:(?:primary|paper|source|main[- ]body|main[- ]text|appendix)\s+)?(?:evidence|excerpts?|sources?)\b/gi,
    /\bexcerpts?\b/gi,
    /\b(?:missing|omitted|unsupplied|unprovided)\s+(?:appendi(?:x|ces)|implementation\s+details)\b/gi,
    /\bappendi(?:x|ces)\b[^.!?\n]{0,100}\b(?:not supplied|not included|not present|not reproduced|unavailable|absent)\b/gi,
    /\b(?:not supplied|not provided|not present)\s+here\b/gi,
  ];
  return [...new Set(patterns.flatMap(pattern=>[...markdown.matchAll(pattern)].map(match=>match[0])))];
}

/** A selected-section cleanup cannot redirect claims, citations, figures or quiz answers. */
export function applySubjectNarrationEdits(lesson:SubjectLesson,selected:string[],updates:{sectionId:string;markdown:string}[]){
  if(!selected.length||new Set(selected).size!==selected.length||updates.length!==selected.length)throw Error("Every explicitly selected section requires one complete edit");
  const next=structuredClone(lesson),seen=new Set<string>();
  for(const update of updates){
    const section=next.sections.find(section=>section.id===update.sectionId);
    if(!section||!selected.includes(update.sectionId)||seen.has(update.sectionId))throw Error("Unknown, unrelated or repeated section edit");
    seen.add(update.sectionId);
    const findings=subjectNarrationFindings(update.markdown);
    if(findings.length)throw Error(`Section ${update.sectionId} still narrates source acquisition: ${findings.join(", ")}`);
    section.markdown=update.markdown;
  }
  return subjectLessonSchema.parse(next);
}

/** Remove an explicitly named set together, retaining every other teaching relationship. */
export function removeSubjectFigures(lesson:SubjectLesson,identities:string[]){
  if(!identities.length||new Set(identities).size!==identities.length||identities.some(id=>!lesson.figures.some(figure=>figure.id===id)))throw Error("Explicit unique existing figure identities required");
  const removed=new Set(identities);
  return subjectLessonSchema.parse({...lesson,figures:lesson.figures.filter(figure=>!removed.has(figure.id)),sections:lesson.sections.map(section=>removed.has(section.figureId??"")?{...section,figureId:null}:section)});
}
