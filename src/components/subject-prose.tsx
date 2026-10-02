"use client";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { subjectMarkdown,subjectSectionBody } from "@/lib/subject-markdown";

/** Source-derived prose is parsed as Markdown; raw HTML is never executed. */
export function SubjectProse({text,inline=false,sectionTitle}:{text:string;inline?:boolean;sectionTitle?:string}){
  return <ReactMarkdown skipHtml remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{trust:false,strict:"ignore",throwOnError:false,maxExpand:500}]]} components={{
    a:({children,href})=><a href={href} target="_blank" rel="noreferrer">{children}</a>,
    ...(inline ? {p:({children}:{children?:ReactNode})=><span>{children}</span>} : {}),
  }}>{subjectMarkdown(subjectSectionBody(text,sectionTitle),inline)}</ReactMarkdown>;
}
