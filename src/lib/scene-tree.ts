import { z } from "zod";

export const tokenTreeSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(24),
    parentId: z.string().max(24).nullable(),
    token: z.string().min(1).max(4),
    status: z.enum(["accepted", "candidate", "rejected"]),
  })).min(3).max(15),
  prefixLabel: z.string().min(1).max(22).nullish().describe("If set, the root is ALREADY verified prefix context, excluded from newly committed proposals; add a separate root P before the first speculative token A."),
  targetToken: z.string().min(1).max(4).nullish(),
  verificationLabel: z.string().min(1).max(48).nullish(),
});
export type TokenTree = z.infer<typeof tokenTreeSchema>;

export function validateTokenTree(tree: TokenTree) {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  if (byId.size !== tree.nodes.length || tree.nodes.filter(node => node.parentId === null).length !== 1)
    throw new Error("Token tree needs unique nodes and one root.");
  if (tree.prefixLabel && tree.nodes.find(node => node.parentId === null)!.status !== "accepted")
    throw new Error("A verified prefix must be accepted context.");
  for (const node of tree.nodes) {
    const children = tree.nodes.filter(child => child.parentId === node.id);
    if (children.length > 4 || new Set(children.map(child => child.token)).size !== children.length)
      throw new Error("Tree siblings must have distinct tokens and at most four children.");
    if (children.filter(child => child.status === "accepted").length > 1)
      throw new Error("Accepted tokens must form one connected path, not multiple branches.");
    const seen = new Set([node.id]); let cursor = node, depth = 0;
    while (cursor.parentId !== null) {
      const parent = byId.get(cursor.parentId);
      if (!parent || seen.has(parent.id) || ++depth > 4)
        throw new Error("Token tree has a missing parent, cycle, or more than four edges of depth.");
      if (cursor.status === "accepted" && parent.status !== "accepted")
        throw new Error("An accepted token must have an accepted parent.");
      seen.add(parent.id); cursor = parent;
    }
  }
}
