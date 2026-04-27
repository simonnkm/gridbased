import { getEnemyRaidCardDefinition } from "../../data/cards/cardRegistry";
import { raidCards } from "../../data/raids";
import { buildAvailableRaidPool as buildAvailableRaidPoolFromRegistry } from "../cards/buildAvailableRaidPool";
import { scoreCombatCardForDeck as scoreCombatCardForDeckFromRegistry } from "../cards/cardSelectors";
import {
  createRewardCombatCardFromIdeology as createRewardCombatCardFromRegistry,
  instantiateEnemyRaidCard
} from "../cards/effectResolver";
import { buildConcreteRaidDeck as buildConcreteRaidDeckFromPreRaid } from "../preRaid/poolBuilder";
import {
  buildPlayerCombatContext as buildPlayerCombatContextFromSetup,
  buildRaidLayerStates as buildRaidLayerStatesFromSetup,
  buildRaidPatternSummaries as buildRaidPatternSummariesFromSetup,
  buildRaidStructureSummaries as buildRaidStructureSummariesFromSetup,
  getRaidPatternTierValues as getRaidPatternTierValuesFromSetup,
  RAID_LAYER_LABELS,
  RAID_LAYER_ORDER
} from "../combat/combatSetup";
import { getCivilUnrestDamage } from "../combat/civilUnrest";
import { propagateRaidAftermath } from "../combat/damagePropagation";
import { getUpcomingRaidCard } from "../selectors";
import { shuffle } from "../rules/deck";
import type { BoardCell, GameState } from "../state/types";
import type {
  RaidBoardUpdate,
  RaidCardIdeology,
  RaidCombatCard,
  RaidEnemyCard,
  RaidLayerId,
  RaidLayerState,
  RaidLayerStructureState,
  RaidOutcome,
  RaidPatternSummary,
  RaidPreviewBreakdown,
  RaidState,
  RaidStructureSummary
} from "./types";

const COLLAPSE_HITS: Record<RaidLayerId, number> = {
  outer: 2,
  mid: 2,
  inner: 1
};
const FIRST_RAID_TURN = 8;
const LATER_RAID_INTERVAL_MIN = 6;
const LATER_RAID_INTERVAL_MAX = 9;
const OPENING_PLAYER_HAND_SIZE = 5;
const DEFAULT_PLAYER_HAND_LIMIT = 6;
const DEFAULT_ENERGY_PER_TURN = 3;

interface EnemyChoiceContext {
  turnNumber: number;
  settlementIntegrity: number;
  maxSettlementIntegrity: number;
  settlementBlock: number;
  raidStrength: number;
  maxRaidStrength: number;
  enemyWeaken: number;
}

interface RaidScalingProfile {
  raidNumber: number;
  occupiedStructureCount: number;
  stackBonus: number;
  raidStrength: number;
  startingGuard: number;
  enemyHandSize: number;
  pressureCopies: number;
  damageBonus: number;
  guardBonus: number;
  shredBonus: number;
  drainBonus: number;
  healBonus: number;
}

function getRandomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function formatEnemyCardEffectSummary(card: RaidEnemyCard): string {
  const parts = card.effects.map((effect) => {
    switch (effect.type) {
      case "damage":
        return `Attack ${effect.amount}`;
      case "guard":
        return `Guard ${effect.amount}`;
      case "heal":
        return `Heal ${effect.amount}`;
      case "shred-block":
        return `Shred ${effect.amount} Block`;
      case "drain-integrity":
        return `Direct ${effect.amount}`;
    }
  });

  return parts.join(" | ");
}

export function createInitialRaidForecast(): {
  nextRaidTurn: number;
  nextRaidWindowStart: number;
  nextRaidWindowEnd: number;
} {
  return {
    nextRaidTurn: FIRST_RAID_TURN,
    nextRaidWindowStart: FIRST_RAID_TURN,
    nextRaidWindowEnd: FIRST_RAID_TURN
  };
}

export function rollNextRaidForecastAfter(turn: number): {
  nextRaidTurn: number;
  nextRaidWindowStart: number;
  nextRaidWindowEnd: number;
} {
  return {
    nextRaidTurn: turn + LATER_RAID_INTERVAL_MAX,
    nextRaidWindowStart: turn + LATER_RAID_INTERVAL_MIN,
    nextRaidWindowEnd: turn + LATER_RAID_INTERVAL_MAX
  };
}

export function resolveRaidForecastForTurn(
  turn: number,
  nextRaidTurn: number,
  nextRaidWindowStart: number,
  nextRaidWindowEnd: number
): {
  nextRaidTurn: number;
  nextRaidWindowStart: number;
  nextRaidWindowEnd: number;
} {
  if (nextRaidWindowStart >= nextRaidWindowEnd) {
    return {
      nextRaidTurn,
      nextRaidWindowStart,
      nextRaidWindowEnd
    };
  }

  if (turn < nextRaidWindowStart) {
    return {
      nextRaidTurn,
      nextRaidWindowStart,
      nextRaidWindowEnd
    };
  }

  const lockedTurn = getRandomInt(
    Math.max(turn, nextRaidWindowStart),
    nextRaidWindowEnd
  );

  return {
    nextRaidTurn: lockedTurn,
    nextRaidWindowStart: lockedTurn,
    nextRaidWindowEnd: lockedTurn
  };
}

export function isRaidTurn(turn: number, nextRaidTurn: number): boolean {
  return turn >= nextRaidTurn;
}

export function getNextRaidTurnAfter(turn: number): number {
  return rollNextRaidForecastAfter(turn).nextRaidTurn;
}

function createEmptyPreview(): RaidPreviewBreakdown {
  return {
    projectedAttack: 0,
    projectedBlock: 0,
    projectedHeal: 0,
    projectedDraw: 0,
    projectedWeaken: 0,
    projectedSettlementIntegrity: 0,
    projectedRaidStrength: 0,
    selectedCardLines: [],
    enemyChoiceTitle: null,
    enemyChoiceSummary: ""
  };
}

function cloneLayers(layers: RaidLayerState[]): RaidLayerState[] {
  return layers.map((layer) => ({
    ...layer,
    structures: layer.structures.map((structure) => ({ ...structure }))
  }));
}

function buildLayerStates(state: GameState): RaidLayerState[] {
  return buildRaidLayerStatesFromSetup(state);
}

function buildPatternSummaries(state: GameState): RaidPatternSummary[] {
  return buildRaidPatternSummariesFromSetup(state);
}

function buildStructureSummaries(layers: RaidLayerState[]): RaidStructureSummary[] {
  return buildRaidStructureSummariesFromSetup(layers);
}

function getPatternTierValues(activePatterns: RaidPatternSummary[]) {
  return getRaidPatternTierValuesFromSetup(activePatterns);
}

function buildPlayerCombatContext(
  layers: RaidLayerState[],
  activePatterns: RaidPatternSummary[]
): ReturnType<typeof buildPlayerCombatContextFromSetup> {
  return buildPlayerCombatContextFromSetup(layers, activePatterns);
}

export function scoreCombatCardForDeck(card: RaidCombatCard): number {
  return scoreCombatCardForDeckFromRegistry(card);
}

export function createRewardCombatCardFromIdeology(
  ideology: RaidCardIdeology,
  sequence: number
): RaidCombatCard {
  return createRewardCombatCardFromRegistry(ideology, sequence);
}

export function buildCombatCardPool(
  state: GameState,
  layersArg?: RaidLayerState[],
  activePatternsArg?: RaidPatternSummary[]
): RaidCombatCard[] {
  return buildAvailableRaidPoolFromRegistry(state, layersArg, activePatternsArg);
}

export function instantiateCombatDeck(
  templates: RaidCombatCard[],
  activeTemplateIds: string[],
  focusedTemplateIds: string[]
): RaidCombatCard[] {
  return buildConcreteRaidDeckFromPreRaid(
    templates,
    activeTemplateIds,
    focusedTemplateIds
  );
}

function drawCards<T>(
  drawPile: T[],
  discardPile: T[],
  count: number
): {
  drawnCards: T[];
  nextDrawPile: T[];
  nextDiscardPile: T[];
} {
  let nextDrawPile = [...drawPile];
  let nextDiscardPile = [...discardPile];
  const drawnCards: T[] = [];

  while (drawnCards.length < count) {
    if (nextDrawPile.length === 0) {
      if (nextDiscardPile.length === 0) {
        break;
      }

      nextDrawPile = shuffle(nextDiscardPile);
      nextDiscardPile = [];
    }

    const card = nextDrawPile.shift();

    if (!card) {
      break;
    }

    drawnCards.push(card);
  }

  return {
    drawnCards,
    nextDrawPile,
    nextDiscardPile
  };
}

function drawUpToHandSize<T>(
  hand: T[],
  drawPile: T[],
  discardPile: T[],
  handSize: number
): {
  hand: T[];
  drawPile: T[];
  discardPile: T[];
} {
  const cardsNeeded = Math.max(0, handSize - hand.length);
  const { drawnCards, nextDrawPile, nextDiscardPile } = drawCards(
    drawPile,
    discardPile,
    cardsNeeded
  );

  return {
    hand: [...hand, ...drawnCards],
    drawPile: nextDrawPile,
    discardPile: nextDiscardPile
  };
}

function getDestroyedCellIds(layers: RaidLayerState[]): Set<string> {
  return new Set(
    layers.flatMap((layer) =>
      layer.structures
        .filter((structure) => structure.status === "destroyed")
        .map((structure) => structure.cellId)
    )
  );
}

function pruneDestroyedPlayerCards(raid: RaidState): RaidState {
  const destroyedCellIds = getDestroyedCellIds(raid.layers);

  if (destroyedCellIds.size === 0) {
    return raid;
  }

  const keepCard = (card: RaidCombatCard) =>
    !card.originCellId || !destroyedCellIds.has(card.originCellId);

  return {
    ...raid,
    playerDrawPile: raid.playerDrawPile.filter(keepCard),
    playerDiscardPile: raid.playerDiscardPile.filter(keepCard),
    playerHand: raid.playerHand.filter(keepCard),
    selectedPlayerCardIds: raid.selectedPlayerCardIds.filter((cardId) =>
      raid.playerHand.some((card) => card.id === cardId && keepCard(card))
    )
  };
}

function buildRaidBoardUpdates(
  baseBoard: BoardCell[],
  raid: RaidState
) {
  return propagateRaidAftermath(
    baseBoard,
    raid.layers,
    raid.maxSettlementIntegrity - raid.settlementIntegrity,
    raid.settlementIntegrity,
    raid.maxSettlementIntegrity,
    raid.layers.filter((layer) => layer.compromised).map((layer) => layer.id)
  );
}

function getMaxSettlementIntegrity(state: GameState): number {
  const occupiedStructureCount = state.board.filter(
    (cell) => cell.terrain !== "core" && cell.structureId !== null
  ).length;
  const stackBonus = state.board.reduce((total, cell) => {
    if (cell.terrain === "core" || cell.structureId === null) {
      return total;
    }

    return total + Math.max(0, cell.stackLevel - 1);
  }, 0);
  const coreBonus = 2;

  return 10 + occupiedStructureCount + stackBonus + coreBonus;
}

function getPlayerHandSize(activePatterns: RaidPatternSummary[]): number {
  const techTier =
    activePatterns.find((pattern) => pattern.ideology === "tech")?.tier ?? "none";

  return DEFAULT_PLAYER_HAND_LIMIT + (techTier === "large" ? 1 : 0);
}

function getSelectedCards(raid: RaidState): RaidCombatCard[] {
  return raid.playerHand.filter((card) => raid.selectedPlayerCardIds.includes(card.id));
}

function getSelectedCost(raid: RaidState): number {
  return getSelectedCards(raid).reduce((total, card) => total + card.cost, 0);
}

function getPlayerRemainingEnergy(raid: RaidState): number {
  return Math.max(0, raid.maxEnergyPerTurn - raid.energySpentThisTurn);
}

function getEnemyCardTotals(card: RaidEnemyCard): {
  damage: number;
  guard: number;
  heal: number;
  shredBlock: number;
  drainIntegrity: number;
} {
  return card.effects.reduce(
    (totals, effect) => {
      switch (effect.type) {
        case "damage":
          totals.damage += effect.amount;
          break;
        case "guard":
          totals.guard += effect.amount;
          break;
        case "heal":
          totals.heal += effect.amount;
          break;
        case "shred-block":
          totals.shredBlock += effect.amount;
          break;
        case "drain-integrity":
          totals.drainIntegrity += effect.amount;
          break;
      }

      return totals;
    },
    {
      damage: 0,
      guard: 0,
      heal: 0,
      shredBlock: 0,
      drainIntegrity: 0
    }
  );
}

function scoreEnemyPressureCard(card: RaidEnemyCard): number {
  const totals = getEnemyCardTotals(card);
  let score =
    totals.damage * 1.2 +
    totals.guard * 0.8 +
    totals.heal * 0.45 +
    totals.shredBlock * 1.1 +
    totals.drainIntegrity * 1.5;

  if (card.category === "attack") {
    score += 0.55;
  }

  if (card.category === "special") {
    score += 0.75;
  }

  return score;
}

function buildRaidScalingProfile(
  state: GameState,
  _raidDefinition: (typeof raidCards)[number],
  layers: RaidLayerState[]
): RaidScalingProfile {
  const occupiedStructureCount = layers.reduce(
    (total, layer) =>
      total +
      layer.structures.filter((structure) => structure.status !== "destroyed").length,
    0
  );
  const stackBonus = state.board.reduce((total, cell) => {
    if (cell.terrain === "core" || cell.structureId === null) {
      return total;
    }

    return total + Math.max(0, cell.stackLevel - 1);
  }, 0);
  const raidNumber = state.raidsSurvived + 1;
  const raidStrength = 14 + raidNumber * 5 + Math.floor(occupiedStructureCount / 2);
  const raidTierPressure = Math.max(0, raidNumber - 1);
  const growthPressure = Math.floor(occupiedStructureCount / 8);
  const sharedPressure = raidTierPressure + growthPressure;
  const startingGuard = Math.min(14, 1 + Math.floor(sharedPressure / 2));
  const enemyHandSize = Math.min(6, 3 + (raidNumber >= 2 ? 1 : 0) + (occupiedStructureCount >= 18 ? 1 : 0));
  const pressureCopies = Math.min(
    7,
    2 + Math.floor((sharedPressure + Math.max(0, raidNumber - 2)) / 2)
  );
  const damageBonus = raidTierPressure + Math.floor(occupiedStructureCount / 14);
  const guardBonus = Math.floor(sharedPressure / 2);
  const shredBonus = raidNumber >= 2 ? 1 : 0;
  const drainBonus = raidNumber >= 3 ? 1 : 0;
  const healBonus = raidNumber >= 3 ? 1 : 0;

  return {
    raidNumber,
    occupiedStructureCount,
    stackBonus,
    raidStrength,
    startingGuard,
    enemyHandSize,
    pressureCopies,
    damageBonus,
    guardBonus,
    shredBonus,
    drainBonus,
    healBonus
  };
}

function buildScaledEnemyDeck(
  raidDefinition: (typeof raidCards)[number],
  scaling: RaidScalingProfile
): RaidEnemyCard[] {
  const scaleEnemyCard = (card: RaidEnemyCard): RaidEnemyCard => {
    const scaledEffects = card.effects.map((effect) => {
      switch (effect.type) {
        case "damage": {
          const bonus =
            scaling.damageBonus +
            (card.category === "attack" || card.category === "special" ? 1 : 0);
          return {
            ...effect,
            amount: effect.amount + bonus
          };
        }
        case "guard":
          return {
            ...effect,
            amount: effect.amount + scaling.guardBonus
          };
        case "shred-block":
          return {
            ...effect,
            amount: effect.amount + scaling.shredBonus
          };
        case "drain-integrity":
          return {
            ...effect,
            amount: effect.amount + scaling.drainBonus
          };
        case "heal":
          return {
            ...effect,
            amount: effect.amount + scaling.healBonus
          };
      }
    });

    const scaledCard: RaidEnemyCard = {
      ...card,
      effects: scaledEffects
    };

    return {
      ...scaledCard,
      summary: formatEnemyCardEffectSummary(scaledCard)
    };
  };
  const baseDeck = raidDefinition.enemyDeckIds.map((cardId, index) => {
    const baseCard = instantiateEnemyRaidCard(getEnemyRaidCardDefinition(cardId));
    const scaledCard = scaleEnemyCard(baseCard);

    return {
      ...scaledCard,
      id: `${cardId}::base-${index}`
    };
  });

  if (baseDeck.length === 0) {
    return [];
  }

  const rankedTemplateIds = [...raidDefinition.enemyDeckIds].sort((leftId, rightId) => {
    const leftScore = scoreEnemyPressureCard(
      instantiateEnemyRaidCard(getEnemyRaidCardDefinition(leftId))
    );
    const rightScore = scoreEnemyPressureCard(
      instantiateEnemyRaidCard(getEnemyRaidCardDefinition(rightId))
    );

    return rightScore - leftScore;
  });
  const extraCards: RaidEnemyCard[] = [];

  for (let index = 0; index < scaling.pressureCopies; index += 1) {
    const templateId = rankedTemplateIds[index % rankedTemplateIds.length];
    const scaledCard = scaleEnemyCard(
      instantiateEnemyRaidCard(getEnemyRaidCardDefinition(templateId))
    );

    extraCards.push({
      ...scaledCard,
      id: `${templateId}::pressure-${index}`
    });
  }

  return shuffle([...baseDeck, ...extraCards]);
}

function chooseEnemyCard(
  hand: RaidEnemyCard[],
  context: EnemyChoiceContext,
  allowVariance: boolean
): RaidEnemyCard | null {
  if (hand.length === 0) {
    return null;
  }

  const scoredCards = hand.map((card) => {
    const totals = getEnemyCardTotals(card);
    let score =
      Math.max(0, totals.damage - context.enemyWeaken) * 2 +
      totals.guard +
      Math.min(context.settlementBlock, totals.shredBlock) * 1.5 +
      totals.drainIntegrity * 2.25;

    if (context.raidStrength <= context.maxRaidStrength * 0.45) {
      score += totals.heal * 2;
    } else {
      score += totals.heal * 0.5;
    }

    if (context.settlementIntegrity <= context.maxSettlementIntegrity * 0.35) {
      score += totals.damage;
    }

    if (context.settlementBlock >= 4) {
      score += totals.shredBlock;
    }

    if (context.turnNumber <= 2) {
      if (card.category === "support" || card.category === "block") {
        score += 0.9;
      }

      if (card.category === "attack") {
        score -= 0.25;
      }
    } else if (context.turnNumber >= 5) {
      if (card.category === "attack" || card.category === "special") {
        score += 0.85;
      }
    } else if (card.category === "special") {
      score += 0.35;
    }

    const tempoCycle = context.turnNumber % 3;

    if (tempoCycle === 1 && card.category === "attack") {
      score += 0.5;
    } else if (
      tempoCycle === 2 &&
      (card.category === "support" || card.category === "block")
    ) {
      score += 0.5;
    } else if (tempoCycle === 0 && card.category === "special") {
      score += 0.5;
    }

    switch (card.archetype) {
      case "scrap":
        score += totals.damage * 0.45 + totals.guard * 0.6;

        if (card.category === "block" && context.raidStrength <= context.maxRaidStrength * 0.55) {
          score += 1.5;
        }
        break;
      case "tech":
        score += totals.shredBlock * 0.9;

        if (card.category === "support" || card.category === "special") {
          score += 1.1;
        }
        break;
      case "cult":
        score += totals.heal * 0.7 + totals.drainIntegrity * 1.1;

        if (card.category === "special") {
          score += 1.2;
        }
        break;
    }

    if (allowVariance) {
      score += Math.random() * 0.75;
    }

    return {
      card,
      score
    };
  });

  const ranked = scoredCards.sort((left, right) => right.score - left.score);

  if (!allowVariance || ranked.length === 1) {
    return ranked[0]?.card ?? null;
  }

  const bestScore = ranked[0].score;
  const shortlist = ranked.filter(
    (entry, index) => index < 4 && entry.score >= bestScore - 3.4
  );

  if (shortlist.length > 1 && Math.random() < 0.12) {
    const alternateIndex = 1 + Math.floor(Math.random() * (shortlist.length - 1));
    return shortlist[alternateIndex].card;
  }

  const weighted = shortlist.map((entry, index) => ({
    card: entry.card,
    weight: Math.max(0.35, entry.score - (bestScore - 3.6)) * (index === 0 ? 1.05 : 1)
  }));
  const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of weighted) {
    roll -= entry.weight;

    if (roll <= 0) {
      return entry.card;
    }
  }

  return weighted[weighted.length - 1]?.card ?? ranked[0].card;
}

function applyPlayerAttack(
  raid: RaidState,
  amount: number,
  lines: string[],
  sourceTitle: string
): RaidState {
  let remainingAttack = amount;
  let nextRaid = raid;

  if (nextRaid.raidGuard > 0) {
    const guardSpent = Math.min(nextRaid.raidGuard, remainingAttack);
    nextRaid = {
      ...nextRaid,
      raidGuard: nextRaid.raidGuard - guardSpent
    };
    remainingAttack -= guardSpent;
    lines.push(`${sourceTitle} broke ${guardSpent} Raid Guard.`);
  }

  if (remainingAttack > 0) {
    nextRaid = {
      ...nextRaid,
      raidStrength: Math.max(0, nextRaid.raidStrength - remainingAttack)
    };
    lines.push(`${sourceTitle} dealt ${remainingAttack} damage to Raid Strength.`);
  }

  return nextRaid;
}

function getRepairTargets(layers: RaidLayerState[]): RaidLayerStructureState[] {
  const order: RaidLayerId[] = ["inner", "mid", "outer"];

  return order.flatMap((layerId) => {
    const layer = layers.find((entry) => entry.id === layerId);

    if (!layer) {
      return [];
    }

    return layer.structures
      .filter((structure) => structure.status === "damaged" && structure.condition > 0)
      .sort(
        (left, right) =>
          left.condition - right.condition ||
          left.raidDefense - right.raidDefense ||
          left.row - right.row ||
          left.col - right.col
      );
  });
}

function applyRepair(
  raid: RaidState,
  amount: number,
  lines: string[],
  sourceTitle: string
): RaidState {
  const nextRaid = {
    ...raid,
    layers: cloneLayers(raid.layers)
  };
  const targets = getRepairTargets(nextRaid.layers);
  let remaining = amount;

  for (const target of targets) {
    if (remaining <= 0) {
      break;
    }

    target.condition = Math.min(3, target.condition + 1);
    target.status = target.condition < 3 ? "damaged" : "healthy";
    lines.push(`${sourceTitle} repaired ${target.title}.`);
    remaining -= 1;
  }

  if (remaining > 0) {
    nextRaid.settlementIntegrity = Math.min(
      nextRaid.maxSettlementIntegrity,
      nextRaid.settlementIntegrity + remaining
    );
    lines.push(`${sourceTitle} found no more damage and restored ${remaining} Integrity.`);
  }

  return {
    ...nextRaid,
    builtStructures: buildStructureSummaries(nextRaid.layers)
  };
}

function buildRaidPreview(raid: RaidState): RaidPreviewBreakdown {
  const selectedCards = raid.playerHand.filter((card) =>
    raid.selectedPlayerCardIds.includes(card.id)
  );
  const lines = selectedCards.map((card) => `${card.title}: ${card.summary}`);
  let projectedAttack = 0;
  let projectedBlock = 0;
  let projectedHeal = 0;
  let projectedDraw = 0;
  let projectedWeaken = 0;
  let projectedRaidGuard = raid.raidGuard;
  let projectedRaidStrength = raid.raidStrength;
  let projectedSettlementIntegrity = raid.settlementIntegrity;

  for (const card of selectedCards) {
    for (const effect of card.effects) {
      switch (effect.type) {
        case "attack": {
          let remainingAttack = effect.amount;

          if (projectedRaidGuard > 0) {
            const guardSpent = Math.min(projectedRaidGuard, remainingAttack);
            projectedRaidGuard -= guardSpent;
            remainingAttack -= guardSpent;
          }

          if (remainingAttack > 0) {
            projectedAttack += remainingAttack;
            projectedRaidStrength = Math.max(0, projectedRaidStrength - remainingAttack);
          }
          break;
        }
        case "block":
          projectedBlock += effect.amount;
          break;
        case "heal":
          projectedHeal += effect.amount;
          projectedSettlementIntegrity = Math.min(
            raid.maxSettlementIntegrity,
            projectedSettlementIntegrity + effect.amount
          );
          break;
        case "draw":
          projectedDraw += effect.amount;
          break;
        case "weaken":
          projectedWeaken += effect.amount;
          break;
        case "repair":
          lines.push(`${card.title} may repair ${effect.amount} damaged structure${effect.amount === 1 ? "" : "s"}.`);
          break;
      }
    }
  }

  const predictedEnemy = chooseEnemyCard(raid.enemyHand, {
    turnNumber: raid.turnNumber,
    settlementIntegrity: projectedSettlementIntegrity,
    maxSettlementIntegrity: raid.maxSettlementIntegrity,
    settlementBlock: raid.settlementBlock + projectedBlock,
    raidStrength: projectedRaidStrength,
    maxRaidStrength: raid.maxRaidStrength,
    enemyWeaken: raid.enemyWeaken + projectedWeaken
  }, false);

  return {
    projectedAttack,
    projectedBlock,
    projectedHeal,
    projectedDraw,
    projectedWeaken,
    projectedSettlementIntegrity,
    projectedRaidStrength,
    selectedCardLines: lines,
    enemyChoiceTitle: predictedEnemy?.title ?? null,
    enemyChoiceSummary: predictedEnemy ? predictedEnemy.summary : "Raiders have no tactic ready."
  };
}

function buildOutcome(
  state: GameState,
  raid: RaidState
): RaidOutcome {
  const raidDefinition = raidCards.find((entry) => entry.id === raid.incomingRaidId);

  if (!raidDefinition) {
    throw new Error(`Unknown raid definition: ${raid.incomingRaidId}`);
  }

  const propagation = buildRaidBoardUpdates(state.board, raid);
  const boardUpdates = propagation.updates;
  const destroyedCount = propagation.destroyedCount;
  const damagedCount = propagation.damagedCount;
  const rewardBonus = {
    materials: raid.activePatterns.some((pattern) => pattern.ideology === "scrap") ? 1 : 0,
    progress: raid.activePatterns.some((pattern) => pattern.ideology === "tech") ? 1 : 0,
    intel: raid.activePatterns.some((pattern) => pattern.ideology === "tech") ? 1 : 0,
    core: raid.activePatterns.some((pattern) => pattern.ideology === "magic") ? 1 : 0
  };
  const survived = raid.raidStrength <= 0 && raid.settlementIntegrity > 0;
  const rewards = survived
    ? {
        materials: raidDefinition.survivalReward.materials + rewardBonus.materials,
        progress: raidDefinition.survivalReward.progress + rewardBonus.progress,
        intel: raidDefinition.survivalReward.intel + rewardBonus.intel,
        core: raidDefinition.survivalReward.core + rewardBonus.core
      }
    : {
        materials: 0,
        progress: 0,
        intel: 0,
        core: 0
      };
  const compromisedLabels = raid.layers
    .filter((layer) => layer.compromised)
    .map((layer) => layer.label.toLowerCase());
  const compromiseText =
    compromisedLabels.length > 0 ? compromisedLabels.join(", ") : "no collapse bands";

  return {
    survived,
    roundsResolved: raid.turnNumber,
    settlementIntegrityLoss: raid.maxSettlementIntegrity - raid.settlementIntegrity,
    damagedCount,
    destroyedCount,
    compromisedLayerIds: raid.layers
      .filter((layer) => layer.compromised)
      .map((layer) => layer.id),
    boardUpdates,
    rewards,
    reasonLines: survived
      ? [
          `${raid.incomingRaidTitle} was beaten in ${raid.turnNumber} rounds.`,
          `Settlement Integrity held at ${raid.settlementIntegrity}/${raid.maxSettlementIntegrity}; compromised bands: ${compromiseText}.`,
          ...propagation.summaryLines,
          `Board losses: ${destroyedCount} destroyed, ${damagedCount} damaged. Reward: +${rewards.materials} Materials, +${rewards.progress} Progress, +${rewards.intel} Intel, +${rewards.core} Core.`
        ]
      : [
          `${raid.incomingRaidTitle} overwhelmed the settlement in ${raid.turnNumber} rounds.`,
          `Settlement Integrity collapsed after losing ${raid.maxSettlementIntegrity - raid.settlementIntegrity}. Compromised bands: ${compromiseText}.`,
          ...propagation.summaryLines,
          `Board losses: ${destroyedCount} destroyed, ${damagedCount} damaged.`
        ]
  };
}

function getCollapseTargets(layer: RaidLayerState): RaidLayerStructureState[] {
  return [...layer.structures].sort(
    (left, right) =>
      left.condition - right.condition ||
      left.raidDefense - right.raidDefense ||
      left.row - right.row ||
      left.col - right.col
  );
}

function applyLayerCollapse(
  layer: RaidLayerState,
  lines: string[]
): void {
  const targets = getCollapseTargets(layer);
  let hitsRemaining = COLLAPSE_HITS[layer.id];
  let destroyedCount = 0;
  let damagedCount = 0;

  if (targets.length === 0) {
    lines.push(`${layer.id[0].toUpperCase()}${layer.id.slice(1)} band collapsed.`);
    lines.push(`No ${layer.id} structures remained to absorb the collapse.`);
    return;
  }

  lines.push(`${layer.id[0].toUpperCase()}${layer.id.slice(1)} band collapsed.`);

  while (hitsRemaining > 0) {
    const target = targets.find((structure) => structure.condition > 0);

    if (!target) {
      break;
    }

    const previousCondition = target.condition;
    target.condition = Math.max(0, target.condition - 1);
    target.status =
      target.condition <= 0 ? "destroyed" : target.condition < 3 ? "damaged" : "healthy";

    if (target.condition <= 0) {
      destroyedCount += 1;
    } else if (target.condition < previousCondition) {
      damagedCount += 1;
    }

    hitsRemaining -= 1;
  }

  if (destroyedCount > 0) {
    lines.push(`${destroyedCount} ${layer.id} structure${destroyedCount === 1 ? " was" : "s were"} destroyed.`);
  }

  if (damagedCount > 0) {
    lines.push(`${damagedCount} ${layer.id} structure${damagedCount === 1 ? " was" : "s were"} damaged.`);
  }
}

function applyThresholdCollapses(
  raid: RaidState,
  beforeIntegrity: number,
  lines: string[]
): RaidState {
  let nextRaid = {
    ...raid,
    layers: cloneLayers(raid.layers)
  };

  for (const layerId of RAID_LAYER_ORDER) {
    const layer = nextRaid.layers.find((entry) => entry.id === layerId);

    if (!layer || layer.compromised) {
      continue;
    }

    const thresholdValue = Math.floor(nextRaid.maxSettlementIntegrity * layer.collapseThresholdRatio);
    const crossed = beforeIntegrity > thresholdValue && nextRaid.settlementIntegrity <= thresholdValue;

    if (!crossed) {
      continue;
    }

    layer.compromised = true;
    applyLayerCollapse(layer, lines);
  }

  nextRaid = pruneDestroyedPlayerCards(nextRaid);

  return {
    ...nextRaid,
    builtStructures: buildStructureSummaries(nextRaid.layers)
  };
}

function resolvePlayerCardPlay(raid: RaidState): {
  raid: RaidState;
  lines: string[];
} {
  const selectedCards = getSelectedCards(raid);
  const selectedCost = selectedCards.reduce((total, card) => total + card.cost, 0);
  let nextRaid = {
    ...raid,
    playerHand: raid.playerHand.filter((card) => !raid.selectedPlayerCardIds.includes(card.id)),
    playerDiscardPile: [
      ...raid.playerDiscardPile,
      ...selectedCards
    ]
  };
  const lines: string[] = [];
  let pendingDraw = 0;

  for (const card of selectedCards) {
    for (const effect of card.effects) {
      switch (effect.type) {
        case "attack":
          nextRaid = applyPlayerAttack(nextRaid, effect.amount, lines, card.title);
          break;
        case "block":
          nextRaid = {
            ...nextRaid,
            settlementBlock: nextRaid.settlementBlock + effect.amount
          };
          lines.push(`${card.title} added ${effect.amount} Block.`);
          break;
        case "heal":
          nextRaid = {
            ...nextRaid,
            settlementIntegrity: Math.min(
              nextRaid.maxSettlementIntegrity,
              nextRaid.settlementIntegrity + effect.amount
            )
          };
          lines.push(`${card.title} restored ${effect.amount} Integrity.`);
          break;
        case "draw":
          pendingDraw += effect.amount;
          lines.push(`${card.title} will draw ${effect.amount}.`);
          break;
        case "weaken":
          nextRaid = {
            ...nextRaid,
            enemyWeaken: nextRaid.enemyWeaken + effect.amount
          };
          lines.push(`${card.title} reduced the next raider hit by ${effect.amount}.`);
          break;
        case "repair":
          nextRaid = applyRepair(nextRaid, effect.amount, lines, card.title);
          break;
      }
    }
  }

  if (pendingDraw > 0) {
    const drawResult = drawCards(
      nextRaid.playerDrawPile,
      nextRaid.playerDiscardPile,
      pendingDraw
    );
    nextRaid = {
      ...nextRaid,
      playerHand: [...nextRaid.playerHand, ...drawResult.drawnCards],
      playerDrawPile: drawResult.nextDrawPile,
      playerDiscardPile: drawResult.nextDiscardPile
    };
  }

  return {
    raid: {
      ...nextRaid,
      selectedPlayerCardIds: [],
      energySpentThisTurn: nextRaid.energySpentThisTurn + selectedCost
    },
    lines
  };
}

export function createRaidState(state: GameState): RaidState {
  const raidDefinition = getUpcomingRaidCard(state);
  const layers = buildLayerStates(state);
  const activePatterns = buildPatternSummaries(state);
  const builtStructures = buildStructureSummaries(layers);
  const scaling = buildRaidScalingProfile(state, raidDefinition, layers);
  const maxSettlementIntegrity = getMaxSettlementIntegrity(state);
  const availablePool =
    state.combatCardPool.length > 0
      ? state.combatCardPool
      : buildCombatCardPool(state, layers, activePatterns);
  const availableTemplateIdSet = new Set(availablePool.map((card) => card.templateId));
  const fallbackActiveTemplateIds = availablePool
    .slice(0, state.activeCombatDeckMaxSize)
    .map((card) => card.templateId);
  const activeFromState = state.activeCombatDeckTemplateIds.filter((templateId) =>
    availableTemplateIdSet.has(templateId)
  );
  const selectedActiveTemplateIds =
    activeFromState.length > 0 ? activeFromState : fallbackActiveTemplateIds;
  const activeDeckTemplates = availablePool.filter((card) =>
    selectedActiveTemplateIds.includes(card.templateId)
  );
  const selectedFocusedTemplateIds = state.focusedCombatCardTemplateIds.filter((templateId) =>
    selectedActiveTemplateIds.includes(templateId)
  );
  const playerDeck = instantiateCombatDeck(
    activeDeckTemplates.length > 0 ? activeDeckTemplates : availablePool,
    selectedActiveTemplateIds,
    selectedFocusedTemplateIds
  );
  const playerHandSize = getPlayerHandSize(activePatterns);
  const playerDraw = drawCards(
    playerDeck,
    [],
    Math.min(OPENING_PLAYER_HAND_SIZE, playerHandSize)
  );
  const scaledRaidStrength = scaling.raidStrength;
  const enemyDeck = buildScaledEnemyDeck(raidDefinition, scaling);
  const enemyDraw = drawCards(enemyDeck, [], scaling.enemyHandSize);
  let raidState: RaidState = {
    turn: state.turn,
    incomingRaidId: raidDefinition.id,
    incomingRaidTitle: raidDefinition.title,
    incomingRaidSummary: raidDefinition.summary,
    enemyArchetype: raidDefinition.enemyArchetype,
    enemyArchetypeTitle: raidDefinition.enemyArchetypeTitle,
    enemyArchetypeSummary: raidDefinition.enemyArchetypeSummary,
    activePatterns,
    builtStructures,
    layers,
    settlementIntegrity: maxSettlementIntegrity,
    maxSettlementIntegrity,
    settlementBlock: 0,
    enemyWeaken: 0,
    raidStrength: scaledRaidStrength,
    maxRaidStrength: scaledRaidStrength,
    raidGuard: scaling.startingGuard,
    playerDrawPile: playerDraw.nextDrawPile,
    playerDiscardPile: playerDraw.nextDiscardPile,
    playerHand: playerDraw.drawnCards,
    selectedPlayerCardIds: [],
    playerHandSize,
    maxEnergyPerTurn: DEFAULT_ENERGY_PER_TURN,
    energySpentThisTurn: 0,
    enemyDrawPile: enemyDraw.nextDrawPile,
    enemyDiscardPile: enemyDraw.nextDiscardPile,
    enemyHand: enemyDraw.drawnCards,
    enemyHandSize: scaling.enemyHandSize,
    turnNumber: 1,
    preview: createEmptyPreview(),
    combatLog: [
      `Raid ${scaling.raidNumber} pressure: ${scaledRaidStrength} Strength, ${scaling.startingGuard} starting Guard, ${scaling.enemyHandSize} enemy hand size. ${scaling.occupiedStructureCount} occupied structures and +${scaling.stackBonus} stack bonus raised threat.`
    ],
    outcome: null
  };

  raidState = {
    ...raidState,
    preview: buildRaidPreview(raidState)
  };

  return raidState;
}

export function toggleRaidCardSelection(raid: RaidState, cardId: string): RaidState {
  if (raid.outcome) {
    return raid;
  }

  const targetCard = raid.playerHand.find((card) => card.id === cardId);
  const inHand = Boolean(targetCard);

  if (!inHand) {
    return raid;
  }

  const isSelected = raid.selectedPlayerCardIds.includes(cardId);

  if (!isSelected) {
    const remainingBudget = getPlayerRemainingEnergy(raid) - getSelectedCost(raid);

    if ((targetCard?.cost ?? 0) > remainingBudget) {
      return raid;
    }
  }

  const trimmedSelection = isSelected
    ? raid.selectedPlayerCardIds.filter((entry) => entry !== cardId)
    : [...raid.selectedPlayerCardIds, cardId];
  const nextRaid = {
    ...raid,
    selectedPlayerCardIds: trimmedSelection
  };

  return {
    ...nextRaid,
    preview: buildRaidPreview(nextRaid)
  };
}

export function playSelectedRaidCards(state: GameState): RaidState {
  const raid = state.raid;

  if (!raid || raid.outcome) {
    throw new Error("Expected an active raid without an outcome.");
  }

  if (raid.selectedPlayerCardIds.length === 0) {
    return raid;
  }

  const selectedCards = getSelectedCards(raid);
  const selectedCost = selectedCards.reduce((total, card) => total + card.cost, 0);

  if (selectedCost > getPlayerRemainingEnergy(raid)) {
    return raid;
  }

  const { raid: nextRaid, lines } = resolvePlayerCardPlay(raid);
  const nextWithSummaries = {
    ...nextRaid,
    builtStructures: buildStructureSummaries(nextRaid.layers),
    combatLog: [...nextRaid.combatLog, ...lines]
  };

  if (nextWithSummaries.raidStrength <= 0) {
    return {
      ...nextWithSummaries,
      preview: createEmptyPreview(),
      outcome: buildOutcome(state, nextWithSummaries)
    };
  }

  return {
    ...nextWithSummaries,
    preview: buildRaidPreview(nextWithSummaries)
  };
}

export function drawRaidCardAction(raid: RaidState): RaidState {
  if (raid.outcome || getPlayerRemainingEnergy(raid) <= 0) {
    return raid;
  }

  const drawResult = drawCards(raid.playerDrawPile, raid.playerDiscardPile, 1);

  if (drawResult.drawnCards.length === 0) {
    return raid;
  }

  const nextRaid = {
    ...raid,
    playerHand: [...raid.playerHand, ...drawResult.drawnCards],
    playerDrawPile: drawResult.nextDrawPile,
    playerDiscardPile: drawResult.nextDiscardPile,
    energySpentThisTurn: raid.energySpentThisTurn + 1,
    selectedPlayerCardIds: [],
    combatLog: [
      ...raid.combatLog,
      `Drew ${drawResult.drawnCards[0].title} for 1 energy.`
    ]
  };

  return {
    ...nextRaid,
    preview: buildRaidPreview(nextRaid)
  };
}

function applyCivilUnrest(raid: RaidState, lines: string[]): RaidState {
  const surplus = Math.max(0, raid.playerHand.length - raid.playerHandSize);

  if (surplus <= 0) {
    return raid;
  }

  const directDamage = getCivilUnrestDamage(surplus);
  const shuffledHand = shuffle([...raid.playerHand]);
  const discardedCards = shuffledHand.slice(0, surplus);
  const keptCards = shuffledHand.slice(surplus);

  lines.push(`Civil Unrest dealt ${directDamage} direct damage to Settlement Integrity.`);
  lines.push(`Civil Unrest discarded ${discardedCards.length} random card${discardedCards.length === 1 ? "" : "s"}: ${discardedCards.map((card) => card.title).join(", ")}.`);

  return {
    ...raid,
    settlementIntegrity: Math.max(0, raid.settlementIntegrity - directDamage),
    playerHand: keptCards,
    playerDiscardPile: [...raid.playerDiscardPile, ...discardedCards],
    selectedPlayerCardIds: raid.selectedPlayerCardIds.filter((cardId) =>
      keptCards.some((card) => card.id === cardId)
    )
  };
}

export function resolveRaidEnemyTurn(state: GameState): RaidState {
  const raid = state.raid;

  if (!raid || raid.outcome) {
    throw new Error("Expected an active raid without an outcome.");
  }

  let nextRaid = {
    ...raid
  };
  const lines: string[] = [];
  const beforeUnrestIntegrity = nextRaid.settlementIntegrity;

  nextRaid = applyCivilUnrest(nextRaid, lines);
  nextRaid = applyThresholdCollapses(nextRaid, beforeUnrestIntegrity, lines);

  if (nextRaid.settlementIntegrity <= 0) {
    const settledRaid = {
      ...nextRaid,
      combatLog: [...nextRaid.combatLog, ...lines],
      preview: createEmptyPreview()
    };

    return {
      ...settledRaid,
      outcome: buildOutcome(state, settledRaid)
    };
  }
  let enemyHand = nextRaid.enemyHand;

  if (enemyHand.length === 0) {
    const drawResult = drawUpToHandSize(
      [],
      nextRaid.enemyDrawPile,
      nextRaid.enemyDiscardPile,
      nextRaid.enemyHandSize
    );
    nextRaid = {
      ...nextRaid,
      enemyHand: drawResult.hand,
      enemyDrawPile: drawResult.drawPile,
      enemyDiscardPile: drawResult.discardPile
    };
    enemyHand = nextRaid.enemyHand;
  }

  const chosenEnemyCard = chooseEnemyCard(enemyHand, {
    turnNumber: nextRaid.turnNumber,
    settlementIntegrity: nextRaid.settlementIntegrity,
    maxSettlementIntegrity: nextRaid.maxSettlementIntegrity,
    settlementBlock: nextRaid.settlementBlock,
    raidStrength: nextRaid.raidStrength,
    maxRaidStrength: nextRaid.maxRaidStrength,
    enemyWeaken: nextRaid.enemyWeaken
  }, true);

  if (!chosenEnemyCard) {
    const playerTurnDraw = drawCards(
      nextRaid.playerDrawPile,
      nextRaid.playerDiscardPile,
      1
    );
    const drawnCard = playerTurnDraw.drawnCards[0];

    if (drawnCard) {
      lines.push(`Turn ${nextRaid.turnNumber + 1}: drew ${drawnCard.title}.`);
    } else {
      lines.push(`Turn ${nextRaid.turnNumber + 1}: no card to draw.`);
    }

    const nextTurnRaid = {
      ...nextRaid,
      playerHand: [...nextRaid.playerHand, ...playerTurnDraw.drawnCards],
      playerDrawPile: playerTurnDraw.nextDrawPile,
      playerDiscardPile: playerTurnDraw.nextDiscardPile,
      combatLog: [...nextRaid.combatLog, ...lines],
      turnNumber: nextRaid.turnNumber + 1,
      energySpentThisTurn: 0
    };

    return {
      ...nextTurnRaid,
      preview: buildRaidPreview(nextTurnRaid)
    };
  }

  const totals = getEnemyCardTotals(chosenEnemyCard);
  const beforeIntegrity = nextRaid.settlementIntegrity;
  lines.push(
    `${nextRaid.enemyArchetypeTitle} played ${chosenEnemyCard.title} (${chosenEnemyCard.category}): ${chosenEnemyCard.summary}`
  );
  let remainingBlock = nextRaid.settlementBlock;

  if (totals.shredBlock > 0 && remainingBlock > 0) {
    const blockLost = Math.min(remainingBlock, totals.shredBlock);
    remainingBlock -= blockLost;
    lines.push(`${chosenEnemyCard.title} stripped ${blockLost} Block.`);
  }

  if (totals.guard > 0) {
    nextRaid = {
      ...nextRaid,
      raidGuard: nextRaid.raidGuard + totals.guard
    };
    lines.push(`Raiders gained ${totals.guard} Guard.`);
  }

  if (totals.heal > 0) {
    nextRaid = {
      ...nextRaid,
      raidStrength: Math.min(nextRaid.maxRaidStrength, nextRaid.raidStrength + totals.heal)
    };
    lines.push(`Raiders recovered ${totals.heal} Strength.`);
  }

  const reducedDamage = Math.max(0, totals.damage - nextRaid.enemyWeaken);

  if (nextRaid.enemyWeaken > 0) {
    lines.push(`Settlement control cut incoming damage by ${nextRaid.enemyWeaken}.`);
  }

  let remainingDamage = reducedDamage;
  let absorbedByBlock = 0;

  if (remainingBlock > 0) {
    const blockSpent = Math.min(remainingBlock, remainingDamage);
    remainingBlock -= blockSpent;
    remainingDamage -= blockSpent;
    absorbedByBlock = blockSpent;
  }

  if (remainingDamage > 0) {
    nextRaid = {
      ...nextRaid,
      settlementIntegrity: Math.max(0, nextRaid.settlementIntegrity - remainingDamage)
    };
    if (absorbedByBlock > 0) {
      lines.push(`Block absorbed ${absorbedByBlock}. Net damage: ${remainingDamage}.`);
    }
    lines.push(`${chosenEnemyCard.title} dealt ${remainingDamage} damage to Settlement Integrity.`);
  } else if (absorbedByBlock > 0) {
    lines.push(`Block absorbed ${absorbedByBlock}. Net damage: 0.`);
  }

  if (totals.drainIntegrity > 0) {
    nextRaid = {
      ...nextRaid,
      settlementIntegrity: Math.max(0, nextRaid.settlementIntegrity - totals.drainIntegrity)
    };
    lines.push(`${chosenEnemyCard.title} dealt ${totals.drainIntegrity} direct damage to Settlement Integrity.`);
  }

  nextRaid = {
    ...nextRaid,
    settlementBlock: 0,
    enemyWeaken: 0
  };

  nextRaid = applyThresholdCollapses(nextRaid, beforeIntegrity, lines);

  const remainingEnemyHand = nextRaid.enemyHand.filter(
    (card) => card.id !== chosenEnemyCard.id
  );
  const nextEnemyDiscard = [...nextRaid.enemyDiscardPile, chosenEnemyCard];
  const playerTurnDraw = drawCards(
    nextRaid.playerDrawPile,
    nextRaid.playerDiscardPile,
    1
  );
  const drawnCard = playerTurnDraw.drawnCards[0];
  if (drawnCard) {
    lines.push(`Turn ${nextRaid.turnNumber + 1}: drew ${drawnCard.title}.`);
  } else {
    lines.push(`Turn ${nextRaid.turnNumber + 1}: no card to draw.`);
  }
  const enemyRefill = drawUpToHandSize(
    remainingEnemyHand,
    nextRaid.enemyDrawPile,
    nextEnemyDiscard,
    nextRaid.enemyHandSize
  );

  nextRaid = {
    ...nextRaid,
    playerHand: [...nextRaid.playerHand, ...playerTurnDraw.drawnCards],
    playerDrawPile: playerTurnDraw.nextDrawPile,
    playerDiscardPile: playerTurnDraw.nextDiscardPile,
    enemyHand: enemyRefill.hand,
    enemyDrawPile: enemyRefill.drawPile,
    enemyDiscardPile: enemyRefill.discardPile,
    selectedPlayerCardIds: [],
    energySpentThisTurn: 0,
    turnNumber: nextRaid.turnNumber + 1,
    combatLog: [...nextRaid.combatLog, ...lines],
    builtStructures: buildStructureSummaries(nextRaid.layers)
  };

  nextRaid = pruneDestroyedPlayerCards(nextRaid);

  if (nextRaid.settlementIntegrity <= 0 || nextRaid.raidStrength <= 0) {
    return {
      ...nextRaid,
      preview: createEmptyPreview(),
      outcome: buildOutcome(state, nextRaid)
    };
  }

  return {
    ...nextRaid,
    preview: buildRaidPreview(nextRaid)
  };
}
