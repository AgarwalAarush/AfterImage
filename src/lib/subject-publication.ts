import { createHash } from "node:crypto";
import { publishedSubjectSourceSchema, subjectPublicLessonSchema, type SubjectLesson, type SubjectPublicLesson, type PublishedLesson } from "./subjects";

/** Bind reviewed prose to its source URLs, extraction version, and captured evidence hashes. */
export function subjectPublicationDigest(lesson:SubjectPublicLesson,metadata:Pick<PublishedLesson,"id"|"pipelineVersion"|"sources">){
  return createHash("sha256").update(JSON.stringify({content:subjectPublicLessonSchema.parse(lesson),id:metadata.id,
    pipelineVersion:metadata.pipelineVersion,sources:metadata.sources.map(source=>publishedSubjectSourceSchema.parse(source))})).digest("hex");
}

/** Call only after the private source, math, and teaching reviews have passed. */
export function publishSubjectLesson(lesson:SubjectLesson,metadata:Pick<PublishedLesson,"id"|"createdAt"|"pipelineVersion"|"sources">):PublishedLesson{
  const content=subjectPublicLessonSchema.parse(lesson);
  return {...content,...metadata,review:{status:"passed",reviewedAt:new Date().toISOString(),
    contentDigest:subjectPublicationDigest(content,metadata)}};
}
