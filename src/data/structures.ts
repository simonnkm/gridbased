import type { StructureId } from "../game/state/types";

export interface StructureCardDefinition {
  id: StructureId;
  title: string;
  boardLabel: string;
  boardColor: number;
  raidDefense: number;
  ideologyWeights: {
    scrap: number;
    tech: number;
    magic: number;
  };
  builtEffectText: string;
  salvageEffectText: string;
  builtRole: string;
  patternRole: string;
  weightsText: string;
}

export const structureCardDefinitions: Record<StructureId, StructureCardDefinition> = {
  farm: {
    id: "farm",
    title: "Farm",
    boardLabel: "FARM",
    boardColor: 0x5c7f46,
    raidDefense: 0,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Gain +1 Food each end turn.",
    salvageEffectText: "Gain +2 Food.",
    builtRole: "Sustain / growth support",
    patternRole: "Settlement sustain anchor",
    weightsText: "Neutral structure"
  },
  mine: {
    id: "mine",
    title: "Mine",
    boardLabel: "MINE",
    boardColor: 0x6f7379,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Gain +1 Materials each end turn.",
    salvageEffectText: "Gain +2 Materials.",
    builtRole: "Extraction / material support",
    patternRole: "Settlement extraction anchor",
    weightsText: "Neutral structure"
  },
  watchtower: {
    id: "watchtower",
    title: "Watchtower",
    boardLabel: "WATCH",
    boardColor: 0x54789a,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Grant Intel +1 from scout operations when maintained.",
    salvageEffectText: "Reveal the next raid card. If no raid is queued, reveal the next draw card instead, then gain Intel +1.",
    builtRole: "Forecasting / line support",
    patternRole: "Settlement scouting anchor",
    weightsText: "Neutral structure"
  },
  well: {
    id: "well",
    title: "Well",
    boardLabel: "WELL",
    boardColor: 0x3c8d8d,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Max 2 Wells active. At end turn, repair 1 damaged structure.",
    salvageEffectText: "Repair the most damaged structure. If nothing is damaged, heal Core +1.",
    builtRole: "Support / balancing / recovery",
    patternRole: "Settlement recovery anchor",
    weightsText: "Neutral structure"
  },
  "muster-hall": {
    id: "muster-hall",
    title: "Muster Hall",
    boardLabel: "MUSTER",
    boardColor: 0x9a6444,
    raidDefense: 2,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Enable militia-style attack cards and tougher ring defense during raids.",
    salvageEffectText: "Heal Core +2.",
    builtRole: "Force / defense support",
    patternRole: "Settlement defense anchor",
    weightsText: "Neutral structure"
  },
  workshop: {
    id: "workshop",
    title: "Workshop",
    boardLabel: "SHOP",
    boardColor: 0xb08a3f,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Gain +1 Progress each end turn.",
    salvageEffectText: "Gain +2 Progress.",
    builtRole: "Maintenance / translation / upgrade support",
    patternRole: "Settlement upgrade anchor",
    weightsText: "Neutral structure"
  },
  "barricade-yard": {
    id: "barricade-yard",
    title: "Barricade Yard",
    boardLabel: "YARD",
    boardColor: 0xa84d27,
    raidDefense: 2,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Raid bonus: adds extra Fortification when another Scrap site helps hold the same ring.",
    salvageEffectText: "Gain +1 Materials and heal Core +1.",
    builtRole: "Dense cover / ring anchor",
    patternRole: "Cluster wall, pocket edge",
    weightsText: "Neutral structure"
  },
  "scrounge-depot": {
    id: "scrounge-depot",
    title: "Scrounge Depot",
    boardLabel: "DEPOT",
    boardColor: 0x8f6d44,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "On build gain +1 Materials. Helps Scrap pockets stay fed with salvageable stock.",
    salvageEffectText: "Gain +2 Materials.",
    builtRole: "Scavenging / dense pocket support",
    patternRole: "Cluster filler, salvage cache",
    weightsText: "Neutral structure"
  },
  "relay-pylon": {
    id: "relay-pylon",
    title: "Relay Pylon",
    boardLabel: "RELAY",
    boardColor: 0x497eb4,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "On build gain Intel +1. Raid bonus: improves pressure-control cards if a live Tech pattern stays online.",
    salvageEffectText: "Gain Intel +1.",
    builtRole: "Signal line / forecast boost",
    patternRole: "Line spine, loop marker",
    weightsText: "Neutral structure"
  },
  "junction-array": {
    id: "junction-array",
    title: "Junction Array",
    boardLabel: "ARRAY",
    boardColor: 0x6a93bc,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "On build gain +1 Progress. Raid bonus: improves layered support cards when paired with Watchtower or Workshop routing.",
    salvageEffectText: "Gain +2 Progress.",
    builtRole: "Routing / upgrade support",
    patternRole: "Junction hub, loop brace",
    weightsText: "Neutral structure"
  },
  "ward-sigil": {
    id: "ward-sigil",
    title: "Ward Sigil",
    boardLabel: "SIGIL",
    boardColor: 0x5fa582,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Raid bonus: raises stronger wards when a live Magic pattern is active.",
    salvageEffectText: "Heal Core +1.",
    builtRole: "Protective rite / ritual anchor",
    patternRole: "Arc corner, triangle point",
    weightsText: "Neutral structure"
  },
  "ley-lantern": {
    id: "ley-lantern",
    title: "Ley Lantern",
    boardLabel: "LEY",
    boardColor: 0x80b9a2,
    raidDefense: 1,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "On build heal Core +1. Stabilizes hybrid Magic layers without replacing pattern play.",
    salvageEffectText: "Gain +1 Food and heal Core +1.",
    builtRole: "Resonance / recovery support",
    patternRole: "Ring node, arc endpoint",
    weightsText: "Neutral structure"
  },
  "scrap-bastion": {
    id: "scrap-bastion",
    title: "Scrap Bastion",
    boardLabel: "NODE",
    boardColor: 0xb15425,
    raidDefense: 3,
    ideologyWeights: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    builtEffectText: "Major Scrap node. Strengthens nearby Scrap patterns and adds heavy raid defense in its ring, with extra value if hybrid patterns reinforce the same area.",
    salvageEffectText: "Node structures are not drawn or salvaged in this MVP.",
    builtRole: "Formal node / fortified anchor",
    patternRole: "Cluster catalyst, hybrid bastion",
    weightsText: "Neutral structure"
  }
};

export const starterDeckRecipe: Partial<Record<StructureId, number>> = {
  farm: 2,
  mine: 2,
  watchtower: 2,
  well: 2,
  "muster-hall": 2,
  workshop: 2
};

export const BASIC_BUILD_STRUCTURE_IDS: StructureId[] = [
  "farm",
  "mine",
  "workshop",
  "watchtower",
  "well",
  "muster-hall"
];

export function isBasicBuildStructureId(structureId: StructureId): boolean {
  return BASIC_BUILD_STRUCTURE_IDS.includes(structureId);
}

export function getStructureCardDefinition(id: StructureId): StructureCardDefinition {
  return structureCardDefinitions[id];
}
