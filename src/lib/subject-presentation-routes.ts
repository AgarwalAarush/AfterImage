import { readdir, realpath } from "node:fs/promises";
import path from "node:path";

export const subjectRouteInventoryVersion = "subjects-route-inventory-v1" as const;
/**
 * Explicit route classification, not visual acceptance. Entry contents and their
 * import closure are separately bound by the integration presentation digest.
 * Adding a route, layout or error boundary requires classifying it here first.
 */
export const subjectPresentationRouteFiles = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/direction/page.tsx",
  "src/app/documents/page.tsx",
  "src/app/documents/[id]/page.tsx",
  "src/app/library/page.tsx",
  "src/app/login/page.tsx",
  "src/app/papers/[id]/loading.tsx",
  "src/app/papers/[id]/page.tsx",
  "src/app/subjects/page.tsx",
  "src/app/subjects/[id]/page.tsx",
  "src/app/subjects/review/page.tsx",
  "src/app/subjects/review/mechanisms/[id]/page.tsx",
  "src/app/subjects/review/workspace/page.tsx",
  "src/app/subjects/review/workspace/frame/page.tsx",
].sort();

// These conventions can render or wrap route UI. route.ts handlers do not.
// Include JS/MDX and less common conventions so a future format cannot silently
// create a presentation entrypoint outside the manifest.
const presentationEntry = /^(?:page|layout|template|loading|error|global-error|not-found|global-not-found|default|forbidden|unauthorized|head)\.(?:[cm]?[jt]sx?|mdx)$/;

/** Discover physical paths, including route groups and parallel routes. */
export async function auditSubjectRouteInventory(root = process.cwd()) {
  const workspace = await realpath(root);
  const known = new Set(subjectPresentationRouteFiles);
  const discovered = new Set<string>();
  async function visit(relative: string) {
    const absolute = await realpath(path.join(workspace, relative));
    if (!absolute.startsWith(workspace + path.sep)) throw new Error("Subject route inventory escapes the workspace");
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name);
      // Conservatively reject route-tree aliases; their contents must not change
      // while the route inventory's apparent paths remain fixed.
      if (entry.isSymbolicLink()) throw new Error(`Subject route inventory cannot contain a symlink: ${file}`);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && presentationEntry.test(entry.name)) {
        if (!known.has(file)) throw new Error(`Unclassified subject presentation route: ${file}`);
        discovered.add(file);
      }
    }
  }
  await visit("src/app");
  for (const file of known) if (!discovered.has(file)) throw new Error(`Missing classified subject presentation route: ${file}`);
  return { version: subjectRouteInventoryVersion, sourceFiles: [...discovered].sort() };
}
