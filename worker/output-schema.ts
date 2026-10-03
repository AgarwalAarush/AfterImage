import { z } from "zod";

/** Structured output requires every property; optional additions use explicit null. */
export function outputSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema);
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    // Tight decoder length constraints can force a partial word or equation at the boundary.
    // Communicate native bounds as instructions; enforce them locally before publication.
    if (node.type === "string" && typeof node.maxLength === "number") {
      node.description = `${node.description || ""} Native maximum: ${node.maxLength} characters. Write concise complete text, ideally below 60% of this bound.`;
      node.maxLength = Math.max(node.maxLength, 20000);
    }
    if (Array.isArray(node.oneOf)) { node.anyOf = node.oneOf; delete node.oneOf; }
    if (node.type === "object" && node.properties) {
      node.required = Object.keys(node.properties as object);
      node.additionalProperties = false;
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  }
  visit(json);
  return json;
}
