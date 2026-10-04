import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertIsolatedFeatureCss, auditSubjectFeatureIsolation } from "../src/lib/subject-presentation-isolation";

const reject = (css: string) => assert.throws(() => assertIsolatedFeatureCss(css), /isolation failed/);

test("all current recommendation feature styles pass isolation", async () => {
  const result = await auditSubjectFeatureIsolation();
  assert.deepEqual(result.cssFiles, [
    "src/components/home.module.css", "src/components/paper-feedback.module.css",
    "src/components/reading-direction.module.css", "src/components/reading-interests.module.css",
  ]);
  assert.ok(result.sourceFiles.includes("src/components/paper-card-copy.ts"));
  assert.ok(!result.sourceFiles.includes("src/components/app.tsx"));
  for (const file of result.cssFiles) assert.doesNotThrow(() => assertIsolatedFeatureCss(".local { color: red; }", file));
});

test("preserves local descendants, native controls, and local sibling targets", () => {
  assertIsolatedFeatureCss(`
    .root { display: grid; }
    .root :is(h3, h4) { color: var(--ink); }
    .root input[aria-label="one, two"]:checked + span::after { content: ""; }
    .suggestion + .suggestion { border-top: 1px solid; }
    .suggestion ~ .suggestion button { color: inherit; }
    .root > label:not(.disabled) { cursor: pointer; }
    @media (hover: hover) { .root button:hover { color: red; } }
    @supports (display: grid) { @container (min-width: 400px) { .root > * { display: grid; } } }
  `);
});

test("preserves zero-specificity ownership wrappers and in-subtree sibling rules", () => {
  assertIsolatedFeatureCss(`
    :where(.scope):global(.suggestion-feedback summary) { height: 34px; }
    :where(.scope):global(.reader-feedback[open] summary) { color: inherit; }
    :where(.scope) :global(.interest-row + .interest-row) { margin-top: 8px; }
    :where(.scope) :global(.engagement-switch input:checked + .engagement-switch-face::after) { opacity: 1; }
    :where(.scope) :global(.one), :where(.scope) :global(.two) { display: flex; }
    :where(.scope) :global(.row) + :global(.row) { padding: 2px; }
  `);
});

test("every selector list branch must be owned", () => {
  reject(".scope, body { color: red; }");
  reject(".scope, button { color: red; }");
  reject(".scope, :is(button, a) { color: red; }");
  reject(".root :is(.safe, body) { color: red; }");
});

test("global escapes require the first local ownership wrapper", () => {
  reject(":global(body) { color: red; }");
  reject(".scope :global(button) { color: red; }");
  reject(":global(.outside) :where(.scope) { color: red; }");
  reject(":where(:global(.scope)) button { color: red; }");
  reject(":where(.scope) :global(.safe, button) { color: red; }");
  reject(":where(.scope) :global(:global(.safe)) { color: red; }");
  reject(":where(.scope) :is(:global(button)) { color: red; }");
});

test("sibling selectors cannot escape a module-owned root", () => {
  reject(".root + button { color: red; }");
  reject(".root ~ button span { color: red; }");
  reject(":where(.scope) + :global(.outside) { color: red; }");
  reject(":where(.scope):global(.root + .outside button) { color: red; }");
  reject(":where(.scope):global(.root) ~ :global(.outside) { color: red; }");
});

test("negation, relational selectors, and IDs cannot falsely establish ownership", () => {
  reject(":not(.root) { color: red; }");
  reject(":is(.root, button) { color: red; }");
  reject("button:has(.root) { color: red; }");
  reject("#root { color: red; }");
  reject(":is(.root + button) { color: red; }");
});

test("document selectors, unsupported syntax, and selector escaping fail closed", () => {
  for (const selector of [".root body", ".root HTML", ".root :root", ".root :host", ".root :host-context(body)",
    ".root \\62 ody", ".root &", ".root || div", ".root :nth-child(2n of body)", ".root >>> button",
    ".root >", ".root,,.other", ".root/**/ + button"])
    reject(`${selector} { color: red; }`);
});

test("global at-rules and composition imports fail closed at every depth", () => {
  for (const css of [
    '@import "./global.css";', '@import url("./global.css");',
    '@font-face { font-family: Global; src: url("font.woff2"); }',
    '@property --ink { syntax: "<color>"; inherits: true; initial-value: red; }',
    '@layer reset, base;', '@keyframes global { to { opacity: 0; } }',
    '@media (min-width: 1px) { @font-face { font-family: Global; } }',
    '.root { composes: shared from "./global.css"; }',
    '.root { compose-with: shared; }', ':export { shared: foo; }',
    '@media (min-width: 1px) { color: red; }', '.root { @media (min-width: 1px) { color: red; } }',
  ]) reject(css);
});

async function fixture(files: Record<string, string>, run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "afterimage-feature-isolation-"));
  try {
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), content);
    }
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const audit = (root: string) => auditSubjectFeatureIsolation({ root, featureRoots: ["src/feature.tsx"], trustedBoundaries: [] });

test("new transitive feature CSS Modules are discovered and validated without a fixed CSS allowlist", async () => {
  await fixture({
    "src/feature.tsx": 'import "./nested"; export default function Feature(){ return <div/>; }',
    "src/nested/index.ts": 'export { styles } from "../extra";',
    "src/extra.ts": 'import styles from "./new.module.css"; export { styles };',
    "src/new.module.css": '.newTopic { color: red; }',
  }, async root => {
    const result = await audit(root);
    assert.deepEqual(result.cssFiles, ["src/new.module.css"]);
    await writeFile(path.join(root, "src/new.module.css"), '.newTopic, body { color: red; }');
    await assert.rejects(audit(root), /document selectors/);
  });
});

test("global CSS imports cannot bypass isolation through static or dynamic imports", async () => {
  for (const statement of ['import "./leak.css";', 'export * from "./leak.css";', 'void import("./leak.css");', 'require("./leak.css");']) {
    await fixture({ "src/feature.tsx": statement, "src/leak.css": ".local { color: red; }" }, async root => {
      await assert.rejects(audit(root), /CSS Modules/);
    });
  }
});

test("computed imports, unknown packages and unresolved local imports fail closed", async () => {
  for (const statement of ['void import(stylePath);', 'require(stylePath);', 'import "unreviewed-global-styles";',
    'import "./missing";', 'import "./safe.module.css?global";']) {
    await fixture({ "src/feature.tsx": statement }, async root => {
      await assert.rejects(audit(root), /isolation failed/);
    });
  }
});

test("type-only imports do not expand runtime scope and strings/comments are not mistaken for imports", async () => {
  await fixture({ "src/feature.tsx": `
    import type { Missing } from './absent';
    import { type Other } from './also-absent';
    const text = 'import "./not-a-real-style.css"';
    // import './not-real.css';
    export const Feature = () => <div>{text}</div>;
  ` }, async root => {
    assert.deepEqual((await audit(root)).cssFiles, []);
  });
});

test("trusted shared boundaries stop traversal only at exact separately bound files", async () => {
  await fixture({
    "src/feature.tsx": 'import "./shared";',
    "src/shared.ts": 'import "./global.css";',
    "src/global.css": 'body { color: red; }',
  }, async root => {
    await assert.rejects(audit(root), /CSS Modules/);
    const result = await auditSubjectFeatureIsolation({ root, featureRoots: ["src/feature.tsx"], trustedBoundaries: ["src/shared.ts"] });
    assert.deepEqual(result.sourceFiles, ["src/feature.tsx"]);
  });
});

test("actual feature CSS contents remain independent of the policy helper bytes", async () => {
  const helper = await readFile("src/lib/subject-presentation-isolation.ts", "utf8");
  assert.ok(!helper.includes('"src/components/home.module.css"'));
  assert.ok(!helper.includes('"src/components/reading-interests.module.css"'));
});
