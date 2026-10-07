import { createHash } from "node:crypto";
import witness from "./subject-renderer-boundary.json";

export const subjectRendererBoundary = witness;
export const subjectDiagramTextFile = witness.targetFile;
const hash = (source:string|Buffer) => createHash("sha256").update(source).digest("hex");
/** A literal import relocation is equivalent only with the exact extracted helper. */
export function subjectRendererSource(file:string,source:string|Buffer,helper:string|Buffer|undefined) {
  const text=Buffer.isBuffer(source)?source.toString("utf8"):source;
  if(file!==witness.relocatedFile||helper===undefined||hash(helper)!==witness.targetFileDigest)return text;
  if(text.split(witness.currentImport).length!==2)return text;
  return text.replace(witness.currentImport,witness.legacyImport);
}
export function subjectDiagramTextIsHistorical(source:string|Buffer|undefined) {
  return source!==undefined&&hash(source)===witness.targetFileDigest;
}
