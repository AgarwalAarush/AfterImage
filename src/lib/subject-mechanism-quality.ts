import type { SubjectMechanism } from "./subject-mechanism";

/** Semantic checks complement source review; they never certify rendered placement. */
export const subjectMechanismQualityVersion = "mechanism-semantic-ownership-v1";
export const mechanismOwnershipInstructions = `Audit ownership separately from notation. For every displayed symbol, identify its scientific meaning and the object that contains it in every beat. Distinct entities require distinct visible aliases; copy or reuse preserves the same identity. Do not use entity glyphs as decorative corner markers, operation badges, or unnamed outputs. Every entity must occur in a visible state, and every declared relationship must be exercised by a beat. At least two objects must actually contain symbolic information, regardless of their shape. A changing collection, prefix, operand or computed result must participate in the connected scientific dependency graph. The object's short title identifies the operation or container; its detail explains that role; its entity aliases identify the actual data. Keep these roles consistent across introduction, beat narration and takeaway. Reject label-to-object ownership contradictions, even when the individual words and equations are correct. Host layout owns alignment and grouping: source review of JSON cannot certify readable alignment, proximity, balance or animation frames. A separate independent critique of the actual rendered evidence must inspect every beat before visual publication.`;

/** Reject decorative or untraceable semantics before generation skip or publication. */
export function validateSubjectMechanismQuality(mechanism: SubjectMechanism) {
  const shownEntities = new Set(mechanism.beats.flatMap(beat => beat.objects.flatMap(object => object.entityIds)));
  const unusedEntities = mechanism.entities.filter(entity => !shownEntities.has(entity.id));
  if (unusedEntities.length) throw new Error(`Mechanism entities never appear in any state: ${unusedEntities.map(entity => entity.id).join(", ")}`);
  const aliases = new Set<string>();
  for (const entity of mechanism.entities) {
    const alias = entity.label.normalize("NFC");
    if (aliases.has(alias)) throw new Error(`Distinct mechanism entities share the visible alias ${alias}; reuse one identity or give distinct aliases`);
    aliases.add(alias);
  }
  const usedRelationships = new Set(mechanism.beats.flatMap(beat => beat.relationships.map(edge => edge.relationshipId)));
  const unusedRelationships = mechanism.relationships.filter(edge => !usedRelationships.has(edge.id));
  if (unusedRelationships.length) throw new Error(`Mechanism relationships never appear in any beat: ${unusedRelationships.map(edge => edge.id).join(", ")}`);
  const containingObjects = new Set(mechanism.beats.flatMap(beat => beat.objects.filter(object => object.entityIds.length).map(object => object.objectId)));
  if (containingObjects.size < 2) throw new Error("Mechanism needs symbolic information in at least two actual objects, not empty data-shaped decoration");
  const connected = new Set([mechanism.objects[0].id]);
  let previousSize = 0;
  while (previousSize !== connected.size) {
    previousSize = connected.size;
    for (const edge of mechanism.relationships) {
      if (connected.has(edge.from)) connected.add(edge.to);
      if (connected.has(edge.to)) connected.add(edge.from);
    }
  }
  if (mechanism.objects.some(object => !connected.has(object.id))) throw new Error("Mechanism has disconnected scientific dependency groups; explain one connected mechanism");
}
