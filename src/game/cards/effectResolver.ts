import type {
  CardDefinition,
  CardEffect,
  CardEffectCondition,
  CardIdeologyTag
} from "../core/types/card-model";
import { getRewardRaidCardDefinition } from "../../data/cards/cardRegistry";
import type { Ideology } from "../patterns/types";
import type {
  RaidCardIdeology,
  RaidCombatCard,
  RaidCombatCardEffect,
  RaidEnemyCard,
  RaidEnemyCardEffect,
  RaidLayerId
} from "../raid/types";
import type { PlayerCombatContext } from "../combat/combatSetup";
import { formatList } from "../../utils/format";

function minimumTierValue(condition: Extract<CardEffectCondition, { kind: "pattern-tier-at-least" }>["minimumTier"]): number {
  switch (condition) {
    case "small":
      return 1;
    case "medium":
      return 2;
    case "large":
      return 3;
  }
}

function getPrimaryIdeology(ideologies: CardIdeologyTag[]): RaidCardIdeology {
  const firstIdeology = ideologies.find((ideology) => ideology !== "neutral");
  return (firstIdeology ?? "neutral") as RaidCardIdeology;
}

function meetsCondition(effect: CardEffect, context: PlayerCombatContext): boolean {
  if (!effect.condition) {
    return true;
  }

  if (effect.condition.kind === "has-structure") {
    return context.availableStructureIds.has(effect.condition.structureId);
  }

  return (
    context.patternTierValues[effect.condition.ideology] >=
    minimumTierValue(effect.condition.minimumTier)
  );
}

function resolveEffectAmount(effect: CardEffect, context: PlayerCombatContext): number {
  const baseAmount = effect.amount ?? 0;

  if (!effect.scaling || effect.scaling.kind !== "pattern-tier") {
    return baseAmount;
  }

  const tierValue = context.patternTierValues[effect.scaling.ideology];
  const scaledBonus = tierValue * effect.scaling.amountPerTier;
  const cappedBonus =
    effect.scaling.maxBonus === undefined
      ? scaledBonus
      : Math.min(effect.scaling.maxBonus, scaledBonus);

  return baseAmount + cappedBonus;
}

function toRaidCombatEffect(
  effect: CardEffect,
  context: PlayerCombatContext
): RaidCombatCardEffect | null {
  if (!meetsCondition(effect, context)) {
    return null;
  }

  if (
    effect.type === "attack" ||
    effect.type === "block" ||
    effect.type === "heal" ||
    effect.type === "draw" ||
    effect.type === "weaken" ||
    effect.type === "repair"
  ) {
    return {
      type: effect.type,
      amount: resolveEffectAmount(effect, context)
    };
  }

  return null;
}

function toEnemyEffect(effect: CardEffect): RaidEnemyCardEffect | null {
  if (
    effect.type === "damage" ||
    effect.type === "guard" ||
    effect.type === "heal" ||
    effect.type === "shred-block" ||
    effect.type === "drain-integrity"
  ) {
    return {
      type: effect.type,
      amount: effect.amount ?? 0
    };
  }

  return null;
}

export function formatRaidCombatEffectSummary(effects: RaidCombatCardEffect[]): string {
  if (effects.length === 0) {
    return "No immediate effect.";
  }

  const lines = effects.map((effect) => {
    switch (effect.type) {
      case "attack":
        return `Deal ${effect.amount}`;
      case "block":
        return `Gain ${effect.amount} Block`;
      case "heal":
        return `Restore ${effect.amount} Integrity`;
      case "draw":
        return `Draw ${effect.amount}`;
      case "weaken":
        return `Reduce next raider hit by ${effect.amount}`;
      case "repair":
        return `Repair ${effect.amount}`;
    }
  });

  return `${formatList(lines)}.`;
}

export function instantiateRaidCombatCard<TMeta extends object>(
  definition: CardDefinition<"raid", TMeta>,
  context: PlayerCombatContext,
  options: {
    templateId?: string;
    instanceId?: string;
    sourceTitle?: string;
    sourceType?: "structure" | "unlock" | "reward";
    sourcePool?: RaidCombatCard["sourcePool"];
    sourceLayerId?: RaidLayerId | null;
    originCellId?: string | null;
    drawWeight?: number;
    sourceCount?: number;
    noteLine?: string;
  } = {}
): RaidCombatCard {
  const raidMeta = (definition.meta ?? {}) as Partial<{
    sourceKind: RaidCombatCard["sourceType"];
    sourcePool: RaidCombatCard["sourcePool"];
  }>;
  const effects = definition.effects
    .map((effect) => toRaidCombatEffect(effect, context))
    .filter((effect): effect is RaidCombatCardEffect => effect !== null);
  const primaryIdeology = getPrimaryIdeology(definition.ideologies);
  const noteLines = [
    options.noteLine,
    definition.summary
  ].filter((line): line is string => Boolean(line));

  return {
    id: options.instanceId ?? definition.id,
    templateId: options.templateId ?? definition.id,
    title: definition.title,
    summary: formatRaidCombatEffectSummary(effects),
    cost: definition.cost.amount,
    drawWeight: options.drawWeight ?? definition.weighted?.baseWeight ?? 1,
    sourceCount: options.sourceCount ?? definition.weighted?.sourceCount ?? 1,
    category: definition.category as RaidCombatCard["category"],
    ideology: primaryIdeology,
    ideologies: definition.ideologies as RaidCardIdeology[],
    sourceType: options.sourceType ?? raidMeta.sourceKind ?? "unlock",
    sourceTitle: options.sourceTitle ?? definition.source.title,
    sourceLayerId: options.sourceLayerId ?? null,
    originCellId: options.originCellId ?? null,
    sourcePool: options.sourcePool ?? raidMeta.sourcePool ?? "support",
    effects,
    noteLines
  };
}

export function instantiateEnemyRaidCard<TMeta extends object>(
  definition: CardDefinition<"enemy-raid", TMeta>
): RaidEnemyCard {
  const enemyMeta = (definition.meta ?? {}) as Partial<{
    archetype: RaidEnemyCard["archetype"];
  }>;

  return {
    id: definition.id,
    title: definition.title,
    summary: definition.summary,
    category: definition.category as RaidEnemyCard["category"],
    archetype: enemyMeta.archetype ?? "scrap",
    effects: definition.effects
      .map((effect) => toEnemyEffect(effect))
      .filter((effect): effect is RaidEnemyCardEffect => effect !== null)
  };
}

export function createRewardCombatCardFromIdeology(
  ideology: RaidCardIdeology,
  sequence: number
): RaidCombatCard {
  const definition = getRewardRaidCardDefinition(ideology);
  const emptyContext: PlayerCombatContext = {
    patternTierValues: {
      scrap: 0,
      tech: 0,
      magic: 0
    },
    availableStructureIds: new Set<string>(),
    hasWatchtower: false,
    hasWorkshop: false,
    hasMusterHall: false
  };

  return instantiateRaidCombatCard(definition, emptyContext, {
    templateId: `${definition.id}-${sequence}`,
    instanceId: `${definition.id}-${sequence}`,
    sourceType: "reward",
    sourceTitle: "Raid Reward",
    sourcePool: "reward"
  });
}
