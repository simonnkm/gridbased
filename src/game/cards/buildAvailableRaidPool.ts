import {
  getRaidCardDefinitionForStructure,
  getRaidCardDefinitionForUnlock
} from "../../data/cards/cardRegistry";
import type { GameState } from "../state/types";
import type {
  RaidCombatCard,
  RaidCombatCardEffect,
  RaidCombatRole,
  RaidLayerState,
  RaidPatternSummary
} from "../raid/types";
import {
  buildPlayerCombatContext,
  buildRaidLayerStates,
  buildRaidPatternSummaries,
  RAID_LAYER_LABELS
} from "../combat/combatSetup";
import { getSettlementExpansionBonuses } from "../selectors";
import { applyIdeologyWeightBonus } from "./applyIdeologyWeights";
import {
  formatRaidCombatEffectSummary,
  instantiateRaidCombatCard
} from "./effectResolver";
import { scoreCombatCardForDeck } from "./cardSelectors";

const CANONICAL_TEMPLATE_ID_BY_TEMPLATE_ID: Record<string, string> = {
  "raid-structure-farm": "raid-canonical-rations",
  "raid-structure-mine": "raid-canonical-fortify",
  "raid-structure-watchtower": "raid-canonical-scout-call",
  "raid-structure-well": "raid-canonical-field-repair",
  "raid-structure-muster-hall": "raid-canonical-militia-volley",
  "raid-structure-workshop": "raid-canonical-improvised-build",
  "raid-structure-barricade-yard": "raid-canonical-scrap-bulwark",
  "raid-unlock-scrap-barricade": "raid-canonical-scrap-bulwark",
  "raid-structure-scrounge-depot": "raid-canonical-salvage-rush",
  "raid-structure-relay-pylon": "raid-canonical-signal-network",
  "raid-unlock-tech-signal-relay": "raid-canonical-signal-network",
  "raid-reward-tech": "raid-canonical-signal-network",
  "raid-structure-junction-array": "raid-canonical-rapid-retrofit",
  "raid-unlock-tech-overload-burst": "raid-canonical-overload-burst",
  "raid-unlock-scrap-volley": "raid-canonical-scrap-volley",
  "raid-structure-scrap-bastion": "raid-canonical-scrap-volley",
  "raid-reward-scrap": "raid-canonical-scrap-volley",
  "raid-structure-ward-sigil": "raid-canonical-ward-lattice",
  "raid-unlock-magic-ward-arc": "raid-canonical-ward-lattice",
  "raid-unlock-magic-hex-pulse": "raid-canonical-hex-pulse",
  "raid-structure-ley-lantern": "raid-canonical-ley-lantern",
  "raid-reward-magic": "raid-canonical-sanctum-pulse",
  "raid-reward-neutral": "raid-canonical-improvised-build"
};

interface CanonicalAggregationBucket {
  representative: RaidCombatCard;
  representativeScore: number;
  totalDrawWeight: number;
  totalSourceCount: number;
  sourceTitles: Set<string>;
  sourceTypes: Set<RaidCombatCard["sourceType"]>;
}

interface CanonicalCardProfile {
  title: string;
  cost: number;
  category: RaidCombatCard["category"];
  role: RaidCombatRole;
  ideologies: RaidCombatCard["ideologies"];
  effects: RaidCombatCardEffect[];
  summary?: string;
}

function getCanonicalTemplateId(templateId: string): string {
  return CANONICAL_TEMPLATE_ID_BY_TEMPLATE_ID[templateId] ?? templateId;
}

function formatSourceSummary(sourceTitles: string[]): string {
  if (sourceTitles.length <= 0) {
    return "Unknown source";
  }

  if (sourceTitles.length === 1) {
    return sourceTitles[0];
  }

  if (sourceTitles.length === 2) {
    return `${sourceTitles[0]} + ${sourceTitles[1]}`;
  }

  return `${sourceTitles[0]} + ${sourceTitles.length - 1} more`;
}

function getTotals(card: RaidCombatCard): Record<RaidCombatCard["effects"][number]["type"], number> {
  return card.effects.reduce(
    (totals, effect) => {
      totals[effect.type] += effect.amount;
      return totals;
    },
    {
      attack: 0,
      block: 0,
      heal: 0,
      draw: 0,
      weaken: 0,
      repair: 0
    }
  );
}

function inferCombatRole(card: RaidCombatCard, hasUnlockSource: boolean): RaidCombatRole {
  const totals = getTotals(card);
  const singleIdeology = card.ideologies.length === 1 && card.ideology !== "neutral";
  const highPayoff = totals.attack >= 7 || totals.block >= 6 || totals.heal + totals.block >= 7;

  if (hasUnlockSource && singleIdeology && highPayoff) {
    return "ideology-payoff";
  }

  if (totals.block >= 5 && totals.attack <= 1 && totals.heal <= 2) {
    return "defense";
  }

  if (totals.heal >= 3 || totals.repair >= 1) {
    return "sustain";
  }

  if (totals.draw >= 2 || (totals.draw >= 1 && totals.weaken >= 1 && totals.attack === 0)) {
    return "utility";
  }

  if (totals.attack >= 7 || (totals.attack >= 6 && card.cost >= 2)) {
    return "burst";
  }

  if (totals.draw >= 1 && (totals.attack >= 2 || totals.block >= 2)) {
    return "tempo";
  }

  if (totals.draw >= 1 || totals.weaken >= 1) {
    return "utility";
  }

  return totals.attack >= 4 ? "burst" : "defense";
}

function buildCanonicalCardProfile(
  canonicalTemplateId: string,
  representative: RaidCombatCard,
  context: ReturnType<typeof buildPlayerCombatContext>,
  expansion: ReturnType<typeof getSettlementExpansionBonuses>
): CanonicalCardProfile | null {
  const scrapTier = context.patternTierValues.scrap;
  const techTier = context.patternTierValues.tech;
  const magicTier = context.patternTierValues.magic;
  const denseScrap = scrapTier >= 2 || expansion.scrapDensityBonus >= 1;
  const techLinked = techTier >= 1;
  const techInvested = techTier >= 2;
  const magicActive = magicTier >= 1;
  const magicInvested = magicTier >= 2;

  switch (canonicalTemplateId) {
    case "raid-canonical-militia-volley":
      return {
        title: "Militia Volley",
        cost: 1,
        category: "attack",
        role: "burst",
        ideologies: ["neutral"],
        effects: [{ type: "attack", amount: 4 }]
      };
    case "raid-canonical-fortify":
      return {
        title: "Fortify",
        cost: 1,
        category: "block",
        role: "defense",
        ideologies: ["neutral"],
        effects: [{ type: "block", amount: 5 }]
      };
    case "raid-canonical-rations":
      return {
        title: "Rations",
        cost: 1,
        category: "support",
        role: "sustain",
        ideologies: ["neutral"],
        effects: [{ type: "heal", amount: 3 }]
      };
    case "raid-canonical-scout-call":
      return {
        title: "Scout Call",
        cost: 1,
        category: "support",
        role: "utility",
        ideologies: ["neutral"],
        effects: [
          { type: "draw", amount: 1 },
          { type: "weaken", amount: 1 }
        ]
      };
    case "raid-canonical-field-repair":
      return {
        title: "Field Repair",
        cost: 2,
        category: "support",
        role: "sustain",
        ideologies: ["neutral"],
        effects: [
          { type: "heal", amount: 3 },
          { type: "repair", amount: 1 }
        ]
      };
    case "raid-canonical-improvised-build":
      return {
        title: "Improvised Build",
        cost: 2,
        category: "support",
        role: "tempo",
        ideologies: ["neutral"],
        effects: [
          { type: "attack", amount: 3 },
          { type: "block", amount: 3 },
          { type: "draw", amount: 1 }
        ]
      };
    case "raid-canonical-scrap-bulwark":
      return {
        title: "Scrap Bulwark",
        cost: 1,
        category: "block",
        role: "defense",
        ideologies: ["scrap"],
        effects: [{ type: "block", amount: denseScrap ? 7 : 6 }]
      };
    case "raid-canonical-scrap-volley":
      return {
        title: "Scrap Volley",
        cost: 2,
        category: "attack",
        role: "burst",
        ideologies: ["scrap"],
        effects: [{ type: "attack", amount: denseScrap ? 9 : 8 }]
      };
    case "raid-canonical-salvage-rush":
      return {
        title: "Salvage Rush",
        cost: 1,
        category: "support",
        role: "utility",
        ideologies: ["scrap"],
        effects: [
          { type: "draw", amount: 1 },
          { type: "block", amount: 1 },
          ...(denseScrap ? [{ type: "attack", amount: 1 } satisfies RaidCombatCardEffect] : [])
        ]
      };
    case "raid-canonical-signal-network":
      return {
        title: "Signal Network",
        cost: 1,
        category: "support",
        role: "utility",
        ideologies: ["tech"],
        effects: [
          { type: "draw", amount: 1 },
          { type: "weaken", amount: techLinked ? 2 : 1 }
        ]
      };
    case "raid-canonical-rapid-retrofit":
      return {
        title: "Rapid Retrofit",
        cost: 2,
        category: "support",
        role: "tempo",
        ideologies: ["tech"],
        effects: [
          { type: "attack", amount: techLinked ? 5 : 4 },
          { type: "draw", amount: 1 },
          { type: "block", amount: 1 }
        ]
      };
    case "raid-canonical-overload-burst":
      return {
        title: "Overload Burst",
        cost: 3,
        category: "attack",
        role: "ideology-payoff",
        ideologies: ["tech"],
        effects: [
          { type: "attack", amount: techInvested ? 10 : 9 },
          { type: "draw", amount: 1 }
        ]
      };
    case "raid-canonical-ward-lattice":
      return {
        title: "Ward Lattice",
        cost: 2,
        category: "special",
        role: "sustain",
        ideologies: ["magic"],
        effects: [
          { type: "block", amount: 4 },
          { type: "heal", amount: magicInvested ? 4 : 3 }
        ]
      };
    case "raid-canonical-hex-pulse":
      return {
        title: "Hex Pulse",
        cost: 2,
        category: "special",
        role: "ideology-payoff",
        ideologies: ["magic"],
        effects: [
          { type: "attack", amount: magicInvested ? 7 : 6 },
          { type: "heal", amount: 2 },
          { type: "weaken", amount: 1 }
        ]
      };
    case "raid-canonical-ley-lantern":
      return {
        title: "Ley Lantern",
        cost: 1,
        category: "special",
        role: "sustain",
        ideologies: ["magic"],
        effects: [
          { type: "heal", amount: 2 },
          ...(magicActive ? [{ type: "draw", amount: 1 } satisfies RaidCombatCardEffect] : [])
        ]
      };
    case "raid-canonical-sanctum-pulse":
      return {
        title: "Sanctum Pulse",
        cost: 3,
        category: "special",
        role: "ideology-payoff",
        ideologies: ["magic"],
        effects: [
          { type: "block", amount: magicInvested ? 6 : 5 },
          { type: "heal", amount: 4 },
          { type: "repair", amount: 1 }
        ]
      };
    default:
      return representative.templateId === canonicalTemplateId
        ? null
        : {
            title: representative.title,
            cost: representative.cost,
            category: representative.category,
            role: representative.role ?? "utility",
            ideologies: representative.ideologies,
            effects: representative.effects
          };
  }
}

function getPrimaryIdeology(
  ideologies: RaidCombatCard["ideologies"],
  fallback: RaidCombatCard["ideology"]
): RaidCombatCard["ideology"] {
  const first = ideologies.find((ideology) => ideology !== "neutral");

  return first ?? fallback;
}

export function buildAvailableRaidPool(
  state: GameState,
  layersArg?: RaidLayerState[],
  activePatternsArg?: RaidPatternSummary[]
): RaidCombatCard[] {
  const layers = layersArg ?? buildRaidLayerStates(state);
  const activePatterns = activePatternsArg ?? buildRaidPatternSummaries(state);
  const context = buildPlayerCombatContext(layers, activePatterns);
  const expansionBonuses = getSettlementExpansionBonuses(state);
  const cards: RaidCombatCard[] = [];

  for (const layer of layers) {
    for (const structure of layer.structures) {
      if (structure.status === "destroyed") {
        continue;
      }

      const definition = getRaidCardDefinitionForStructure(structure.structureId);
      const baseWeight = definition.weighted?.baseWeight ?? 1;
      const conditionWeight =
        structure.condition <= 1 ? 0.55 : structure.condition === 2 ? 0.8 : 1;
      const growthWeightBonus =
        (expansionBonuses.builtCount >= 8 ? 0.1 : 0) +
        (expansionBonuses.builtCount >= 14 ? 0.1 : 0) +
        (expansionBonuses.developedRings >= 2 ? 0.12 : 0) +
        (expansionBonuses.outerRingCount >= 4 ? 0.08 : 0) +
        (definition.ideologies.includes("scrap")
          ? expansionBonuses.scrapDensityBonus * 0.16
          : 0);
      const drawWeight = applyIdeologyWeightBonus(
        baseWeight * conditionWeight,
        definition.ideologies,
        state.progression
      ) + growthWeightBonus;

      cards.push(
        instantiateRaidCombatCard(definition, context, {
          templateId: definition.id,
          instanceId: definition.id,
          sourceType: "structure",
          sourceTitle: structure.title,
          sourceLayerId: layer.id,
          originCellId: structure.cellId,
          drawWeight,
          sourceCount: 1,
          noteLine: `Derived from ${structure.title} in the ${RAID_LAYER_LABELS[layer.id]}.`
        })
      );
    }
  }

  for (const unlockId of state.progression.raidPools.support) {
    const definition = getRaidCardDefinitionForUnlock(unlockId);
    const growthWeightBonus =
      (expansionBonuses.developedRings >= 2 ? 0.1 : 0) +
      (expansionBonuses.builtCount >= 14 ? 0.06 : 0) +
      (definition.ideologies.includes("scrap")
        ? expansionBonuses.scrapDensityBonus * 0.14
        : 0);

    cards.push(
      instantiateRaidCombatCard(definition, context, {
        templateId: definition.id,
        instanceId: definition.id,
        sourceType: "unlock",
        sourceTitle: definition.title,
        sourcePool: definition.meta?.sourcePool as RaidCombatCard["sourcePool"],
        drawWeight:
          applyIdeologyWeightBonus(
            definition.weighted?.baseWeight ?? 1,
            definition.ideologies,
            state.progression
          ) + growthWeightBonus
      })
    );
  }

  for (const unlockId of state.progression.raidPools.attack) {
    const definition = getRaidCardDefinitionForUnlock(unlockId);
    const growthWeightBonus =
      (expansionBonuses.developedRings >= 2 ? 0.1 : 0) +
      (expansionBonuses.builtCount >= 14 ? 0.06 : 0) +
      (definition.ideologies.includes("scrap")
        ? expansionBonuses.scrapDensityBonus * 0.14
        : 0);

    cards.push(
      instantiateRaidCombatCard(definition, context, {
        templateId: definition.id,
        instanceId: definition.id,
        sourceType: "unlock",
        sourceTitle: definition.title,
        sourcePool: definition.meta?.sourcePool as RaidCombatCard["sourcePool"],
        drawWeight:
          applyIdeologyWeightBonus(
            definition.weighted?.baseWeight ?? 1,
            definition.ideologies,
            state.progression
          ) + growthWeightBonus
      })
    );
  }

  for (const bonusCard of state.bonusCombatCards) {
    cards.push({
      ...bonusCard,
      id: bonusCard.templateId
    });
  }

  const aggregatedCards = new Map<string, CanonicalAggregationBucket>();

  for (const card of cards) {
    const canonicalTemplateId = getCanonicalTemplateId(card.templateId);
    const cardScore = scoreCombatCardForDeck(card);
    const existing = aggregatedCards.get(canonicalTemplateId);

    if (!existing) {
      aggregatedCards.set(canonicalTemplateId, {
        representative: { ...card },
        representativeScore: cardScore,
        totalDrawWeight: card.drawWeight,
        totalSourceCount: card.sourceCount,
        sourceTitles: new Set([card.sourceTitle]),
        sourceTypes: new Set([card.sourceType])
      });
      continue;
    }

    if (cardScore > existing.representativeScore) {
      existing.representative = { ...card };
      existing.representativeScore = cardScore;
    }

    existing.totalDrawWeight += card.drawWeight;
    existing.totalSourceCount += card.sourceCount;
    existing.sourceTitles.add(card.sourceTitle);
    existing.sourceTypes.add(card.sourceType);
  }

  return [...aggregatedCards.entries()]
    .map(([canonicalTemplateId, bucket]) => {
      const sourceTitles = [...bucket.sourceTitles].sort((left, right) =>
        left.localeCompare(right)
      );
      const sourceSummary = formatSourceSummary(sourceTitles);
      const hasUnlockSource = bucket.sourceTypes.has("unlock");
      const representative = bucket.representative;
      const canonicalProfile = buildCanonicalCardProfile(
        canonicalTemplateId,
        representative,
        context,
        expansionBonuses
      );
      const effects = canonicalProfile?.effects ?? representative.effects;
      const ideologies = canonicalProfile?.ideologies ?? representative.ideologies;
      const role =
        canonicalProfile?.role ??
        representative.role ??
        inferCombatRole(representative, hasUnlockSource);
      const noteLines = Array.from(
        new Set([
          ...representative.noteLines,
          sourceTitles.length > 1
            ? `Merged sources: ${sourceTitles.join(", ")}.`
            : `Source: ${sourceSummary}.`,
          `Role: ${role}.`
        ])
      );
      const drawWeight =
        bucket.totalDrawWeight +
        (role === "ideology-payoff" && expansionBonuses.builtCount >= 12 ? 0.14 : 0) +
        (role === "ideology-payoff" && expansionBonuses.developedRings >= 2 ? 0.1 : 0) +
        (role === "defense" && expansionBonuses.upkeepSupportBonus > 0 ? 0.1 : 0) +
        (role === "tempo" && expansionBonuses.applicationPointBonus > 0 ? 0.08 : 0);

      return {
        ...representative,
        id: canonicalTemplateId,
        templateId: canonicalTemplateId,
        title: canonicalProfile?.title ?? representative.title,
        summary: canonicalProfile?.summary ?? formatRaidCombatEffectSummary(effects),
        category: canonicalProfile?.category ?? representative.category,
        cost: canonicalProfile?.cost ?? representative.cost,
        ideology: getPrimaryIdeology(ideologies, representative.ideology),
        ideologies,
        effects,
        drawWeight,
        sourceCount: bucket.totalSourceCount,
        sourceTitle: sourceSummary,
        sourceTitles,
        role,
        noteLines
      } satisfies RaidCombatCard;
    })
    .sort(
      (left, right) =>
        scoreCombatCardForDeck(right) - scoreCombatCardForDeck(left) ||
        right.drawWeight - left.drawWeight ||
        left.title.localeCompare(right.title)
    );
}
