import {
  progressionUnlockDefinitions,
  type ProgressionTrigger
} from "../../data/progression";
import type { BoardCell } from "../state/types";
import type { Ideology, PatternState, PatternTier } from "../patterns/types";
import type { ProgressionState, IdeologyProgressionState } from "./types";
import { getRadialNeighbors } from "../board/radialTopology";

const IDEOLOGY_ORDER: Ideology[] = ["scrap", "tech", "magic"];

export const IDEOLOGY_BAR_THRESHOLDS: Record<Exclude<PatternTier, "none">, number> = {
  small: 8,
  medium: 18,
  large: 30
};

function hasIdeology(
  cell: Pick<BoardCell, "appliedIdeology" | "appliedIdeologies">,
  ideology: "tech" | "magic"
): boolean {
  if (cell.appliedIdeologies.includes(ideology)) {
    return true;
  }

  return cell.appliedIdeology === ideology;
}

function createIdeologyProgressionState(
  ideology: Ideology
): IdeologyProgressionState {
  return {
    ideology,
    currentTier: "none",
    currentPatternLabel: null,
    currentScore: 0,
    barValue: 0,
    nextThresholdValue: IDEOLOGY_BAR_THRESHOLDS.small,
    doctrineIds: [],
    buildCardIds: [],
    supportCardIds: [],
    attackCardIds: [],
    unlockedPassiveIds: [],
    activePassiveIds: [],
    latestUnlockedIds: []
  };
}

export function createEmptyProgressionState(): ProgressionState {
  return {
    discoveredUnlockIds: [],
    discoveredAtTurn: {},
    latestUnlockedIds: [],
    raidPools: {
      support: [],
      attack: []
    },
    activePassiveIds: [],
    byIdeology: {
      scrap: createIdeologyProgressionState("scrap"),
      tech: createIdeologyProgressionState("tech"),
      magic: createIdeologyProgressionState("magic")
    }
  };
}

function getConditionFactor(cell: Pick<BoardCell, "condition">): number {
  if (cell.condition >= 3) {
    return 1;
  }

  if (cell.condition === 2) {
    return 0.8;
  }

  if (cell.condition === 1) {
    return 0.55;
  }

  return 0;
}

function getPatternBonus(patterns: PatternState, ideology: Ideology): number {
  const pattern = patterns.byIdeology[ideology];

  if (!pattern) {
    return 0;
  }

  switch (pattern.tier) {
    case "small":
      return 1;
    case "medium":
      return 2;
    case "large":
      return 3;
    default:
      return 0;
  }
}

function getIdeologyBarValues(
  board: BoardCell[],
  patterns: PatternState
): Record<Ideology, number> {
  const totals: Record<Ideology, number> = {
    scrap: 0,
    tech: 0,
    magic: 0
  };
  const occupiedCells = board.filter((cell) => cell.structureId !== null);
  const occupiedById = new Set(occupiedCells.map((cell) => cell.id));
  const cellById = new Map(board.map((cell) => [cell.id, cell]));
  const techEdgeKeys = new Set<string>();
  const magicEdgeKeys = new Set<string>();
  const techDegreeByCellId = new Map<string, number>();
  const magicDegreeByCellId = new Map<string, number>();
  const magicByRing = new Map<number, number>();

  for (const cell of occupiedCells) {
    const factor = getConditionFactor(cell);
    const stackBonus = Math.max(0, cell.stackLevel - 1) * 0.6;
    const neighbors = getRadialNeighbors(board, cell).filter((neighbor) =>
      occupiedById.has(neighbor.id)
    );
    const density = neighbors.length;

    totals.scrap += (0.8 + stackBonus) * factor;
    totals.scrap += density * 0.22 * factor;

    let techDegree = 0;
    let magicDegree = 0;

    for (const connection of cell.connections) {
      const target = cellById.get(connection.toCellId);

      if (!target || target.structureId === null) {
        continue;
      }

      const edgeKey = [cell.id, target.id].sort().join(":");

      if (hasIdeology(cell, "tech") && hasIdeology(target, "tech")) {
        techDegree += 1;
        techEdgeKeys.add(edgeKey);
      }

      if (hasIdeology(cell, "magic") && hasIdeology(target, "magic")) {
        magicDegree += 1;
        magicEdgeKeys.add(edgeKey);
      }
    }

    techDegreeByCellId.set(cell.id, techDegree);
    magicDegreeByCellId.set(cell.id, magicDegree);

    if (hasIdeology(cell, "tech")) {
      totals.tech += (0.72 + stackBonus * 0.22) * factor;
    }

    if (hasIdeology(cell, "magic")) {
      totals.magic += (0.68 + stackBonus * 0.2) * factor;
    }

    if (techDegree > 0 && hasIdeology(cell, "tech")) {
      totals.tech += (1.12 + stackBonus * 0.28) * factor;
    }

    if (magicDegree > 0 && hasIdeology(cell, "magic")) {
      totals.magic += (1.05 + stackBonus * 0.25) * factor;
      magicByRing.set(cell.ring, (magicByRing.get(cell.ring) ?? 0) + 1);
    }
  }

  totals.tech += techEdgeKeys.size * 0.66;
  totals.magic += magicEdgeKeys.size * 0.58;

  for (const degree of techDegreeByCellId.values()) {
    if (degree >= 3) {
      totals.tech += 0.72;
    }
  }

  for (const count of magicByRing.values()) {
    if (count >= 3) {
      totals.magic += 0.45 + (count - 3) * 0.22;
    }
  }

  for (const ideology of IDEOLOGY_ORDER) {
    totals[ideology] += getPatternBonus(patterns, ideology);
  }

  return totals;
}

function getTierForBarValue(value: number): PatternTier {
  if (value >= IDEOLOGY_BAR_THRESHOLDS.large) {
    return "large";
  }

  if (value >= IDEOLOGY_BAR_THRESHOLDS.medium) {
    return "medium";
  }

  if (value >= IDEOLOGY_BAR_THRESHOLDS.small) {
    return "small";
  }

  return "none";
}

function getNextThresholdValue(value: number): number | null {
  if (value < IDEOLOGY_BAR_THRESHOLDS.small) {
    return IDEOLOGY_BAR_THRESHOLDS.small;
  }

  if (value < IDEOLOGY_BAR_THRESHOLDS.medium) {
    return IDEOLOGY_BAR_THRESHOLDS.medium;
  }

  if (value < IDEOLOGY_BAR_THRESHOLDS.large) {
    return IDEOLOGY_BAR_THRESHOLDS.large;
  }

  return null;
}

export function resolveProgressionState(
  previousState: ProgressionState,
  patterns: PatternState,
  board: BoardCell[],
  turn: number
): ProgressionState {
  const barValues = getIdeologyBarValues(board, patterns);
  const discoveredUnlockIds = [...previousState.discoveredUnlockIds];
  const discoveredUnlockIdSet = new Set(discoveredUnlockIds);
  const discoveredAtTurn = { ...previousState.discoveredAtTurn };
  const latestUnlockedIds: string[] = [];

  for (const definition of progressionUnlockDefinitions) {
    if (discoveredUnlockIdSet.has(definition.id)) {
      continue;
    }

    if (!isTriggerSatisfied(definition.trigger, barValues)) {
      continue;
    }

    discoveredUnlockIds.push(definition.id);
    discoveredUnlockIdSet.add(definition.id);
    discoveredAtTurn[definition.id] = turn;
    latestUnlockedIds.push(definition.id);
  }

  const byIdeology: ProgressionState["byIdeology"] = {
    scrap: createIdeologyProgressionState("scrap"),
    tech: createIdeologyProgressionState("tech"),
    magic: createIdeologyProgressionState("magic")
  };
  const raidPools: ProgressionState["raidPools"] = {
    support: [],
    attack: []
  };
  const activePassiveIds: string[] = [];

  for (const ideology of IDEOLOGY_ORDER) {
    const ideologyState = createIdeologyProgressionState(ideology);
    const barValue = Math.round(barValues[ideology] * 10) / 10;

    ideologyState.currentTier = getTierForBarValue(barValue);
    ideologyState.currentPatternLabel = patterns.byIdeology[ideology]?.templateLabel ?? null;
    ideologyState.currentScore = barValue;
    ideologyState.barValue = barValue;
    ideologyState.nextThresholdValue = getNextThresholdValue(barValue);

    for (const definition of progressionUnlockDefinitions) {
      if (definition.ideology !== ideology || !discoveredUnlockIdSet.has(definition.id)) {
        continue;
      }

      switch (definition.category) {
        case "doctrine":
          ideologyState.doctrineIds.push(definition.id);
          break;
        case "build-card":
          ideologyState.buildCardIds.push(definition.id);
          break;
        case "support-card":
          ideologyState.supportCardIds.push(definition.id);
          raidPools.support.push(definition.id);
          break;
        case "attack-card":
          ideologyState.attackCardIds.push(definition.id);
          raidPools.attack.push(definition.id);
          break;
        case "passive-effect":
          ideologyState.unlockedPassiveIds.push(definition.id);

          if (
            definition.activeWhileRequirementMet &&
            isTriggerSatisfied(definition.trigger, barValues)
          ) {
            ideologyState.activePassiveIds.push(definition.id);
            activePassiveIds.push(definition.id);
          }
          break;
      }
    }

    ideologyState.latestUnlockedIds = latestUnlockedIds.filter((unlockId) => {
      return progressionUnlockDefinitions.some(
        (definition) => definition.id === unlockId && definition.ideology === ideology
      );
    });

    byIdeology[ideology] = ideologyState;
  }

  return {
    discoveredUnlockIds,
    discoveredAtTurn,
    latestUnlockedIds,
    raidPools,
    activePassiveIds,
    byIdeology
  };
}

function isTriggerSatisfied(
  trigger: ProgressionTrigger,
  barValues: Record<Ideology, number>
): boolean {
  switch (trigger.kind) {
    case "pattern-threshold": {
      const threshold =
        trigger.minimumTier === "small"
          ? IDEOLOGY_BAR_THRESHOLDS.small
          : trigger.minimumTier === "medium"
            ? IDEOLOGY_BAR_THRESHOLDS.medium
            : IDEOLOGY_BAR_THRESHOLDS.large;

      return barValues[trigger.ideology] >= threshold;
    }
    case "node":
      return false;
  }
}
