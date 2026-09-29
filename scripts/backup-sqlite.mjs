import { backup, DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, linkSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const [source, directory] = process.argv.slice(2);
if (!source || !directory || !path.isAbsolute(source) || !path.isAbsolute(directory)) {
  console.error("Usage: node scripts/backup-sqlite.mjs <absolute-source.sqlite> <absolute-backup-directory>");
  process.exit(2);
}
if (!existsSync(source)) throw new Error("Source database does not exist.");
process.umask(0o077);
mkdirSync(directory, { recursive: true, mode: 0o700 });
if ((statSync(directory).mode & 0o077) !== 0)
  throw new Error("Backup directory must be private (mode 0700).");

const name = `afterimage-${new Date().toISOString().replaceAll(":", "-")}.sqlite`;
const destination = path.join(directory, name);
const temporary = path.join(directory, `.${name}.${randomUUID()}.tmp`);
const database = new DatabaseSync(source, { readOnly: true });
try {
  const starting = database.prepare("SELECT version FROM state WHERE id=1").get();
  if (!starting || !Number.isSafeInteger(starting.version))
    throw new Error("Source database has no valid state version.");
  await backup(database, temporary);
  const copy = new DatabaseSync(temporary, { readOnly: true });
  try {
    const integrity = copy.prepare("PRAGMA integrity_check").get();
    if (integrity.integrity_check !== "ok") throw new Error("Backup integrity check failed.");
    const saved = copy.prepare("SELECT version FROM state WHERE id=1").get();
    if (!saved || !Number.isSafeInteger(saved.version) || saved.version < starting.version)
      throw new Error("Backup state version is invalid.");
    chmodSync(temporary, 0o600);
    linkSync(temporary, destination);
    console.log(JSON.stringify({ path: destination, version: saved.version, bytes: statSync(destination).size }));
  } finally {
    copy.close();
  }
} finally {
  database.close();
  // Opening a WAL-mode backup for verification can create empty WAL and SHM
  // sidecars next to the temporary file, even with a read-only connection.
  for (const file of [temporary, `${temporary}-wal`, `${temporary}-shm`])
    if (existsSync(file)) unlinkSync(file);
}
