import { getBuildCardDefinitionForStructure } from "../data/cards/cardRegistry";
import { getNodeDefinition } from "../data/nodes";
import { getProgressionUnlockDefinition } from "../data/progression";
import { getStructureCardDefinition } from "../data/structures";
import { raidCards } from "../data/raids";
import { getBuildableCellCount, getCorePosition } from "./maintenance";
import type {
  BoardCell,
  CardInstance,
  GameState,
  GridPosition,
  StructureId
} from "./state/types";

type ShopOfferId =
  | "charter-farm"
  | "charter-workshop"
  | "field-repair"
  | "food-for-materials"
  | "materials-for-progress"
  | "raid-tactic";

const BASE_SHOP_COSTS: Record<ShopOfferId, { food: number; materials: number; progress: number }> = {
  "charter-farm": { food: 0, materials: 4, progress: 0 },
  "charter-workshop": { food: 0, materials: 5, progress: 0 },
  "field-repair": { food: 0, materials: 3, progress: 0 },
  "food-for-materials": { food: 4, materials: 0, progress: 0 },
  "materials-for-progress": { food: 0, materials: 4, progress: 0 },
  "raid-tactic": { food: 0, materials: 6, progress: 1 }
};

export interface SettlementExpansionBonuses {
  builtCount: number;
  ringsOccupied: number;
  developedRings: number;
  outerRingCount: number;
  marketDiscount: number;
  districtProgressBonus: number;
  applicationPointBonus: number;
  upkeepSupportBonus: number;
  scrapDensityBonus: number;
}

type IdeologyForgeResourceKey = "food" | "materials" | "progress" | "intel";

export interface IdeologyForgePlan {
  affordable: boolean;
  cost: Record<IdeologyForgeResourceKey, number>;
  totalUnits: number;
}

const IDEOLOGY_FORGE_RESOURCE_ORDER: IdeologyForgeResourceKey[] = [
  "materials",
  "food",
  "progress",
  "intel"
];
const IDEOLOGY_FORGE_RESOURCE_CAP_PER_TYPE = 2;
const IDEOLOGY_FORGE_RESOURCE_UNITS = 3;

export function getCellAtPosition(
  board: BoardCell[],
  position: GridPosition
): BoardCell | undefined {
  return board.find(
    (cell) => cell.row === position.row && cell.col === position.col
  );
}

export function getEmptyTileCount(state: GameState): number {
  return state.board.filter((cell) => cell.terrain !== "core" && cell.structureId === null).length;
}

export function getCoreCell(state: GameState): BoardCell | undefined {
  const core = getCorePosition(state.boardSize);
  return state.board.find((cell) => cell.row === core.row && cell.col === core.col);
}

export function getBuiltStructureCount(
  state: GameState,
  structureId: StructureId
): number {
  return state.board.filter((cell) => cell.structureId === structureId).length;
}

export function getSelectedCard(state: GameState): CardInstance | undefined {
  return state.hand.find(
    (card) => card.instanceId === state.selectedCardInstanceId
  );
}

export function getSelectedBuildStructureId(state: GameState): StructureId | null {
  const selectedCard = getSelectedCard(state);

  if (selectedCard) {
    return selectedCard.structureId;
  }

  return state.selectedNodeStructureId;
}

export function isConnectModeEnabled(state: GameState): boolean {
  return state.connectModeEnabled;
}

export function getSelectedIdeologyCard(
  state: GameState
): GameState["selectedIdeologyCard"] {
  return state.selectedIdeologyCard;
}

export function getUpcomingRaidCard(
  stateOrTurn: Pick<GameState, "raidsSurvived"> | number,
  raidsSurvivedOverride?: number
) {
  const raidsSurvived =
    typeof stateOrTurn === "number"
      ? Math.max(0, raidsSurvivedOverride ?? Math.floor((stateOrTurn - 1) / 8))
      : Math.max(0, stateOrTurn.raidsSurvived);
  const raidIndex = raidsSurvived % raidCards.length;

  return raidCards[raidIndex];
}

export function getRaidWindowLabel(
  state: Pick<GameState, "turn" | "nextRaidTurn" | "nextRaidWindowStart" | "nextRaidWindowEnd">
): string {
  if (state.nextRaidWindowStart === state.nextRaidWindowEnd) {
    return `Turn ${state.nextRaidTurn}`;
  }

  const from = Math.max(0, state.nextRaidWindowStart - state.turn);
  const to = Math.max(0, state.nextRaidWindowEnd - state.turn);

  return `${from}-${to} turns`;
}

export function isRaidForecastExact(
  state: Pick<GameState, "nextRaidWindowStart" | "nextRaidWindowEnd">
): boolean {
  return state.nextRaidWindowStart === state.nextRaidWindowEnd;
}

export function getRaidForecastHint(
  state: Pick<GameState, "nextRaidTurn" | "nextRaidWindowStart" | "nextRaidWindowEnd">
): string {
  if (isRaidForecastExact(state)) {
    return `Raid locked for Turn ${state.nextRaidTurn}.`;
  }

  return `Raid expected between turns ${state.nextRaidWindowStart} and ${state.nextRaidWindowEnd}.`;
}

export function getRaidCountdownText(
  state: Pick<GameState, "turn" | "nextRaidTurn" | "nextRaidWindowStart" | "nextRaidWindowEnd">
): string {
  if (isRaidForecastExact(state)) {
    return `T${state.nextRaidTurn}`;
  }

  return `T${state.nextRaidWindowStart}-T${state.nextRaidWindowEnd}`;
}

export function getRaidWindowTurnsRemaining(
  state: Pick<GameState, "turn" | "nextRaidWindowStart" | "nextRaidWindowEnd">
): { min: number; max: number } {
  return {
    min: Math.max(0, state.nextRaidWindowStart - state.turn),
    max: Math.max(0, state.nextRaidWindowEnd - state.turn)
  };
}

export function getUpcomingRaidInfo(
  state: Pick<GameState, "turn" | "raidsSurvived" | "nextRaidTurn" | "nextRaidWindowStart" | "nextRaidWindowEnd">
) {
  return {
    card: getUpcomingRaidCard(state),
    exact: isRaidForecastExact(state),
    windowLabel: getRaidWindowLabel(state),
    countdownText: getRaidCountdownText(state),
    hint: getRaidForecastHint(state)
  };
}

export function getNextDrawCardPreview(state: GameState): CardInstance | null {
  if (state.drawPile.length > 0) {
    return state.drawPile[0];
  }

  if (state.discardPile.length > 0) {
    return state.discardPile[0];
  }

  return null;
}

export function getCardTitle(card: CardInstance): string {
  return getBuildCardDefinitionForStructure(card.structureId).title;
}

export function getNodeAvailability(
  state: GameState,
  structureId: "scrap-bastion"
): {
  available: boolean;
  reason: string;
} {
  const definition = getNodeDefinition(structureId);
  const hasUnlock = state.progression.discoveredUnlockIds.includes(
    definition.unlockDoctrineId
  );

  if (!hasUnlock) {
    return {
      available: false,
      reason: `Unlock ${getProgressionUnlockDefinition(definition.unlockDoctrineId).title} first.`
    };
  }

  const activeCount = getBuiltStructureCount(state, structureId);

  if (activeCount >= definition.maxActive) {
    return {
      available: false,
      reason: `${definition.title} is already built.`
    };
  }

  if (getEmptyTileCount(state) === 0) {
    return {
      available: false,
      reason: "The board is full."
    };
  }

  if (state.resources.materials < definition.cost.materials) {
    return {
      available: false,
      reason: `Need ${definition.cost.materials} Materials.`
    };
  }

  if (state.resources.progress < definition.cost.progress) {
    return {
      available: false,
      reason: `Need ${definition.cost.progress} Progress.`
    };
  }

  return {
    available: true,
    reason: `Spend ${definition.cost.materials} Materials and ${definition.cost.progress} Progress to place ${definition.title}.`
  };
}

export function getBoardOccupancySummary(state: GameState): string {
  const occupied = state.board.filter(
    (cell) => cell.terrain !== "core" && cell.structureId !== null
  ).length;

  return `${occupied}/${getBuildableCellCount(state)}`;
}

export function getSettlementExpansionBonuses(state: GameState): SettlementExpansionBonuses {
  const builtCells = state.board.filter(
    (cell) => cell.terrain !== "core" && cell.structureId !== null
  );
  const builtCount = builtCells.length;
  const ringCounts = new Map<number, number>();

  for (const cell of builtCells) {
    ringCounts.set(cell.ring, (ringCounts.get(cell.ring) ?? 0) + 1);
  }

  const ringsOccupied = new Set(builtCells.map((cell) => cell.ring)).size;
  const developedRings = [...ringCounts.values()].filter((count) => count >= 3).length;
  const outerRingCount = builtCells.filter((cell) => cell.ring >= 3).length;
  const marketDiscount = Math.min(
    4,
    (builtCount >= 8 ? 1 : 0) +
      (builtCount >= 14 ? 1 : 0) +
      (builtCount >= 20 ? 1 : 0) +
      (developedRings >= 2 ? 1 : 0)
  );
  const districtProgressBonus =
    (ringsOccupied >= 2 && builtCount >= 8 ? 1 : 0) +
    (developedRings >= 2 && builtCount >= 14 ? 1 : 0) +
    (developedRings >= 3 && builtCount >= 20 ? 1 : 0);
  const applicationPointBonus =
    (builtCount >= 6 ? 1 : 0) +
    (builtCount >= 12 && ringsOccupied >= 2 ? 1 : 0) +
    (builtCount >= 18 && developedRings >= 2 ? 1 : 0);
  const upkeepSupportBonus =
    (ringsOccupied >= 2 && builtCount >= 8 ? 1 : 0) +
    (developedRings >= 2 ? 1 : 0) +
    (developedRings >= 3 ? 1 : 0);
  const scrapDensityBonus =
    (builtCount >= 8 ? 1 : 0) +
    (builtCount >= 14 ? 1 : 0) +
    (developedRings >= 2 ? 1 : 0);

  return {
    builtCount,
    ringsOccupied,
    developedRings,
    outerRingCount,
    marketDiscount,
    districtProgressBonus,
    applicationPointBonus,
    upkeepSupportBonus,
    scrapDensityBonus
  };
}

function buildIdeologyForgeCost(
  state: GameState
): Record<IdeologyForgeResourceKey, number> | null {
  const remainingBudget: Record<IdeologyForgeResourceKey, number> = {
    food: state.resources.food,
    materials: state.resources.materials,
    progress: state.resources.progress,
    intel: state.resources.intel
  };
  const cost: Record<IdeologyForgeResourceKey, number> = {
    food: 0,
    materials: 0,
    progress: 0,
    intel: 0
  };
  let unitsRemaining = IDEOLOGY_FORGE_RESOURCE_UNITS;

  while (unitsRemaining > 0) {
    let picked: IdeologyForgeResourceKey | null = null;
    let pickedSlack = 0;

    for (const key of IDEOLOGY_FORGE_RESOURCE_ORDER) {
      if (cost[key] >= IDEOLOGY_FORGE_RESOURCE_CAP_PER_TYPE) {
        continue;
      }

      const slack = remainingBudget[key] - cost[key];

      if (slack > pickedSlack) {
        picked = key;
        pickedSlack = slack;
      }
    }

    if (!picked || pickedSlack <= 0) {
      break;
    }

    cost[picked] += 1;
    unitsRemaining -= 1;
  }

  if (unitsRemaining > 0) {
    return null;
  }

  return cost;
}

export function getIdeologyForgePlan(state: GameState): IdeologyForgePlan {
  const computedCost = buildIdeologyForgeCost(state);

  if (!computedCost) {
    return {
      affordable: false,
      totalUnits: IDEOLOGY_FORGE_RESOURCE_UNITS,
      cost: {
        food: 0,
        materials: 0,
        progress: 0,
        intel: 0
      }
    };
  }

  return {
    affordable: true,
    totalUnits: IDEOLOGY_FORGE_RESOURCE_UNITS,
    cost: computedCost
  };
}

export function getShopOfferCost(
  state: GameState,
  offerId: ShopOfferId
): { food: number; materials: number; progress: number } {
  const base = BASE_SHOP_COSTS[offerId];
  const bonuses = getSettlementExpansionBonuses(state);
  const materialDiscountEligible =
    offerId === "charter-farm" ||
    offerId === "charter-workshop" ||
    offerId === "field-repair" ||
    offerId === "materials-for-progress" ||
    offerId === "raid-tactic";

  return {
    food: base.food,
    materials: materialDiscountEligible
      ? Math.max(1, base.materials - bonuses.marketDiscount)
      : base.materials,
    progress: base.progress
  };
}

