import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,readdirSync} from "node:fs";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import metrics from "../src/lib/diagram-text-metrics.json";
import {diagramTextUsesFallback,diagramTextWidth,wrapDiagramTextByWidth} from "../src/lib/diagram-text-metrics";
import {layoutSubjectMechanism,inspectSubjectMechanismGeometry} from "../src/lib/subject-mechanism";
import {verifyDiagramFontDigests} from "../scripts/generate-diagram-text-metrics.mjs";

const require=createRequire(import.meta.url),createFont=require("next/dist/compiled/@next/font/dist/fontkit/index.js").default;
const font=createFont(readFileSync(new URL("../worker/fonts/OverusedGrotesk-Roman.otf",import.meta.url)));
const shape=(text:string,size:number)=>font.layout(text).positions.reduce((sum:number,item:{xAdvance:number})=>sum+item.xAdvance,0)*size/font.unitsPerEm;

test("metric manifest is bound to both fonts and rejects checksum drift",()=>{
  for(const entry of [metrics.sourceFont,metrics.publicFont])assert.equal(createHash("sha256").update(readFileSync(entry.path)).digest("hex"),entry.sha256);
  verifyDiagramFontDigests(metrics);
  const changedPublic={...metrics,publicFont:{...metrics.publicFont,sha256:"0".repeat(64)}};
  assert.throws(()=>verifyDiagramFontDigests(changedPublic,{publicOnly:true}),/public font changed/);
  const changedSource={...metrics,sourceFont:{...metrics.sourceFont,sha256:"0".repeat(64)}};
  assert.throws(()=>verifyDiagramFontDigests(changedSource),/source font changed/);
  assert.doesNotThrow(()=>verifyDiagramFontDigests(changedSource,{publicOnly:true}),"Vercel public-font check does not depend on the excluded worker font");
});

test("static400 metrics agree with actual browser variable400 encoder measurements",()=>{
  for(const [text,size,browserWidth] of [["Acoustic encoder",15,114.046875],["Acoustic encoder layers",12,123.828125]] as const){
    assert.ok(Math.abs(diagramTextWidth(text,size)-browserWidth)<=.25,`${text}: browser/reference font must agree within quarter pixel`);
  }
  assert.ok(Math.abs(diagramTextWidth("Acoustic encoder layers",12)-"Acoustic encoder layers".length*6.5)>25,"reject the prior character-count approximation's large empty gap");
});

test("all authored object lines use exact supported font metrics or an explicit conservative fallback",()=>{
  const directory=new URL("../src/content/subjects/mechanisms/",import.meta.url);
  for(const file of readdirSync(directory).filter(file=>file.endsWith(".json"))){
    const mechanism=JSON.parse(readFileSync(new URL(file,directory),"utf8"));
    for(const width of [760,700,560,380]){
      const layout=layoutSubjectMechanism(mechanism,width);
      assert.deepEqual(inspectSubjectMechanismGeometry(mechanism,layout),[]);
      for(const labels of layout.nativeLabels){
        assert.equal(labels.fontFallback,diagramTextUsesFallback(labels.title.join("")+labels.detail.join("")),`${file}/${labels.id} must declare fallback use`);
        for(const [lines,size] of [[labels.title,15],[labels.detail,12]] as const)for(const line of lines){
          if(diagramTextUsesFallback(line))assert.ok(diagramTextWidth(line,size)>=shape(line,size),"unknown native-font glyphs must reserve space rather than claim exact measurements");
          else assert.ok(Math.abs(diagramTextWidth(line,size)-shape(line,size))<.001,`${file}/${labels.id}: ${line}`);
        }
      }
    }
  }
  assert.ok(diagramTextWidth("AV",15)<diagramTextWidth("A",15)+diagramTextWidth("V",15),"real pair kerning must affect width");
});

test("wrapping uses measured width, retains complete text, and reserves unknown glyphs conservatively",()=>{
  const text="Narrow iiiii words followed by WIDEWWWWWWWWWWWW",limit=90,size=15;
  const lines=wrapDiagramTextByWidth(text,limit,size);
  assert.equal(lines.join("").replaceAll(" ",""),text.replaceAll(" ",""));
  assert.ok(lines.every(line=>diagramTextWidth(line,size)<=limit));
  assert.equal(wrapDiagramTextByWidth("iiiiiiiiiiiiiiiiiiii",90,15).length,1,"narrow glyphs need not inherit a broad average character width");
  assert.equal(diagramTextUsesFallback("🧪"),true);
  assert.equal(diagramTextWidth("🧪",15),30);
  assert.throws(()=>wrapDiagramTextByWidth("🧪",20,15),/glyph exceeds/);
});

test("encoder text group and badge are positioned by font metrics rather than the previous inflated width",()=>{
  const mechanism=JSON.parse(readFileSync(new URL("../src/content/subjects/mechanisms/whisper.json",import.meta.url),"utf8"));
  const layout=layoutSubjectMechanism(mechanism,760),encoder=mechanism.objects.find((object:{label:string})=>object.label==="Acoustic encoder"),labels=layout.nativeLabels.find(item=>item.id===encoder.id)!;
  assert.equal(labels.inlineGlyph,true);
  const actualRight=labels.detailX+shape(labels.detail[0],12);
  assert.ok(Math.abs(labels.glyphOffset!-actualRight-12)<.001,"badge reserved area stays twelve pixels from the actual shaped text");
  const old=structuredClone(layout),oldLabels=old.nativeLabels.find(item=>item.id===encoder.id)!;
  oldLabels.glyphOffset=oldLabels.detailX+oldLabels.detail[0].length*6.5+12;
  assert.ok(inspectSubjectMechanismGeometry(mechanism,old).some(issue=>issue.code==="glyph-association"),"the old inflated-width arrangement now fails the shared inspector");
});

test("unknown-font text uses a centered separate glyph row instead of an estimated inline badge",()=>{
  const mechanism=JSON.parse(readFileSync(new URL("../src/content/subjects/mechanisms/whisper.json",import.meta.url),"utf8"));
  const encoder=mechanism.objects.find((object:{label:string})=>object.label==="Acoustic encoder");
  encoder.detail="Representation τ from the encoder";
  const original=structuredClone(mechanism);
  for(const width of [760,700,560,380]){
    const layout=layoutSubjectMechanism(mechanism,width),labels=layout.nativeLabels.find(item=>item.id===encoder.id)!,node=layout.nodes.find(item=>item.id===encoder.id)!;
    assert.equal(labels.fontFallback,true);
    assert.equal(labels.inlineGlyph,false);
    assert.equal(labels.glyphOffset,null);
    assert.equal(labels.textAnchor,"middle");
    assert.equal(labels.titleX,node.w/2);
    assert.equal(labels.detailX,node.w/2);
    assert.ok(labels.glyphY>=labels.detailY+(labels.detail.length-1)*15+12);
    assert.deepEqual(inspectSubjectMechanismGeometry(mechanism,layout),[]);
    const guessed=structuredClone(layout),bad=guessed.nativeLabels.find(item=>item.id===encoder.id)!;
    bad.inlineGlyph=true;
    assert.ok(inspectSubjectMechanismGeometry(mechanism,guessed).some(issue=>issue.code==="glyph-association"&&issue.message.includes("Unknown-font")));
  }
  assert.deepEqual(mechanism,original,"rendering fallback must preserve scientific text, aliases and states");
});
