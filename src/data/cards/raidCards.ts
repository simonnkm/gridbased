import type {
  CardDefinition,
  CardEffectCondition
} from "../../game/core/types/card-model";
import type { RaidCardPool } from "../progression";
import type { RaidCardIdeology } from "../../game/raid/types";

interface RaidCardMeta {
  sourceKind: "structure" | "unlock" | "reward";
  sourceId: string;
  sourcePool: RaidCardPool | "structure" | "reward";
  noteTemplate?: string;
}

const MEDIUM_PATTERN: CardEffectCondition = {
  kind: "pattern-tier-at-least",
  ideology: "scrap",
  minimumTier: "medium"
};

const TECH_MEDIUM_PATTERN: CardEffectCondition = {
  kind: "pattern-tier-at-least",
  ideology: "tech",
  minimumTier: "medium"
};

const MAGIC_MEDIUM_PATTERN: CardEffectCondition = {
  kind: "pattern-tier-at-least",
  ideology: "magic",
  minimumTier: "medium"
};

function makeRaidDefinition(
  id: string,
  title: string,
  category: "attack" | "block" | "support" | "special",
  ideologies: RaidCardIdeology[],
  cost: number,
  source: CardDefinition["source"],
  effects: CardDefinition["effects"],
  meta: RaidCardMeta,
  summary: string
): CardDefinition<"raid", RaidCardMeta> {
  return {
    id,
    kind: "raid",
    title,
    summary,
    category,
    ideologies,
    cost: {
      type: "energy",
      amount: cost
    },
    source,
    effects,
    weighted: {
      baseWeight: 1,
      focusMultiplier: 1.75,
      sourceCount: 1
    },
    tags: [meta.sourceKind, meta.sourcePool],
    meta
  };
}

export const raidCardDefinitions: CardDefinition<"raid", RaidCardMeta>[] = [
  makeRaidDefinition(
    "raid-structure-farm",
    "Stored Provisions",
    "support",
    ["scrap", "magic"],
    1,
    { type: "structure", id: "farm", title: "Farm" },
    [
      {
        type: "heal",
        amount: 2,
        scaling: { kind: "pattern-tier", ideology: "magic", amountPerTier: 1, maxBonus: 2 }
      },
      { type: "draw", amount: 1 }
    ],
    {
      sourceKind: "structure",
      sourceId: "farm",
      sourcePool: "structure",
      noteTemplate: "Derived from Farm support around the settlement."
    },
    "Restore Integrity and keep the hand moving."
  ),
  makeRaidDefinition(
    "raid-structure-mine",
    "Mine Bracing",
    "block",
    ["scrap", "tech"],
    1,
    { type: "structure", id: "mine", title: "Mine" },
    [
      {
        type: "block",
        amount: 4,
        scaling: { kind: "pattern-tier", ideology: "scrap", amountPerTier: 1, maxBonus: 1 }
      },
      {
        type: "attack",
        amount: 1,
        condition: { kind: "pattern-tier-at-least", ideology: "scrap", minimumTier: "medium" }
      }
    ],
    {
      sourceKind: "structure",
      sourceId: "mine",
      sourcePool: "structure",
      noteTemplate: "Derived from Mine bracing and plated supports."
    },
    "Heavy bracing converts mining muscle into block."
  ),
  makeRaidDefinition(
    "raid-structure-watchtower",
    "Watchtower Call",
    "support",
    ["tech", "magic"],
    1,
    { type: "structure", id: "watchtower", title: "Watchtower" },
    [
      { type: "draw", amount: 1 },
      { type: "draw", amount: 1, condition: TECH_MEDIUM_PATTERN },
      { type: "weaken", amount: 1 }
    ],
    {
      sourceKind: "structure",
      sourceId: "watchtower",
      sourcePool: "structure",
      noteTemplate: "Derived from Watchtower forecasts and signal reading."
    },
    "Forecast the next exchange and cut the incoming hit."
  ),
  makeRaidDefinition(
    "raid-structure-well",
    "Stabilize",
    "support",
    ["magic"],
    2,
    { type: "structure", id: "well", title: "Well" },
    [
      { type: "heal", amount: 3 },
      { type: "repair", amount: 1 },
      { type: "heal", amount: 1, condition: MAGIC_MEDIUM_PATTERN },
      { type: "block", amount: 1, condition: MAGIC_MEDIUM_PATTERN }
    ],
    {
      sourceKind: "structure",
      sourceId: "well",
      sourcePool: "structure",
      noteTemplate: "Derived from Well support and emergency stabilization."
    },
    "Recover Integrity and keep damaged structures in the fight."
  ),
  makeRaidDefinition(
    "raid-structure-muster-hall",
    "Militia Volley",
    "attack",
    ["scrap", "tech"],
    1,
    { type: "structure", id: "muster-hall", title: "Muster Hall" },
    [
      { type: "attack", amount: 4 }
    ],
    {
      sourceKind: "structure",
      sourceId: "muster-hall",
      sourcePool: "structure",
      noteTemplate: "Derived from Muster Hall militia drills."
    },
    "Turn local defenders into direct raid damage."
  ),
  makeRaidDefinition(
    "raid-structure-workshop",
    "Rapid Retrofit",
    "support",
    ["tech", "scrap"],
    2,
    { type: "structure", id: "workshop", title: "Workshop" },
    [
      {
        type: "attack",
        amount: 3,
        scaling: { kind: "pattern-tier", ideology: "tech", amountPerTier: 1, maxBonus: 1 }
      },
      { type: "draw", amount: 1 },
      {
        type: "attack",
        amount: 1,
        condition: { kind: "has-structure", structureId: "watchtower" }
      }
    ],
    {
      sourceKind: "structure",
      sourceId: "workshop",
      sourcePool: "structure",
      noteTemplate: "Derived from Workshop retrofits and line maintenance."
    },
    "Push tempo with repair crews and fast routed upgrades."
  ),
  makeRaidDefinition(
    "raid-structure-barricade-yard",
    "Welded Cover",
    "block",
    ["scrap"],
    1,
    { type: "structure", id: "barricade-yard", title: "Barricade Yard" },
    [
      {
        type: "block",
        amount: 4,
        scaling: { kind: "pattern-tier", ideology: "scrap", amountPerTier: 1, maxBonus: 1 }
      }
    ],
    {
      sourceKind: "structure",
      sourceId: "barricade-yard",
      sourcePool: "structure",
      noteTemplate: "Derived from Barricade Yard plating and welded cover."
    },
    "Simple welded cover that scales with Scrap pressure."
  ),
  makeRaidDefinition(
    "raid-structure-scrounge-depot",
    "Emergency Scrounge",
    "support",
    ["scrap", "tech"],
    2,
    { type: "structure", id: "scrounge-depot", title: "Scrounge Depot" },
    [
      { type: "block", amount: 1 },
      { type: "draw", amount: 1 },
      { type: "attack", amount: 2 },
      { type: "attack", amount: 1, condition: MEDIUM_PATTERN }
    ],
    {
      sourceKind: "structure",
      sourceId: "scrounge-depot",
      sourcePool: "structure",
      noteTemplate: "Derived from Scrounge Depot stockpiles and quick salvage."
    },
    "A flexible Scrap card that patches defense and returns fire."
  ),
  makeRaidDefinition(
    "raid-structure-relay-pylon",
    "Signal Relay",
    "support",
    ["tech"],
    1,
    { type: "structure", id: "relay-pylon", title: "Relay Pylon" },
    [
      { type: "draw", amount: 1 },
      { type: "weaken", amount: 1 },
      { type: "draw", amount: 1, condition: TECH_MEDIUM_PATTERN }
    ],
    {
      sourceKind: "structure",
      sourceId: "relay-pylon",
      sourcePool: "structure",
      noteTemplate: "Derived from Relay Pylon signal control."
    },
    "Route the next exchange through a cleaner signal path."
  ),
  makeRaidDefinition(
    "raid-structure-junction-array",
    "Junction Burst",
    "support",
    ["tech", "scrap"],
    2,
    { type: "structure", id: "junction-array", title: "Junction Array" },
    [
      {
        type: "attack",
        amount: 3,
        scaling: { kind: "pattern-tier", ideology: "tech", amountPerTier: 1, maxBonus: 1 }
      },
      { type: "draw", amount: 1 }
    ],
    {
      sourceKind: "structure",
      sourceId: "junction-array",
      sourcePool: "structure",
      noteTemplate: "Derived from Junction Array routing bursts."
    },
    "A compact Tech burst that converts routing into tempo."
  ),
  makeRaidDefinition(
    "raid-structure-ward-sigil",
    "Ward Sigil",
    "special",
    ["magic"],
    2,
    { type: "structure", id: "ward-sigil", title: "Ward Sigil" },
    [
      {
        type: "block",
        amount: 3,
        scaling: { kind: "pattern-tier", ideology: "magic", amountPerTier: 1, maxBonus: 1 }
      },
      { type: "heal", amount: 2 },
      { type: "block", amount: 1, condition: MAGIC_MEDIUM_PATTERN }
    ],
    {
      sourceKind: "structure",
      sourceId: "ward-sigil",
      sourcePool: "structure",
      noteTemplate: "Derived from Ward Sigil resonance lines."
    },
    "Wards the settlement while slowly restoring it."
  ),
  makeRaidDefinition(
    "raid-structure-ley-lantern",
    "Ley Lantern",
    "special",
    ["magic", "tech"],
    1,
    { type: "structure", id: "ley-lantern", title: "Ley Lantern" },
    [
      {
        type: "heal",
        amount: 3,
        scaling: { kind: "pattern-tier", ideology: "magic", amountPerTier: 1, maxBonus: 2 }
      },
      { type: "weaken", amount: 1 },
      { type: "draw", amount: 1, condition: MAGIC_MEDIUM_PATTERN }
    ],
    {
      sourceKind: "structure",
      sourceId: "ley-lantern",
      sourcePool: "structure",
      noteTemplate: "Derived from Ley Lantern resonance support."
    },
    "Resonant support that softens incoming hits while sustaining the core."
  ),
  makeRaidDefinition(
    "raid-structure-scrap-bastion",
    "Bastion Stand",
    "special",
    ["scrap"],
    3,
    { type: "structure", id: "scrap-bastion", title: "Scrap Bastion" },
    [
      {
        type: "attack",
        amount: 5,
        scaling: { kind: "pattern-tier", ideology: "scrap", amountPerTier: 1, maxBonus: 1 }
      },
      {
        type: "block",
        amount: 4,
        scaling: { kind: "pattern-tier", ideology: "scrap", amountPerTier: 1, maxBonus: 1 }
      }
    ],
    {
      sourceKind: "structure",
      sourceId: "scrap-bastion",
      sourcePool: "structure",
      noteTemplate: "Derived from the Scrap Bastion's reinforced holdfast."
    },
    "A premium Scrap swing that hits and braces at once."
  ),
  makeRaidDefinition(
    "raid-unlock-scrap-barricade",
    "Barricade",
    "block",
    ["scrap"],
    1,
    { type: "unlock", id: "scrap-barricade", title: "Barricade" },
    [
      {
        type: "block",
        amount: 4,
        scaling: { kind: "pattern-tier", ideology: "scrap", amountPerTier: 1, maxBonus: 1 }
      }
    ],
    {
      sourceKind: "unlock",
      sourceId: "scrap-barricade",
      sourcePool: "support"
    },
    "A doctrine-level Scrap guard card."
  ),
  makeRaidDefinition(
    "raid-unlock-scrap-volley",
    "Scrap Volley",
    "attack",
    ["scrap"],
    2,
    { type: "unlock", id: "scrap-volley", title: "Scrap Volley" },
    [
      {
        type: "attack",
        amount: 7,
        scaling: { kind: "pattern-tier", ideology: "scrap", amountPerTier: 1, maxBonus: 1 }
      }
    ],
    {
      sourceKind: "unlock",
      sourceId: "scrap-volley",
      sourcePool: "attack"
    },
    "A direct Scrap strike card unlocked by dense builds."
  ),
  makeRaidDefinition(
    "raid-unlock-tech-signal-relay",
    "Signal Relay",
    "support",
    ["tech"],
    1,
    { type: "unlock", id: "tech-signal-relay", title: "Signal Relay" },
    [
      { type: "draw", amount: 1 },
      { type: "weaken", amount: 1 },
      { type: "draw", amount: 1, condition: { kind: "has-structure", structureId: "watchtower" } }
    ],
    {
      sourceKind: "unlock",
      sourceId: "tech-signal-relay",
      sourcePool: "support"
    },
    "Route warnings and targeting through the active grid."
  ),
  makeRaidDefinition(
    "raid-unlock-tech-overload-burst",
    "Overload Burst",
    "attack",
    ["tech"],
    3,
    { type: "unlock", id: "tech-overload-burst", title: "Overload Burst" },
    [
      {
        type: "attack",
        amount: 7,
        scaling: { kind: "pattern-tier", ideology: "tech", amountPerTier: 1, maxBonus: 1 }
      },
      {
        type: "draw",
        amount: 1,
        condition: { kind: "has-structure", structureId: "workshop" }
      }
    ],
    {
      sourceKind: "unlock",
      sourceId: "tech-overload-burst",
      sourcePool: "attack"
    },
    "A premium Tech burst that can chain if Workshops are live."
  ),
  makeRaidDefinition(
    "raid-unlock-magic-ward-arc",
    "Ward Arc",
    "special",
    ["magic"],
    2,
    { type: "unlock", id: "magic-ward-arc", title: "Ward Arc" },
    [
      {
        type: "block",
        amount: 3,
        scaling: { kind: "pattern-tier", ideology: "magic", amountPerTier: 1, maxBonus: 1 }
      },
      { type: "heal", amount: 2 },
      { type: "block", amount: 1, condition: MAGIC_MEDIUM_PATTERN },
      { type: "heal", amount: 1, condition: MAGIC_MEDIUM_PATTERN }
    ],
    {
      sourceKind: "unlock",
      sourceId: "magic-ward-arc",
      sourcePool: "support"
    },
    "A doctrine-level ward that favors inner protection."
  ),
  makeRaidDefinition(
    "raid-unlock-magic-hex-pulse",
    "Hex Pulse",
    "special",
    ["magic"],
    2,
    { type: "unlock", id: "magic-hex-pulse", title: "Hex Pulse" },
    [
      {
        type: "attack",
        amount: 5,
        scaling: { kind: "pattern-tier", ideology: "magic", amountPerTier: 1, maxBonus: 2 }
      },
      { type: "heal", amount: 1 },
      { type: "attack", amount: 3, condition: MAGIC_MEDIUM_PATTERN },
      { type: "heal", amount: 2, condition: MAGIC_MEDIUM_PATTERN },
      { type: "weaken", amount: 1, condition: MAGIC_MEDIUM_PATTERN }
    ],
    {
      sourceKind: "unlock",
      sourceId: "magic-hex-pulse",
      sourcePool: "attack"
    },
    "A Magic pulse that hurts raiders while recovering the settlement."
  ),
  makeRaidDefinition(
    "raid-reward-scrap",
    "Jury-Rigged Salvo",
    "special",
    ["scrap"],
    2,
    { type: "reward", id: "scrap", title: "Raid Reward" },
    [
      { type: "attack", amount: 5 },
      { type: "block", amount: 1 }
    ],
    {
      sourceKind: "reward",
      sourceId: "scrap",
      sourcePool: "reward"
    },
    "Reward card tuned for stubborn Scrap pushes."
  ),
  makeRaidDefinition(
    "raid-reward-tech",
    "Ghost Circuit",
    "support",
    ["tech"],
    2,
    { type: "reward", id: "tech", title: "Raid Reward" },
    [
      { type: "draw", amount: 1 },
      { type: "weaken", amount: 2 }
    ],
    {
      sourceKind: "reward",
      sourceId: "tech",
      sourcePool: "reward"
    },
    "Reward card tuned for signal control and tempo."
  ),
  makeRaidDefinition(
    "raid-reward-magic",
    "Sanctum Pulse",
    "special",
    ["magic"],
    2,
    { type: "reward", id: "magic", title: "Raid Reward" },
    [
      { type: "block", amount: 4 },
      { type: "heal", amount: 3 }
    ],
    {
      sourceKind: "reward",
      sourceId: "magic",
      sourcePool: "reward"
    },
    "Reward card tuned for wards and inner recovery."
  ),
  makeRaidDefinition(
    "raid-reward-neutral",
    "Reserve Cache",
    "support",
    ["neutral"],
    1,
    { type: "reward", id: "neutral", title: "Raid Reward" },
    [
      { type: "draw", amount: 1 },
      { type: "block", amount: 3 }
    ],
    {
      sourceKind: "reward",
      sourceId: "neutral",
      sourcePool: "reward"
    },
    "A neutral reserve card earned after a hard raid."
  )
];

export const raidCardDefinitionMap = new Map(
  raidCardDefinitions.map((definition) => [definition.id, definition])
);

export const structureRaidCardDefinitionByStructureId = new Map(
  raidCardDefinitions
    .filter((definition) => definition.meta?.sourceKind === "structure")
    .map((definition) => [definition.meta!.sourceId, definition])
);

export const unlockRaidCardDefinitionByUnlockId = new Map(
  raidCardDefinitions
    .filter((definition) => definition.meta?.sourceKind === "unlock")
    .map((definition) => [definition.meta!.sourceId, definition])
);

export const rewardRaidCardDefinitionByIdeology = new Map(
  raidCardDefinitions
    .filter((definition) => definition.meta?.sourceKind === "reward")
    .map((definition) => [definition.meta!.sourceId, definition])
);
