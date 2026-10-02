import manifest from "./diagram-text-metrics.json";

const advances:Record<string,number>=manifest.advance,kerns:Record<string,number>=manifest.kerning;
export const diagramTextFont={family:manifest.family,weight:manifest.weight,publicDigest:manifest.publicFont.sha256,sourceDigest:manifest.sourceFont.sha256};

/** Pure browser/server width calculation; no font file parsing enters the client.
 * Unknown glyphs reserve two ems and still require actual-font visual review. */
export function diagramTextWidth(value:string,size:number){
  const chars=[...value];let units=0;
  for(let i=0;i<chars.length;i++){
    units+=advances[chars[i]]??manifest.unknownGlyphAdvance;
    if(i&&advances[chars[i]]!==undefined&&advances[chars[i-1]]!==undefined)units+=kerns[chars[i-1]+chars[i]]??0;
  }
  return units*size/manifest.unitsPerEm;
}
export function diagramTextUsesFallback(value:string){return [...value].some(char=>advances[char]===undefined);}

/** Wrap complete words by their shaped width, then split only overlong words. */
export function wrapDiagramTextByWidth(value:string,maxWidth:number,size:number):string[]{
  if(!Number.isFinite(maxWidth)||maxWidth<=0||!Number.isFinite(size)||size<=0)throw new Error("Invalid diagram text width or font size");
  const lines:string[]=[];let line="";
  for(const word of value.trim().split(/\s+/).filter(Boolean)){
    const candidate=line?line+" "+word:word;
    if(diagramTextWidth(candidate,size)<=maxWidth){line=candidate;continue;}
    if(line){lines.push(line);line="";}
    for(const char of word){
      if(diagramTextWidth(char,size)>maxWidth)throw new Error("Diagram glyph exceeds the available readable width");
      if(line&&diagramTextWidth(line+char,size)>maxWidth){lines.push(line);line="";}
      line+=char;
    }
  }
  if(line)lines.push(line);
  return lines;
}
