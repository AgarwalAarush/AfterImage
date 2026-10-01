import test from "node:test";
import assert from "node:assert/strict";
import { validateTokenTree, type TokenTree } from "../src/lib/scene-tree";
import { tokenTreeSvg } from "../src/lib/scene-tree-svg";
import { inspectSvg } from "../worker/diagram-review";

const tree: TokenTree = {
  prefixLabel: "Verified prefix", targetToken: "E", verificationLabel: "One ancestor-masked LLM pass",
  nodes: [
    { id: "p", parentId: null, token: "P", status: "accepted" },
    { id: "a", parentId: "p", token: "A", status: "accepted" },
    { id: "b", parentId: "a", token: "B", status: "rejected" },
    { id: "c", parentId: "a", token: "C", status: "accepted" },
    { id: "d", parentId: "c", token: "D", status: "accepted" },
  ],
};
test("shared prefix and one accepted path survive desktop and phone composition", () => {
  validateTokenTree(tree);
  for (const width of [332, 452]) {
    const { svg, height } = tokenTreeSvg(tree, width, "proposal");
    assert.equal((svg.match(/data-tree-node=/g) || []).length, 5);
    assert.equal((svg.match(/data-tree-edge=/g) || []).length, 4);
    assert.equal((svg.match(/data-tree-node="proposal-a"/g) || []).length, 1);
    assert.equal((svg.match(/data-token-role="target"/g) || []).length, 1);
    assert.equal((svg.match(/data-token-role="proposal"/g) || []).length, 3);
    assert.deepEqual(inspectSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 8} ${height + 8}"><g transform="translate(4 4)">${svg}</g></svg>`), []);
  }
});
test("token trees reject duplicated prefixes, invalid ancestry and branching accepted outputs", () => {
  const invalid = (nodes: TokenTree["nodes"]) => assert.throws(() => validateTokenTree({ ...tree, nodes }));
  invalid(tree.nodes.map(node => node.id === "b" ? { ...node, token: "C" } : node));
  invalid(tree.nodes.map(node => node.id === "c" ? { ...node, parentId: "b" } : node));
  invalid(tree.nodes.map(node => node.id === "b" ? { ...node, status: "accepted" } : node));
  invalid(tree.nodes.map(node => node.id === "p" ? { ...node, parentId: "d" } : node));
});
test("a maximum bounded token tree keeps every identity readable on phones", () => {
  const wide: TokenTree = { prefixLabel: "Verified prefix", nodes: [{ id: "root", parentId: null, token: "ROOT", status: "accepted" }] };
  for (let i = 0; i < 4; i++) {
    const id = `branch-${i}`; wide.nodes.push({ id, parentId: "root", token: `B${i}`, status: "candidate" });
    for (let j = 0; j < (i < 2 ? 3 : 2); j++) wide.nodes.push({ id: `${id}-${j}`, parentId: id, token: `C${j}`, status: "candidate" });
  }
  validateTokenTree(wide);
  const { svg, height } = tokenTreeSvg(wide, 332, "wide");
  assert.equal((svg.match(/data-tree-node=/g) || []).length, 15);
  assert.deepEqual(inspectSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 ${height + 8}"><g transform="translate(4 4)">${svg}</g></svg>`), []);
});
