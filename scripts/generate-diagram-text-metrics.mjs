import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url),createFont=require("next/dist/compiled/@next/font/dist/fontkit/index.js").default;
const manifestPath="src/lib/diagram-text-metrics.json",sourcePath="worker/fonts/OverusedGrotesk-Roman.otf",publicPath="public/fonts/OverusedGrotesk-VF.woff2";
const sha=path=>createHash("sha256").update(readFileSync(path)).digest("hex");
export function verifyDiagramFontDigests(manifest,{publicOnly=false}={}){
  if(manifest.publicFont.sha256!==sha(publicPath))throw new Error("Diagram public font changed; regenerate metrics and repeat browser font acceptance");
  if(!publicOnly&&manifest.sourceFont.sha256!==sha(sourcePath))throw new Error("Diagram metric source font changed; regenerate metrics and repeat browser font acceptance");
}

function generate(){
  // The checked-in static Roman400 instance avoids fontkit's unsupported WOFF2
  // variable glyph transformation. Browser400 accuracy is independently tested.
  const font=createFont(readFileSync(sourcePath));
  const points=[...Array.from({length:95},(_,i)=>i+32),...Array.from({length:384},(_,i)=>i+160),...Array.from({length:144},(_,i)=>i+880),...Array.from({length:160},(_,i)=>i+8192),...Array.from({length:512},(_,i)=>i+8592)];
  const characters=points.map(point=>String.fromCodePoint(point)).filter(char=>font.hasGlyphForCodePoint(char.codePointAt(0)));
  const advance={},kerning={};
  const measure=text=>font.layout(text).positions.reduce((sum,item)=>sum+item.xAdvance,0);
  for(const char of characters)advance[char]=measure(char);
  // ASCII label pairs cover native English teaching labels; Unicode pairs are
  // also captured, so future supported symbols keep the font's real kerning.
  for(const left of characters)for(const right of characters){
    const delta=measure(left+right)-advance[left]-advance[right];
    if(delta)kerning[left+right]=delta;
  }
  const manifest={version:1,family:"Overused Grotesk",weight:400,unitsPerEm:font.unitsPerEm,
    sourceFont:{path:sourcePath,sha256:sha(sourcePath)},publicFont:{path:publicPath,sha256:sha(publicPath)},
    shaping:"Static Roman400 advances and pair kerning; public variable400 checked against browser metrics",unknownGlyphAdvance:font.unitsPerEm*2,advance,kerning};
  writeFileSync(manifestPath,JSON.stringify(manifest)+"\n");
  console.log(JSON.stringify({characters:characters.length,kernedPairs:Object.keys(kerning).length,manifest:manifestPath}));
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],"file:").href){
  try{
    if(process.argv.includes("--check")||process.argv.includes("--check-public")){
      verifyDiagramFontDigests(JSON.parse(readFileSync(manifestPath,"utf8")),{publicOnly:process.argv.includes("--check-public")});
      console.log("Diagram font digests match the generated metrics.");
    }else generate();
  }catch(error){console.error(error.message);process.exitCode=1;}
}
