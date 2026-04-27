import type { CardDefinition } from "../../game/core/types/card-model";
import type { RaidEnemyArchetype } from "../../game/raid/types";

interface EnemyRaidCardMeta {
  archetype: RaidEnemyArchetype;
}

function enemyCard(
  id: string,
  title: string,
  category: "attack" | "block" | "support" | "special",
  archetype: RaidEnemyArchetype,
  summary: string,
  effects: CardDefinition["effects"]
): CardDefinition<"enemy-raid", EnemyRaidCardMeta> {
  return {
    id,
    kind: "enemy-raid",
    title,
    summary,
    category,
    ideologies: [archetype === "cult" ? "magic" : archetype],
    cost: {
      type: "none",
      amount: 0
    },
    source: {
      type: "enemy-archetype",
      id: archetype,
      title: archetype
    },
    effects,
    weighted: {
      baseWeight: 1,
      sourceCount: 1
    },
    tags: [archetype, category],
    meta: {
      archetype
    }
  };
}

export const enemyRaidCardDefinitions: CardDefinition<"enemy-raid", EnemyRaidCardMeta>[] = [
  enemyCard(
    "enemy-scrap-ram-charge",
    "Ram Charge",
    "attack",
    "scrap",
    "A blunt armored shove into the settlement line.",
    [{ type: "damage", amount: 5 }]
  ),
  enemyCard(
    "enemy-scrap-hook-chains",
    "Hook Chains",
    "special",
    "scrap",
    "Chains rip cover apart before the push lands.",
    [
      { type: "shred-block", amount: 3 },
      { type: "damage", amount: 4 }
    ]
  ),
  enemyCard(
    "enemy-scrap-plate-wall",
    "Plate Wall",
    "block",
    "scrap",
    "The raiders weld a moving wall and lean behind it.",
    [{ type: "guard", amount: 3 }]
  ),
  enemyCard(
    "enemy-scrap-salvage-rush",
    "Salvage Rush",
    "support",
    "scrap",
    "A quick patch job keeps the push moving.",
    [
      { type: "heal", amount: 2 },
      { type: "damage", amount: 3 }
    ]
  ),
  enemyCard(
    "enemy-scrap-breach-crew",
    "Breach Crew",
    "attack",
    "scrap",
    "A focused breach team presses for a clean opening.",
    [{ type: "damage", amount: 6 }]
  ),
  enemyCard(
    "enemy-tech-probe-line",
    "Probe Line",
    "attack",
    "tech",
    "A testing strike searches for weak shielding.",
    [
      { type: "damage", amount: 3 },
      { type: "shred-block", amount: 1 }
    ]
  ),
  enemyCard(
    "enemy-tech-drain-splice",
    "Drain Splice",
    "special",
    "tech",
    "They cut through temporary cover before siphoning deeper.",
    [
      { type: "shred-block", amount: 2 },
      { type: "damage", amount: 4 }
    ]
  ),
  enemyCard(
    "enemy-tech-crossfeed-loop",
    "Crossfeed Loop",
    "support",
    "tech",
    "Recovered charge feeds the raid back to strength.",
    [
      { type: "heal", amount: 3 },
      { type: "guard", amount: 1 }
    ]
  ),
  enemyCard(
    "enemy-tech-noise-screen",
    "Noise Screen",
    "block",
    "tech",
    "A shield of buzzing junk blunts incoming response.",
    [{ type: "guard", amount: 3 }]
  ),
  enemyCard(
    "enemy-tech-voltage-cut",
    "Voltage Cut",
    "attack",
    "tech",
    "A sharp cut arcs straight into the settlement.",
    [{ type: "damage", amount: 6 }]
  ),
  enemyCard(
    "enemy-tech-jammer-lattice",
    "Jammer Lattice",
    "support",
    "tech",
    "A jamming mesh strips cover and sets up the next breach.",
    [
      { type: "shred-block", amount: 3 },
      { type: "guard", amount: 2 }
    ]
  ),
  enemyCard(
    "enemy-cult-ash-knives",
    "Ash Knives",
    "attack",
    "cult",
    "A sudden rushing cut into the settlement line.",
    [{ type: "damage", amount: 5 }]
  ),
  enemyCard(
    "enemy-cult-black-omen",
    "Black Omen",
    "special",
    "cult",
    "A heavy ritual blow aimed at breaking morale outright.",
    [{ type: "damage", amount: 7 }]
  ),
  enemyCard(
    "enemy-cult-smoke-ward",
    "Smoke Ward",
    "block",
    "cult",
    "The warband braces behind thick ash and symbols.",
    [{ type: "guard", amount: 4 }]
  ),
  enemyCard(
    "enemy-cult-blood-rite",
    "Blood Rite",
    "support",
    "cult",
    "A brutal rite restores strength while keeping the attack moving.",
    [
      { type: "heal", amount: 3 },
      { type: "damage", amount: 3 }
    ]
  ),
  enemyCard(
    "enemy-cult-hex-pressure",
    "Hex Pressure",
    "special",
    "cult",
    "They strip away cover before the inner shove.",
    [
      { type: "shred-block", amount: 3 },
      { type: "damage", amount: 4 }
    ]
  ),
  enemyCard(
    "enemy-cult-cinder-curse",
    "Cinder Curse",
    "special",
    "cult",
    "A low chant burns straight into the settlement heart.",
    [
      { type: "drain-integrity", amount: 3 },
      { type: "heal", amount: 1 }
    ]
  )
];

export const enemyRaidCardDefinitionMap = new Map(
  enemyRaidCardDefinitions.map((definition) => [definition.id, definition])
);
