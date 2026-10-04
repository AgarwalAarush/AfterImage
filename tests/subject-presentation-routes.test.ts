import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { auditSubjectRouteInventory, subjectPresentationRouteFiles } from "../src/lib/subject-presentation-routes";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "subjects-route-inventory-"));
  try {
    for (const file of subjectPresentationRouteFiles) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), "export default function Page(){return null;}");
    }
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function add(root: string, file: string) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), "export default function Added(){return null;}");
}

test("all current route presentation entrypoints are classified, including development review", async () => {
  const inventory = await auditSubjectRouteInventory();
  assert.equal(inventory.version, "subjects-route-inventory-v1");
  assert.deepEqual(inventory.sourceFiles, subjectPresentationRouteFiles);
  assert.ok(inventory.sourceFiles.includes("src/app/layout.tsx"));
  assert.ok(inventory.sourceFiles.includes("src/app/subjects/review/workspace/frame/page.tsx"));
});

test("new feature routes and nested Subjects wrappers require explicit classification", async () => {
  for (const file of ["src/app/new-interest/page.tsx", "src/app/subjects/layout.tsx", "src/app/subjects/[id]/template.tsx", "src/app/subjects/error.tsx"]) {
    await fixture(async root => {
      await add(root, file);
      await assert.rejects(auditSubjectRouteInventory(root), /Unclassified subject presentation route/);
    });
  }
});

test("route groups, parallel routes, alternate formats and global boundaries cannot evade discovery", async () => {
  for (const file of ["src/app/(research)/subjects/layout.tsx", "src/app/@overlay/default.tsx", "src/app/another/page.jsx", "src/app/notes/page.mdx", "src/app/global-not-found.tsx", "src/app/api/interactive/page.tsx"]) {
    await fixture(async root => {
      await add(root, file);
      await assert.rejects(auditSubjectRouteInventory(root), /Unclassified subject presentation route/);
    });
  }
});

test("deleting or renaming a classified route fails closed", async () => {
  await fixture(async root => {
    await rm(path.join(root, "src/app/subjects/[id]/page.tsx"));
    await assert.rejects(auditSubjectRouteInventory(root), /Missing classified subject presentation route/);
  });
});

test("API handlers and colocated helpers are not presentation roots", async () => {
  await fixture(async root => {
    await add(root, "src/app/api/example/route.ts");
    await add(root, "src/app/subjects/content-helper.ts");
    assert.deepEqual((await auditSubjectRouteInventory(root)).sourceFiles, subjectPresentationRouteFiles);
  });
});

test("route-tree symlinks cannot hide unclassified sources", async () => {
  await fixture(async root => {
    await mkdir(path.join(root, "other"));
    await writeFile(path.join(root, "other/page.tsx"), "export default function Page(){return null;}");
    await symlink(path.join(root, "other"), path.join(root, "src/app/linked"));
    await assert.rejects(auditSubjectRouteInventory(root), /cannot contain a symlink/);
  });
});
