import type { CardDefinition, CardInstance } from "../core/types/card-model";
import { getBuildCardDefinitionForStructure } from "../../data/cards/cardRegistry";
import type { StructureId } from "../state/types";

export function createCardInstanceFromDefinition<
  TKind extends CardDefinition["kind"],
  TRuntime extends Record<string, unknown>
>(
  definition: CardDefinition<TKind>,
  instanceId: string,
  runtime: TRuntime
): CardInstance<TKind, TRuntime> {
  return {
    instanceId,
    definitionId: definition.id,
    kind: definition.kind,
    source: definition.source,
    cost: definition.cost,
    weight: definition.weighted?.baseWeight ?? 1,
    tags: definition.tags ?? [],
    runtime
  };
}

export function createBuildCardInstance(structureId: StructureId, sequence: number) {
  const definition = getBuildCardDefinitionForStructure(structureId);
  const instance = createCardInstanceFromDefinition(definition, `card-${sequence}`, {
    structureId
  });

  return {
    ...instance,
    structureId
  };
}

