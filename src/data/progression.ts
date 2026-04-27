import type { Ideology, PatternTier } from "../game/patterns/types";
import type { StructureId } from "../game/state/types";

export type ProgressionUnlockCategory =
  | "doctrine"
  | "build-card"
  | "support-card"
  | "attack-card"
  | "passive-effect";

export type RaidCardPool = "support" | "attack";

export type ProgressionTrigger =
  | {
      kind: "pattern-threshold";
      ideology: Ideology;
      minimumTier: Exclude<PatternTier, "none">;
    }
  | {
      kind: "node";
      nodeId: string;
    };

export interface ProgressionUnlockDefinition {
  id: string;
  ideology: Ideology;
  title: string;
  category: ProgressionUnlockCategory;
  summary: string;
  flavorText: string;
  trigger: ProgressionTrigger;
  persistsForRun: boolean;
  activeWhileRequirementMet: boolean;
  raidPool?: RaidCardPool;
  raidEffectText?: string;
  buildCardStructureId?: StructureId;
  copiesAddedToDeck?: number;
}

export const passiveUnlockIds = {
  scrapScroungeCache: "scrap-scrounge-cache",
  techSurveyGrid: "tech-survey-grid",
  magicLeyShelter: "magic-ley-shelter"
} as const;

export const progressionUnlockDefinitions: ProgressionUnlockDefinition[] = [
  {
    id: "scrap-holdfast-compact",
    ideology: "scrap",
    title: "Holdfast Compact",
    category: "doctrine",
    summary: "Scrap builders treat dense blocks as a shared promise of cover and repair.",
    flavorText: "Patch the gaps, brace the neighbors, and the settlement learns to hold.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "scrap",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false
  },
  {
    id: "scrap-barricade-yard",
    ideology: "scrap",
    title: "Barricade Yards",
    category: "build-card",
    summary: "Add Barricade Yard to the draw flow: a heavier Scrap ring anchor with defensive payoff.",
    flavorText: "Once the settlement starts thinking in clusters, somebody always starts welding walls.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "scrap",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    buildCardStructureId: "barricade-yard",
    copiesAddedToDeck: 1
  },
  {
    id: "scrap-scrounge-depot",
    ideology: "scrap",
    title: "Scrounge Depots",
    category: "build-card",
    summary: "Add Scrounge Depot to the draw flow: a compact Scrap cache that pays out Materials on build.",
    flavorText: "Dense neighborhoods create their own gravity for useful junk.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "scrap",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    buildCardStructureId: "scrounge-depot",
    copiesAddedToDeck: 1
  },
  {
    id: "scrap-barricade",
    ideology: "scrap",
    title: "Barricade",
    category: "support-card",
    summary: "Raid support: throw up welded cover to blunt the next layer hit.",
    flavorText: "Every wall starts as scrap that refused to stay loose.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "scrap",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    raidPool: "support",
    raidEffectText: "+2 Fortification in the pressured layer."
  },
  {
    id: passiveUnlockIds.scrapScroungeCache,
    ideology: "scrap",
    title: "Scrounge Cache",
    category: "passive-effect",
    summary: "While Scrap is medium or large, salvaging a Scrap-weighted card grants +1 Materials.",
    flavorText: "Dense neighborhoods know where the useful metal is buried.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "scrap",
      minimumTier: "medium"
    },
    persistsForRun: true,
    activeWhileRequirementMet: true
  },
  {
    id: "scrap-volley",
    ideology: "scrap",
    title: "Scrap Volley",
    category: "attack-card",
    summary: "Raid attack: hurl reclaimed metal into the first breach as a crude counterstrike.",
    flavorText: "If it can be lifted, it can be thrown.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "scrap",
      minimumTier: "medium"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    raidPool: "attack",
    raidEffectText: "-2 threat before impact."
  },
  {
    id: "scrap-iron-warren",
    ideology: "scrap",
    title: "Iron Warren",
    category: "doctrine",
    summary: "Large Scrap formations harden into a doctrine of packed refuge and stubborn defense.",
    flavorText: "The settlement stops feeling temporary the moment every path has cover.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "scrap",
      minimumTier: "large"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false
  },
  {
    id: "tech-signal-charter",
    ideology: "tech",
    title: "Signal Charter",
    category: "doctrine",
    summary: "Tech crews start reading clean lines and junctions as law instead of accident.",
    flavorText: "Order begins when someone notices the current already wants a route.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "tech",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false
  },
  {
    id: "tech-relay-pylon",
    ideology: "tech",
    title: "Relay Pylons",
    category: "build-card",
    summary: "Add Relay Pylon to the draw flow: a Tech line piece that grants Intel on build.",
    flavorText: "The first clean line never stays lonely for long.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "tech",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    buildCardStructureId: "relay-pylon",
    copiesAddedToDeck: 1
  },
  {
    id: "tech-junction-array",
    ideology: "tech",
    title: "Junction Arrays",
    category: "build-card",
    summary: "Add Junction Array to the draw flow: a simple routed upgrade site with Progress on build.",
    flavorText: "Once routing matters, every busy corner wants a formal switchboard.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "tech",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    buildCardStructureId: "junction-array",
    copiesAddedToDeck: 1
  },
  {
    id: "tech-signal-relay",
    ideology: "tech",
    title: "Signal Relay",
    category: "support-card",
    summary: "Raid support: route warnings and targeting data where the line is strongest.",
    flavorText: "One clear path can feel like ten extra eyes.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "tech",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    raidPool: "support",
    raidEffectText: "+1 pressure control and Block, or +2 pressure control if a Watchtower or active Tech pattern is live."
  },
  {
    id: passiveUnlockIds.techSurveyGrid,
    ideology: "tech",
    title: "Survey Grid",
    category: "passive-effect",
    summary: "While Tech is medium or large, gain +1 Intel at end turn if the winning Tech pattern includes a Watchtower.",
    flavorText: "A signal line becomes doctrine the moment someone trusts it enough to watch through it.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "tech",
      minimumTier: "medium"
    },
    persistsForRun: true,
    activeWhileRequirementMet: true
  },
  {
    id: "tech-overload-burst",
    ideology: "tech",
    title: "Overload Burst",
    category: "attack-card",
    summary: "Raid attack: dump a routed line into one sharp surge before the raiders close in.",
    flavorText: "Precision is just stored risk released on purpose.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "tech",
      minimumTier: "medium"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    raidPool: "attack",
    raidEffectText: "-2 threat, or -3 if any Watchtower is standing."
  },
  {
    id: "tech-circuit-catechism",
    ideology: "tech",
    title: "Circuit Catechism",
    category: "doctrine",
    summary: "Large Tech routes become a formal belief that nothing stays strong unless it stays connected.",
    flavorText: "Signal drift becomes heresy once the grid starts answering back.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "tech",
      minimumTier: "large"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false
  },
  {
    id: "magic-resonant-circle",
    ideology: "magic",
    title: "Resonant Circle",
    category: "doctrine",
    summary: "Magic practitioners begin naming arcs and corners as deliberate rites instead of coincidence.",
    flavorText: "The pattern is only superstition until it works twice.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "magic",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false
  },
  {
    id: "magic-ward-sigil",
    ideology: "magic",
    title: "Ward Sigils",
    category: "build-card",
    summary: "Add Ward Sigil to the draw flow: a Magic anchor that can strongly reinforce an inward defense line.",
    flavorText: "Once a shape starts saving lives, people stop waiting for permission to draw it again.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "magic",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    buildCardStructureId: "ward-sigil",
    copiesAddedToDeck: 1
  },
  {
    id: "magic-ley-lantern",
    ideology: "magic",
    title: "Ley Lanterns",
    category: "build-card",
    summary: "Add Ley Lantern to the draw flow: a stabilizing hybrid piece that heals Core on build.",
    flavorText: "A small ritual light is still a ritual if the settlement starts trusting it.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "magic",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    buildCardStructureId: "ley-lantern",
    copiesAddedToDeck: 1
  },
  {
    id: "magic-ward-arc",
    ideology: "magic",
    title: "Ward Arc",
    category: "support-card",
    summary: "Raid support: raise a brief geometric ward over the pressured layer.",
    flavorText: "A shape repeated under pressure starts to behave like a promise.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "magic",
      minimumTier: "small"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    raidPool: "support",
    raidEffectText: "+2 Block on the pressured layer and a small Core ward."
  },
  {
    id: passiveUnlockIds.magicLeyShelter,
    ideology: "magic",
    title: "Ley Shelter",
    category: "passive-effect",
    summary: "While Magic is medium or large, heal Core +1 at end turn.",
    flavorText: "Once the lines close, the strange geometry starts keeping people alive.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "magic",
      minimumTier: "medium"
    },
    persistsForRun: true,
    activeWhileRequirementMet: true
  },
  {
    id: "magic-hex-pulse",
    ideology: "magic",
    title: "Hex Pulse",
    category: "attack-card",
    summary: "Raid attack: discharge a resonant shape as a precise pulse into the incoming raid.",
    flavorText: "Ritual becomes artillery once the geometry remembers its aim.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "magic",
      minimumTier: "medium"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false,
    raidPool: "attack",
    raidEffectText: "-2 pressure and +1 Core Integrity."
  },
  {
    id: "magic-ritual-geometry",
    ideology: "magic",
    title: "Ritual Geometry",
    category: "doctrine",
    summary: "Large Magic forms turn stray superstition into a deliberate symbolic practice.",
    flavorText: "At some size, the settlement stops drawing shapes and starts obeying them.",
    trigger: {
      kind: "pattern-threshold",
      ideology: "magic",
      minimumTier: "large"
    },
    persistsForRun: true,
    activeWhileRequirementMet: false
  }
];

const progressionUnlockDefinitionMap = new Map(
  progressionUnlockDefinitions.map((definition) => [definition.id, definition])
);

export function getProgressionUnlockDefinition(
  unlockId: string
): ProgressionUnlockDefinition {
  const definition = progressionUnlockDefinitionMap.get(unlockId);

  if (!definition) {
    throw new Error(`Unknown progression unlock: ${unlockId}`);
  }

  return definition;
}
