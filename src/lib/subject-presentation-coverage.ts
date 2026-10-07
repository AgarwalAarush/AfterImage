import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import { subjectRuntimeImports } from "./subject-presentation-isolation";

export const subjectPresentationCoverageVersion = "subjects-import-coverage-v1" as const;
// These external implementations are covered by the exact dependency lockfile.
// Unknown package/subpath imports need an explicit policy review.
const externalImports = [
  "@fontsource-variable/newsreader", "@fontsource/ibm-plex-mono/400.css", "github-slugger",
  "katex", "katex/dist/katex.min.css", "lucide-react", "next/dist/compiled/babel/bundle",
  "next/dynamic", "next/headers", "next/link", "next/navigation", "node:crypto", "node:fs/promises",
  "node:module", "node:path", "pdfjs-dist", "postcss", "react", "react-dom", "react-markdown",
  "rehype-katex", "rehype-raw", "rehype-sanitize", "rehype-slug", "remark-gfm", "remark-math", "sharp", "thinking-orbs", "zod",
];
export type SubjectPresentationCoverageOptions = {
  root?: string;
  coreFiles: readonly string[];
  integrationRoots: readonly string[];
  featureRoots?: readonly string[];
  routeFiles?: readonly string[];
  allowedExternalImports?: readonly string[];
  forbiddenCoreImports?: readonly string[];
};
function fail(file: string, reason: string): never {
  throw new Error(`Subject presentation import coverage failed in ${file}: ${reason}`);
}
function cssImports(source: string, file: string) {
  const result: string[] = [];
  const css = postcss.parse(source, { from: file });
  css.walkAtRules("import", rule => {
    // Permit only literal local imports; media and URL forms require policy review.
    const match = rule.params.match(/^["']([^"']+)["']$/);
    if (!match) fail(file, "unsupported stylesheet import");
    result.push(match[1]);
  });
  css.walkDecls(decl => {
    if (!["composes", "compose-with"].includes(decl.prop)) return;
    if (/\sfrom\s+global\s*$/.test(decl.value) || !/\sfrom\s/.test(decl.value)) return;
    const match = decl.value.match(/\sfrom\s+["']([^"']+)["']\s*$/);
    if (!match) fail(file, "unsupported stylesheet composition import");
    result.push(match[1]);
  });
  return result;
}
/**
 * Import coverage evidence only, never a publication decision. Core dependencies
 * remain explicitly bound. Every discovered integration/feature/route dependency
 * is returned for hashing, including feature JavaScript with possible DOM effects.
 */
export async function auditSubjectPresentationCoverage(options: SubjectPresentationCoverageOptions) {
  const root = await realpath(options.root ?? process.cwd());
  const core = new Set(options.coreFiles), integrationRoots = new Set(options.integrationRoots);
  const forbiddenCoreImports = new Set(options.forbiddenCoreImports??[]);
  const allowedExternal = new Set(options.allowedExternalImports ?? externalImports);
  const visited = new Set<string>(), integration = new Set<string>();
  function localPath(file: string) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep)) fail(file, "import escapes workspace");
    return absolute;
  }
  async function resolveFile(file: string) {
    const candidates = path.extname(file) ? [file] : [file, ...[".ts", ".tsx", ".js", ".jsx", ".css", ".json", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"].map(suffix => file + suffix)];
    for (const candidate of candidates) {
      const absolute = localPath(candidate);
      try {
        if (!(await stat(absolute)).isFile()) continue;
        const resolved = await realpath(absolute);
        if (!resolved.startsWith(root + path.sep)) fail(file, "symlink escapes workspace");
        const relative = path.relative(root, resolved).split(path.sep).join("/");
        if (relative !== path.relative(root, absolute).split(path.sep).join("/")) fail(file, "symlinked sources need explicit policy review");
        return relative;
      } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      }
    }
    return fail(file, "unresolved local import");
  }
  async function visit(file: string, importer?: string) {
    const resolved = await resolveFile(file);
    if(importer&&core.has(importer)&&forbiddenCoreImports.has(resolved))fail(importer,`Library renderer cannot enter Subjects core: ${resolved}`);
    if (importer && core.has(importer) && !core.has(resolved) && !integrationRoots.has(resolved))
      fail(importer, `unbound core dependency ${resolved}`);
    if (resolved.endsWith(".css") && !resolved.endsWith(".module.css") && !core.has(resolved))
      fail(resolved, "new global stylesheet must be explicitly core-bound");
    if (!/\.(?:[cm]?[jt]sx?|css|json)$/.test(resolved)) fail(resolved, "unsupported imported asset");
    if (!core.has(resolved)) integration.add(resolved);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    if (resolved.endsWith(".json")) return;
    const source = await readFile(localPath(resolved), "utf8");
    const imported = resolved.endsWith(".css") ? cssImports(source, resolved) : subjectRuntimeImports(source, resolved);
    for (const specifier of imported) {
      if (specifier.startsWith(".")) await visit(path.posix.join(path.posix.dirname(resolved), specifier), resolved);
      else if (specifier.startsWith("@/")) await visit("src/" + specifier.slice(2), resolved);
      else if (!allowedExternal.has(specifier)) fail(resolved, `unreviewed external import ${specifier}`);
    }
  }
  for (const file of [...core, ...integrationRoots, ...(options.featureRoots ?? []), ...(options.routeFiles ?? [])]) await visit(file);
  return { version: subjectPresentationCoverageVersion, integrationFiles: [...integration].sort(), sourceFiles: [...visited].sort() };
}
