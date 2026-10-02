/** Suppress a duplicated authored heading only when the reader already displays it. */
export function subjectSectionBody(text:string,title?:string){
  if(!title)return text;
  const leading=text.match(/^\s*#{1,6}\s+([^\n]+)\n(?:\s*\n)?/);
  if(!leading)return text;
  const normalize=(value:string)=>value.replace(/\s+#+\s*$/," ").replace(/^\s*\d+[.)]\s+/,"").replace(/\s+/g," ").trim().toLocaleLowerCase("en");
  return normalize(leading[1])===normalize(title)?text.slice(leading[0].length):text;
}

/** Accept the two common TeX delimiter styles while preserving literal code. */
export function subjectMarkdown(text:string,inline=false){
  return text.split(/((?:^|\n)(?:```|~~~)[\s\S]*?(?:\n(?:```|~~~)(?=\n|$)|$)|`+[^`\n]*`+)/g).map((part,index)=>{
    if(index%2)return part;
    const normalized=part.replace(/\\\(([\s\S]*?)\\\)/g,(_marker,math:string)=>`$${math}$`)
      .replace(/\\\[([\s\S]*?)\\\]/g,(_marker,math:string)=>`$$${math}$$`);
    return normalized.replace(/\$\$([\s\S]*?)\$\$/g,(_marker,math:string)=>inline?`$${math.trim()}$`:`\n\n$$\n${math.trim()}\n$$\n\n`);
  }).join("");
}
