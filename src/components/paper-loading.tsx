"use client";

import { ThinkingOrb } from "thinking-orbs";

function PaperOutline() {
  return <div className="pdf-paper-outline" aria-hidden="true">
    <div className="pdf-outline-title"/><div className="pdf-outline-subtitle"/>
    <div className="pdf-outline-columns"><div/><div/></div>
  </div>;
}

export function PaperLoading() {
  return <div className="pdf-loading" role="status">
    <div className="pdf-loading-sheet"><PaperOutline/></div>
    <div className="pdf-loading-orb" aria-hidden="true"><ThinkingOrb state="working" size={64} speed={.75}/></div>
    <span className="sr-only">Loading original paper</span>
  </div>;
}

export function PaperPagePlaceholder({active}:{active:boolean}) {
  return <div className="pdf-page-loading" aria-hidden="true">
    <PaperOutline/>
    {active&&<div className="pdf-loading-orb"><ThinkingOrb state="working" size={64} speed={.75} theme="light"/></div>}
  </div>;
}
