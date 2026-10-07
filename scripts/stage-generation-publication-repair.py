"""Stage the bounded publication patch over the verified v22 worker; never activate it.

Only public source trees are copied. The destination must be a new sibling
*-candidate directory. Credentials, runtime data, logs and review artifacts stay
in their existing owners. Every runtime source must match the evaluated tree.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

BASELINE = {
    "worker/index.ts": "2dfdc477aaa213aa049d124cb31ca6a8b0db6952dd18d16ee28cd3aad05ec065",
    "worker/generation-schema.ts": "2b5a5e21877b6a41bad12e79c93afc00890361053a08406a365d381ff5ffa09e",
    "worker/generation-contract.ts": "0b2e73eaf000b9a5fcaffa2cdf9b194ad8f7bf8e8564582a6152af799bc5f03a",
    "src/lib/scene-illustration.ts": "432a994246e2c7dc83ebc1f1663e4ca5a6dc0c77d4eb78043c4dd1733d034d7f",
    "src/lib/scene-illustration-svg.ts": "5a1ba5a64a192331ec081f3b1ec256f5f6e982e486f776b503bb81ef4e93271e",
    "package-lock.json": "adeb64eebd1d734843b184ff63a45266b77cb0aaa17b6fe19fc608f73ec852ce",
}
ADDITIONS = (
    "worker/diagram-presentation.ts", "worker/diagram-publication.ts",
    "src/lib/scene-routing-svg.ts", "src/lib/diagram-text.ts",
    "tests/diagram-publication.test.ts",
)
TREES = ("worker", "src", "scripts", "public", "tests")
ROOT_FILES = ("package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", ".gitignore")
EXCLUDED = {"node_modules", ".next", ".next-production", ".vercel", ".data", ".artifacts", ".assistant-runtime"}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def patch(value, replacements, file):
    for before, after, expected in replacements:
        count = value.count(before)
        if count != expected:
            raise ValueError(f"{file}: expected {expected} patch anchors, found {count}")
        value = value.replace(before, after)
    return value


def public_files(root):
    files = {}
    for tree in TREES:
        for file in (root / tree).rglob("*"):
            relative = file.relative_to(root)
            if any(part in EXCLUDED or part.startswith(".") for part in relative.parts):
                continue
            if file.is_symlink():
                raise ValueError(f"Public source cannot contain a symlink: {relative}")
            if file.is_file():
                files[relative.as_posix()] = file
    for name in ROOT_FILES:
        file = root / name
        if file.is_file() and not file.is_symlink():
            files[name] = file
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--repair-root", required=True, type=Path)
    parser.add_argument("--evaluated-root", required=True, type=Path)
    parser.add_argument("--repair-commit", required=True)
    args = parser.parse_args()
    baseline, repair, evaluated = [path.resolve(strict=True) for path in (args.baseline, args.repair_root, args.evaluated_root)]
    destination = args.destination.absolute()
    if destination.exists() or destination.is_symlink():
        raise ValueError("Candidate destination must not already exist")
    if destination.parent.resolve() != baseline.parent or not destination.name.endswith("-candidate"):
        raise ValueError("Candidate must be a new sibling directory ending in -candidate")
    if len(args.repair_commit) != 40 or any(char not in "0123456789abcdef" for char in args.repair_commit):
        raise ValueError("Repair commit must be a full lowercase Git SHA")
    for file, expected in BASELINE.items():
        if digest((baseline / file).read_bytes()) != expected:
            raise ValueError(f"Verified v22 baseline changed: {file}")
    dependency_root = (baseline / "node_modules").resolve(strict=True)
    if dependency_root.name != "node_modules" or dependency_root.parent.parent != baseline.parent:
        raise ValueError("Dependencies must retain their existing sibling release owner")
    if digest((dependency_root.parent / "package-lock.json").read_bytes()) != BASELINE["package-lock.json"]:
        raise ValueError("Owning dependency release has a different lockfile")

    changes = {
        "src/lib/scene-illustration.ts": [
            ('...common, kind: z.literal("routing"),', '...common, kind: z.literal("routing"),\n    layout: z.literal("readable-routing-v1").nullish(),', 1),
        ],
        "src/lib/scene-illustration-svg.ts": [
            ('import { readableMatrixSvg } from "./scene-matrix-svg";', 'import { readableMatrixSvg } from "./scene-matrix-svg";\nimport { readableRoutingSvg } from "./scene-routing-svg";', 1),
            ('} else if (panel.kind === "routing") {', '} else if (panel.kind === "routing" && panel.layout === "readable-routing-v1") {\n    const graphic = readableRoutingSvg(panel, width, accent, marker, panelId);\n    svg += `<g transform="translate(0 ${y})">${graphic.svg}</g>`;\n    y += graphic.height;\n  } else if (panel.kind === "routing") {', 1),
        ],
        "worker/generation-schema.ts": [
            ('routing.extend(support)', 'routing.omit({ layout: true }).extend(support)', 1),
        ],
        "worker/generation-contract.ts": [
            ('import type { RecallField }', 'import { diagramPresentationContract } from "./diagram-presentation";\nimport type { RecallField }', 1),
            ('export const nativePlanBounds = `', 'export const nativePlanBounds = diagramPresentationContract + "\\n" + `', 1),
        ],
    }
    context = '''async function publicationContext(images: string[]) {
  const manifests = await Promise.all(images.filter(file => !/-slice-\\d+\\.png$/.test(file)).map(async file =>
    ({ image: path.basename(file), facts: JSON.parse(await readFile(file.replace(/\\.png$/, ".publication.json"), "utf8")) })));
  return "\\n" + publicationReviewContract + "\\nRENDERED PUBLICATION FACTS:\\n" + JSON.stringify(manifests);
}
'''
    changes["worker/index.ts"] = [
        ('import sharp from "sharp";', 'import sharp from "sharp";\nimport { prepareDraftScene as prepareScene, prepareDraftIllustration } from "./diagram-presentation";\nimport { inspectPublicationSvg, publicationTextFacts, publicationReviewContract } from "./diagram-publication";', 1),
        ('  prepareScene,\n', '', 1), ('  inspectSvg,\n', '', 1),
        ('await writeFile(file,png);const files=[file];', 'await writeFile(file,png);\n  await writeFile(file.replace(/\\.png$/, ".publication.json"), JSON.stringify(publicationTextFacts(svg, width), null, 2));\n  const files=[file];', 1),
        ('async function generate(\n', context + 'async function generate(\n', 1),
        ('...inspectSvg(sceneSvg(result.scene)),', '...inspectPublicationSvg(sceneSvg(result.scene), 880),', 1),
        ('...inspectSvg(sceneSvgMobile(result.scene)).map', '...inspectPublicationSvg(sceneSvgMobile(result.scene), 350).map', 1),
        ('reviewRubric +\n          "\\nRESULT:', 'reviewRubric + await publicationContext(reviewImages) +\n          "\\nRESULT:', 1),
        ('figure.kind==="illustration"?versionMatrixPanels(figure)', 'figure.kind==="illustration"?{...versionMatrixPanels(figure),illustration:prepareDraftIllustration(versionMatrixPanels(figure).illustration)}', 1),
        ('const svg=studySvg(f,mobile,state),defects=inspectSvg(svg);', 'const width=mobile?350:f.kind==="illustration"?880:760;\n        const svg=studySvg(f,mobile,state),defects=inspectPublicationSvg(svg,width);', 1),
        ('${reviewRubric} Check values', '${reviewRubric} ${await publicationContext(images)} Check values', 1),
    ]
    replacements = {file: patch((baseline / file).read_text(), edits, file).encode() for file, edits in changes.items()}
    replacements.update({file: (repair / file).read_bytes() for file in ADDITIONS})
    files = public_files(baseline)
    expected_manifest = {}
    for file in sorted(set(files) | set(replacements)):
        expected = replacements[file] if file in replacements else files[file].read_bytes()
        expected_manifest[file] = digest(expected)
        # Pipeline/public assets, tests and immutable dependencies must be the
        # exact successful evaluation bytes. Utility scripts do not run workers.
        if file.split("/", 1)[0] != "scripts" and file != ".gitignore":
            if not (evaluated / file).is_file() or digest((evaluated / file).read_bytes()) != expected_manifest[file]:
                raise ValueError(f"Candidate differs from the successful evaluation: {file}")

    # All preflight checks complete before creating any destination or link.
    destination.mkdir(mode=0o700)
    for file, source in files.items():
        target = destination / file
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    for file, value in replacements.items():
        target = destination / file
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(value)
    (destination / "node_modules").symlink_to(dependency_root, target_is_directory=True)
    for file, expected in expected_manifest.items():
        if digest((destination / file).read_bytes()) != expected:
            raise ValueError(f"Staged file verification failed: {file}")
    private = destination / ".artifacts"
    private.mkdir(mode=0o700)
    receipt = {"version": 1, "kind": "unactivated-worker-publication-candidate", "repairCommit": args.repair_commit,
               "baseline": BASELINE, "dependencyOwner": dependency_root.parent.name,
               "files": expected_manifest, "activated": False, "credentialsCopied": False}
    receipt_bytes = (json.dumps(receipt, sort_keys=True, indent=2) + "\n").encode()
    (private / "publication-stage-receipt.json").write_bytes(receipt_bytes)
    print(json.dumps({"candidate": str(destination), "fileCount": len(expected_manifest),
                      "receiptSha256": digest(receipt_bytes), "activated": False, "credentialsCopied": False}))


if __name__ == "__main__":
    main()
