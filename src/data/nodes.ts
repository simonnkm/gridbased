import type { StructureId } from "../game/state/types";

export interface NodeDefinition {
  id: string;
  structureId: StructureId;
  title: string;
  summary: string;
  unlockDoctrineId: string;
  cost: {
    materials: number;
    progress: number;
  };
  maxActive: number;
}

export const nodeDefinitions: Record<"scrap-bastion", NodeDefinition> = {
  "scrap-bastion": {
    id: "scrap-bastion",
    structureId: "scrap-bastion",
    title: "Scrap Bastion",
    summary:
      "A single fortified node that strengthens nearby Scrap formations and adds extra raid defense when hybrid patterns reinforce its ring.",
    unlockDoctrineId: "scrap-holdfast-compact",
    cost: {
      materials: 4,
      progress: 2
    },
    maxActive: 1
  }
};

export function getNodeDefinition(structureId: "scrap-bastion"): NodeDefinition {
  return nodeDefinitions[structureId];
}
