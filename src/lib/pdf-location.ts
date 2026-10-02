/** Match source evidence to extracted PDF text, never infer a page from section numbering. */
export function normalizePdfText(text:string){return text.normalize("NFKC").replace(/([\p{L}])-\s*\n\s*(?=[\p{L}])/gu,"$1").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();}
export type PdfTextPage={page:number;text:string};
export type PdfMatch={page:number;needle:string;method:"passage"|"heading"};
export function locatePdfSource(pages:PdfTextPage[],source:{label:string;excerpt:string}):PdfMatch|null{
  const excerpt=source.excerpt.split(/\[(?:EXTRACTION|SOURCE BUDGET)/)[0];
  const candidates=excerpt.split(/\n\n|(?<=[.!?])\s+/).filter(text=>!text.startsWith("LATEX:")&&!text.startsWith("TABLE"))
    .map(normalizePdfText).filter(text=>text.split(" ").length>=10).slice(0,12).map(text=>text.split(" ").slice(0,18).join(" "));
  const normalized=pages.map(page=>({...page,text:normalizePdfText(page.text)}));
  for(const needle of candidates){const matches=normalized.filter(page=>page.text.includes(needle));if(matches.length===1&&matches[0].text.indexOf(needle)===matches[0].text.lastIndexOf(needle))return {page:matches[0].page,needle,method:"passage"};}
  const heading=normalizePdfText(source.label.replace(/^Original paper\s*[·:]\s*/i,"").replace(/\s*· part \d+$/i,"").replace(/^\d+(?:\.\d+)*[.)]?\s+/,""));
  if(heading.length>=12){const matches=normalized.filter(page=>page.text.includes(heading));if(matches.length===1&&matches[0].text.indexOf(heading)===matches[0].text.lastIndexOf(heading))return {page:matches[0].page,needle:heading,method:"heading"};}
  return null;
}
