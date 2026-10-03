import { mkdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fingerprint, type RepairCheckpoint } from "./repair-controller";

export type KitCheckpoint = { version: 1; binding: string; componentId: string; candidate?: unknown; repair?: RepairCheckpoint<unknown>; evidenceDecisions?: [string, unknown][]; sources?: import("../src/lib/types").Source[]; exhausted?: boolean };
/** Opaque identities only; worker drafts never cross the storage bridge. */
export class KitCheckpoints {
  constructor(private root: string, private paperId: string, private beforeWrite?: () => Promise<void>) {}
  private file(id: string) { return path.join(this.root, fingerprint(this.paperId), fingerprint(id) + ".json"); }
  async read(id: string, binding: string): Promise<KitCheckpoint | undefined> {
    try {
      const file = this.file(id);
      if ((await stat(file)).size > 8_000_000) return;
      const data = JSON.parse(await readFile(file, "utf8")) as KitCheckpoint;
      if (data.version === 1 && data.binding === binding && data.componentId === id) return data;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; }
  }
  async write(value: KitCheckpoint) {
    await this.beforeWrite?.();
    const file = this.file(value.componentId);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text) > 8_000_000) throw new Error("Checkpoint exceeds bound");
    await writeFile(file + ".tmp", text, { mode: 0o600 }); await rename(file + ".tmp", file);
  }
}
