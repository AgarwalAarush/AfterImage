import { readFile, readdir, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const review = "docs/library-review";
const fixtureRoot = "tests/fixtures/library-reliability";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
function safe(file) {
  if (typeof file !== "string" || path.isAbsolute(file) || file.includes("\\") || file.split("/").some((part) => !part || part === ".." || part === "." || /^\.env/.test(part) || [".git", ".artifacts", ".data", ".assistant-runtime", "node_modules", ".next", ".vercel"].includes(part)) || /\.(sqlite|db|pem|key)$/i.test(file)) throw new Error(`Unsafe manifest path: ${file}`);
  return file;
}
async function verify(file, digest) {
  safe(file);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`Invalid digest: ${file}`);
  if (!(await lstat(path.join(root, file))).isFile()) throw new Error(`Not a regular file: ${file}`);
  if (sha(await readFile(path.join(root, file))) !== digest) throw new Error(`Hash mismatch: ${file}`);
}
const manifest = await json(`${review}/source-manifest.json`);
for (const [file, digest] of Object.entries(manifest.files)) await verify(file, digest);
for (const [base, metadata] of [[fixtureRoot, await json(`${fixtureRoot}/manifest.json`)], [review, await json(`${review}/evidence-manifest.json`)]]) {
  for (const entry of metadata.files) {
    const file = `${base}/${safe(entry.path)}`;
    await verify(file, entry.sha256);
    if (manifest.files[file] !== entry.sha256) throw new Error(`Evidence absent from source manifest: ${file}`);
  }
}
const packagingPaths = new Set(["AGENTS.md", "README.md", "vercel.json", "tests/canonical-evidence.test.ts", "tests/component-worklist.test.ts", "tests/equation-provenance.test.ts"]);
const implemented = await json(`${review}/implemented-source-manifest.json`);
for (const [file, digest] of Object.entries(implemented)) {
  if (!packagingPaths.has(file)) await verify(file, digest);
  if (!Object.hasOwn(manifest.files, file)) throw new Error(`Implementation source absent: ${file}`);
}
const implementationFiles = ["package-lock.json"];
for (const directory of ["worker", "worker/fonts", "src/lib"]) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (entry.isFile() && /\.(ts|py|otf|ttf|woff2)$/.test(entry.name)) implementationFiles.push(`${directory}/${entry.name}`);
  }
}
const hash = createHash("sha256");
for (const file of implementationFiles.sort()) hash.update(file).update(await readFile(path.join(root, file)));
const digest = hash.digest("hex");
const expected = "b835cab8087fc0faa6064cb57080257d4892d15d30eccddc2a8623aa79fe6329";
if (digest !== expected || manifest.implementationDigest !== expected) throw new Error("Implementation digest changed");
const vercel = await json("vercel.json");
if (vercel.git?.deploymentEnabled?.["codex/library-reliability-*"] !== false) throw new Error("Review branch deployment guard missing");
console.log(`Verified ${Object.keys(manifest.files).length} handoff files, saved-case/log hashes, unchanged implementation ${digest}, and review deployment guard.`);
