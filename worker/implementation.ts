import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
/** Bind evaluation and checkpoint receipts to implementation, dependencies and font bytes. */
export async function implementationDigest(root = process.cwd()) {
  const files = ["package-lock.json"];
  for (const directory of ["worker", "worker/fonts", "src/lib"]) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      if (entry.isFile() && /\.(ts|py|otf|ttf|woff2)$/.test(entry.name)) files.push(`${directory}/${entry.name}`);
    }
  }
  const hash = createHash("sha256");
  for (const file of files.sort()) hash.update(file).update(await readFile(path.join(root, file)));
  return hash.digest("hex");
}
