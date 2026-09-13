import { z } from "zod";

/** Structured output requires every property; optional additions use explicit null. */
export function outputSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema);
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
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
