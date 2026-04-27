import type { CardDefinition, CardEffect, CardIdeologyTag } from "../../game/core/types/card-model";
import type { StructureId } from "../../game/state/types";
import { structureCardDefinitions } from "../structures";

interface BuildCardMeta {
  structureId: StructureId;
  boardLabel: string;
  boardColor: number;
  builtEffectText: string;
  salvageEffectText: string;
}

function getBuildCardIdeologies(structureId: StructureId): CardIdeologyTag[] {
  const weights = structureCardDefinitions[structureId].ideologyWeights;
  const ideologies = (Object.entries(weights) as Array<[CardIdeologyTag, number]>)
    .filter(([, weight]) => weight > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([ideology]) => ideology);

  return ideologies.length > 0 ? ideologies : ["neutral"];
}

function getBuildCardEffects(structureId: StructureId): CardEffect[] {
  switch (structureId) {
    case "farm":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "food", amount: 2 }
      ];
    case "mine":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "materials", amount: 2 }
      ];
    case "watchtower":
      return [
        { type: "build-structure", structureId },
        { type: "reveal", target: "raid" },
        { type: "resource", resource: "intel", amount: 1 }
      ];
    case "well":
      return [
        { type: "build-structure", structureId },
        { type: "repair", amount: 1 }
      ];
    case "muster-hall":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "core", amount: 2 }
      ];
    case "workshop":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "progress", amount: 2 }
      ];
    case "barricade-yard":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "materials", amount: 1 },
        { type: "resource", resource: "core", amount: 1 }
      ];
    case "scrounge-depot":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "materials", amount: 2 }
      ];
    case "relay-pylon":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "intel", amount: 1 }
      ];
    case "junction-array":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "progress", amount: 2 }
      ];
    case "ward-sigil":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "core", amount: 1 }
      ];
    case "ley-lantern":
      return [
        { type: "build-structure", structureId },
        { type: "resource", resource: "food", amount: 1 },
        { type: "resource", resource: "core", amount: 1 }
      ];
    case "scrap-bastion":
      return [{ type: "build-structure", structureId }];
  }
}

export const buildCardDefinitions = (Object.values(structureCardDefinitions) as Array<
  (typeof structureCardDefinitions)[StructureId]
>).map((structure) => ({
  id: `build-${structure.id}`,
  kind: "build",
  title: structure.title,
  summary: `${structure.builtEffectText} Salvage: ${structure.salvageEffectText}`,
  category: "build",
  ideologies: getBuildCardIdeologies(structure.id),
  cost: {
    type: "none",
    amount: 0
  },
  source: {
    type: structure.id === "scrap-bastion" ? "system" : "structure",
    id: structure.id,
    title: structure.title
  },
  effects: getBuildCardEffects(structure.id),
  weighted: {
    baseWeight: 1,
    sourceCount: 1
  },
  tags: [structure.builtRole, structure.patternRole],
  meta: {
    structureId: structure.id,
    boardLabel: structure.boardLabel,
    boardColor: structure.boardColor,
    builtEffectText: structure.builtEffectText,
    salvageEffectText: structure.salvageEffectText
  } satisfies BuildCardMeta
})) satisfies CardDefinition<"build", BuildCardMeta>[];

export const buildCardDefinitionMap = new Map(
  buildCardDefinitions.map((definition) => [definition.id, definition])
);

export const buildCardDefinitionByStructureId = new Map(
  buildCardDefinitions.map((definition) => [definition.meta!.structureId, definition])
);

