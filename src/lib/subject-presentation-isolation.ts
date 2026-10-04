import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import postcss from "postcss";

export const subjectFeatureIsolationVersion = "subjects-feature-css-isolation-v1" as const;
export const subjectFeatureRoots = [
  "src/components/home.tsx",
  "src/components/reading-direction.tsx",
  "src/components/paper-feedback.tsx",
  "src/components/reading-interests.tsx",
] as const;

const sharedBoundaries = ["src/components/app.tsx", "src/components/app-context.tsx"];
const externalImports = ["react", "next/link", "next/navigation", "lucide-react"];
const groupingRules = new Set(["media", "supports", "container"]);
const simplePseudoClasses = new Set([
  "hover", "active", "focus", "focus-visible", "focus-within", "checked", "disabled", "enabled",
  "empty", "first-child", "last-child", "only-child", "first-of-type", "last-of-type", "only-of-type",
  "required", "optional", "valid", "invalid", "read-only", "read-write", "placeholder-shown", "link",
  "visited", "any-link", "target", "indeterminate", "default", "open", "autofill",
]);
const pseudoElements = new Set(["before", "after", "marker", "placeholder", "selection"]);
type SelectorToken = { kind: "atom"; local: boolean } | { kind: "combinator"; value: " " | ">" | "+" | "~" };

function fail(file: string, message: string): never {
  throw new Error(`Feature CSS isolation failed in ${file}: ${message}`);
}

/** Split only real selector branches, never commas in attributes or functions. */
function selectorBranches(selector: string, file: string): string[] {
  const branches: string[] = [];
  const stack: string[] = [];
  let quote = "", start = 0;
  if (selector.includes("\\")) fail(file, "escaped selectors require explicit policy review");
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(" || c === "[") stack.push(c);
    else if (c === ")" || c === "]") {
      if (stack.pop() !== (c === ")" ? "(" : "[")) fail(file, "unbalanced selector");
    } else if (c === "," && stack.length === 0) { branches.push(selector.slice(start, i).trim()); start = i + 1; }
  }
  if (quote || stack.length) fail(file, "unbalanced selector");
  branches.push(selector.slice(start).trim());
  if (branches.some(branch => !branch)) fail(file, "empty selector branch");
  return branches;
}

function balancedEnd(text: string, start: number, file: string): number {
  const open = text[start], close = open === "(" ? ")" : "]";
  let depth = 1, quote = "";
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return fail(file, "unbalanced selector");
}

function selectorTokens(selector: string, file: string, global = false, inFunction = false, wrapped = false): SelectorToken[] {
  const tokens: SelectorToken[] = [];
  const identifier = /^[A-Za-z_][A-Za-z0-9_-]*/;
  let i = 0;
  function atom(local = false) { tokens.push({ kind: "atom", local }); }
  while (i < selector.length) {
    const c = selector[i];
    if (/\s/.test(c)) {
      while (/\s/.test(selector[++i] ?? "") && i < selector.length) { /* consume */ }
      tokens.push({ kind: "combinator", value: " " });
    } else if (c === ">" || c === "+" || c === "~") {
      tokens.push({ kind: "combinator", value: c }); i++;
    } else if (c === "." || c === "#") {
      const name = selector.slice(i + 1).match(identifier)?.[0];
      if (!name) fail(file, "unsupported class or ID selector");
      // Classes are module-owned; IDs deliberately cannot establish ownership.
      atom(c === "." && !global); i += name.length + 1;
    } else if (c === "[") {
      const end = balancedEnd(selector, i, file);
      if (!/^\[\s*[A-Za-z_][\w-]*(?:\s*(?:[~|^$*]?=)\s*(?:"[^"]*"|'[^']*'|[\w-]+)\s*(?:[is]\s*)?)?\]$/.test(selector.slice(i, end + 1)))
        fail(file, "unsupported attribute selector");
      atom(); i = end + 1;
    } else if (c === ":") {
      const element = selector[i + 1] === ":";
      i += element ? 2 : 1;
      const name = selector.slice(i).match(identifier)?.[0]?.toLowerCase();
      if (!name) fail(file, "unsupported pseudo selector");
      i += name.length;
      if (selector[i] === "(") {
        const end = balancedEnd(selector, i, file), inner = selector.slice(i + 1, end);
        if (element) fail(file, "functional pseudo elements require explicit policy review");
        if (name === "global") {
          if (!wrapped || global || inFunction) fail(file, ":global requires the first local :where(.scope) wrapper");
          const branches = selectorBranches(inner, file);
          if (branches.length !== 1) fail(file, ":global selector lists are forbidden");
          tokens.push(...selectorTokens(inner, file, true, false, true));
        } else if (name === "is" || name === "where" || name === "not") {
          const alternatives = selectorBranches(inner, file).map(branch => selectorTokens(branch, file, global, true, false));
          if (alternatives.some(branch => branch.some(token => token.kind === "combinator")))
            fail(file, "complex functional selectors require explicit policy review");
          atom(name !== "not" && alternatives.every(branch => branch.some(token => token.kind === "atom" && token.local)));
        } else fail(file, `unsupported functional selector :${name}`);
        i = end + 1;
      } else {
        if (!(element ? pseudoElements : simplePseudoClasses).has(name)) fail(file, `unsupported pseudo selector :${name}`);
        atom();
      }
    } else if (c === "*") { atom(); i++; }
    else {
      const tag = selector.slice(i).match(identifier)?.[0];
      if (!tag) fail(file, "unsupported selector syntax");
      if (["html", "body", "head"].includes(tag.toLowerCase())) fail(file, "document selectors are forbidden");
      atom(); i += tag.length;
    }
  }
  // Whitespace around an explicit combinator does not add another relationship.
  const normalized = tokens.filter((token, index) => token.kind !== "combinator" || token.value !== " " ||
    (index > 0 && index < tokens.length - 1 && tokens[index - 1].kind === "atom" && tokens[index + 1].kind === "atom"));
  if (!normalized.length || normalized[0].kind !== "atom" || normalized.at(-1)?.kind !== "atom" ||
    normalized.some((token, index) => token.kind === "combinator" && normalized[index - 1]?.kind === "combinator"))
    fail(file, "invalid selector relationship");
  return normalized;
}

function assertOwnedSelector(selector: string, file: string) {
  for (const branch of selectorBranches(selector, file)) {
    const tokens = selectorTokens(branch, file, false, false, branch.startsWith(":where(.scope)"));
    let ownedAncestor = false, local = false, owned = false;
    for (const token of tokens) {
      if (token.kind === "atom") {
        local ||= token.local;
        owned = ownedAncestor || local;
      } else {
        if ((token.value === " " || token.value === ">") && owned) ownedAncestor = true;
        // Siblings of a module root are not owned. Siblings beneath an already
        // owned ancestor remain inside that subtree; a new local class is safe too.
        local = false; owned = ownedAncestor;
      }
    }
    if (!owned) fail(file, "selector can target outside a local module subtree");
  }
}

/** Restricted CSS grammar, intentionally fail closed when a new construct appears. */
export function assertIsolatedFeatureCss(css: string, file = "feature.module.css"): void {
  if (!file.endsWith(".module.css")) fail(file, "feature styles must be CSS Modules");
  const root = postcss.parse(css, { from: file });
  root.walk(node => {
    if (node.type === "atrule") {
      if (!groupingRules.has(node.name.toLowerCase()) || !node.nodes) fail(file, `global or unsupported @${node.name} rule`);
      if (node.parent?.type !== "root" && node.parent?.type !== "atrule") fail(file, "nested rules require explicit policy review");
    } else if (node.type === "rule") {
      if (node.parent?.type !== "root" && node.parent?.type !== "atrule") fail(file, "nested selectors require explicit policy review");
      assertOwnedSelector(node.selector, file);
    } else if (node.type === "decl") {
      if (node.parent?.type !== "rule") fail(file, "declarations outside an owned selector are forbidden");
      if (["composes", "compose-with"].includes(node.prop.toLowerCase())) fail(file, "CSS composition imports require explicit policy review");
    } else if (node.type !== "comment") fail(file, "unsupported stylesheet node");
  });
}

type AstNode = { type: string; [key: string]: unknown };
type BabelParser = { parse(source: string, options: Record<string, unknown>): AstNode };
const require = createRequire(import.meta.url);
// Use the parser shipped with the pinned Next installation; no extra runtime package.
const babelParser = (require("next/dist/compiled/babel/bundle") as { parser(): BabelParser }).parser();
export function subjectRuntimeImports(source: string, file: string): string[] {
  const result: string[] = [];
  const ast = babelParser.parse(source, { sourceType: "module", plugins: ["typescript", "jsx"], createImportExpressions: true });
  function literal(node: unknown) {
    if (!node || typeof node !== "object" || (node as AstNode).type !== "StringLiteral" || typeof (node as AstNode).value !== "string")
      fail(file, "nonliteral imports require explicit policy review");
    result.push((node as { value: string }).value);
  }
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const node = value as AstNode;
    if (node.type === "ImportDeclaration") {
      const specifiers = node.specifiers as AstNode[];
      if (node.importKind !== "type" && (!specifiers.length || specifiers.some(specifier => specifier.importKind !== "type"))) literal(node.source);
    } else if ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source && node.exportKind !== "type") {
      const specifiers = node.specifiers as AstNode[] | undefined;
      if (!specifiers?.length || specifiers.some(specifier => specifier.exportKind !== "type")) literal(node.source);
    }
    else if (node.type === "ImportExpression") literal(node.source);
    else if (node.type === "CallExpression") {
      const callee = node.callee as AstNode;
      if (callee?.type === "Import" || (callee?.type === "Identifier" && callee.name === "require")) {
        const args = node.arguments as unknown[];
        if (args.length !== 1) fail(file, "unsupported import call");
        literal(args[0]);
      }
    } else if (node.type === "TSImportEqualsDeclaration") fail(file, "import aliases require explicit policy review");
    for (const [key, child] of Object.entries(node)) if (!["loc", "start", "end", "comments", "tokens"].includes(key)) visit(child);
  }
  visit(ast);
  return [...new Set(result)];
}

export type SubjectFeatureIsolationOptions = {
  root?: string;
  featureRoots?: readonly string[];
  /** These shared files must be bound by the caller's presentation manifest. */
  trustedBoundaries?: readonly string[];
  /** External implementation bytes must be covered by the dependency lockfile. */
  allowedExternalImports?: readonly string[];
};

/**
 * Discover imports on every audit. New feature files are checked without binding
 * their text to Subjects geometry acceptance. Shared boundaries stay separately bound.
 */
export async function auditSubjectFeatureIsolation(options: SubjectFeatureIsolationOptions = {}) {
  const root = await realpath(options.root ?? process.cwd());
  const boundaries = new Set(options.trustedBoundaries ?? sharedBoundaries);
  const allowedExternal = new Set(options.allowedExternalImports ?? externalImports);
  const sourceFiles = new Set<string>(), cssFiles = new Set<string>();
  const localPath = (file: string) => {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep)) fail(file, "import escapes the workspace");
    return absolute;
  };
  async function resolveFile(file: string): Promise<string> {
    const candidates = path.extname(file) ? [file] : [file, ...[".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"].map(suffix => file + suffix)];
    for (const candidate of candidates) {
      const absolute = localPath(candidate);
      try {
        if (!(await stat(absolute)).isFile()) continue;
        const resolved = await realpath(absolute);
        if (!resolved.startsWith(root + path.sep)) fail(file, "symlink escapes the workspace");
        return path.relative(root, resolved).split(path.sep).join("/");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" && (error as NodeJS.ErrnoException).code !== "ENOTDIR") throw error;
      }
    }
    return fail(file, "unresolved local import");
  }
  async function visit(file: string) {
    const resolved = await resolveFile(file);
    if (boundaries.has(resolved)) return;
    if (resolved.endsWith(".css")) {
      if (cssFiles.has(resolved)) return;
      assertIsolatedFeatureCss(await readFile(localPath(resolved), "utf8"), resolved);
      cssFiles.add(resolved); return;
    }
    if (!/\.[cm]?[jt]sx?$/.test(resolved)) fail(resolved, "unreviewed feature asset import");
    if (sourceFiles.has(resolved)) return;
    sourceFiles.add(resolved);
    for (const imported of subjectRuntimeImports(await readFile(localPath(resolved), "utf8"), resolved)) {
      if (imported.startsWith(".")) await visit(path.posix.join(path.posix.dirname(resolved), imported));
      else if (imported.startsWith("@/")) await visit("src/" + imported.slice(2));
      else if (!allowedExternal.has(imported)) fail(resolved, `unreviewed external import ${imported}`);
    }
  }
  for (const file of options.featureRoots ?? subjectFeatureRoots) await visit(file);
  return { version: subjectFeatureIsolationVersion, sourceFiles: [...sourceFiles].sort(), cssFiles: [...cssFiles].sort() };
}
