import type { BoardCell, GameState, StructureId } from "./state/types";
import { getRadialNeighbors, getRingForCell } from "./board/radialTopology";

export type MaintenanceTier = "core" | "stable" | "stretched" | "remote";

export interface MaintenanceCellState {
  distance: number;
  tier: MaintenanceTier;
  upkeepCost: number;
}

export interface MaintenanceSummary {
  remoteCount: number;
  stretchedCount: number;
  upkeepCost: number;
  expansionUpkeepDiscount: number;
  unpaidCount: number;
  threatenedCellIds: string[];
  baselineDecayTargetCount: number;
  decayPriorityCellIds: string[];
  profiles: MaintenanceProfile[];
}

export interface MaintenanceProfile {
  cellId: string;
  structureId: StructureId;
  condition: number;
  distance: number;
  density: number;
  supportValue: number;
  neutralLinkCount: number;
  ideologyLinkCount: number;
  baseDecay: number;
  exposurePenalty: number;
  isolationPenalty: number;
  strainPenalty: number;
  conditionPenalty: number;
  densityReduction: number;
  supportReduction: number;
  neutralLinkReduction: number;
  ideologyLinkReduction: number;
  risk: number;
  upkeepCost: number;
}

export interface MaintenanceCellExplanation {
  profile: MaintenanceProfile;
  baselineDecay: number;
  unpaidDecay: number;
  netDecayThisTurn: number;
  baselineApplies: boolean;
  unpaidApplies: boolean;
}

const SUPPORT_STRUCTURE_VALUES: Partial<Record<StructureId, number>> = {
  well: 2,
  workshop: 1,
  farm: 1,
  watchtower: 1,
  "ward-sigil": 1,
  "ley-lantern": 1
};

export function getCorePosition(boardSize: number): { row: number; col: number } {
  return {
    row: Math.floor(boardSize / 2),
    col: Math.floor(boardSize / 2)
  };
}

export function getDistanceFromCore(boardSize: number, row: number, col: number): number {
  return getRingForCell(boardSize, row, col);
}

export function getMaintenanceCellState(
  boardSize: number,
  cell: Pick<BoardCell, "row" | "col" | "terrain"> & Partial<Pick<BoardCell, "ring">>
): MaintenanceCellState {
  if (cell.terrain === "core") {
    return {
      distance: 0,
      tier: "core",
      upkeepCost: 0
    };
  }

  const distance = cell.ring ?? getDistanceFromCore(boardSize, cell.row, cell.col);

  if (distance <= 1) {
    return {
      distance,
      tier: "stable",
      upkeepCost: 0
    };
  }

  if (distance <= 2) {
    return {
      distance,
      tier: "stretched",
      upkeepCost: 0
    };
  }

  return {
    distance,
    tier: "remote",
    upkeepCost: 1
  };
}

export function getBuildableCellCount(state: GameState): number {
  return state.board.filter((cell) => cell.terrain !== "core").length;
}

function getNeighborCells(state: GameState, cell: BoardCell): BoardCell[] {
  return getRadialNeighbors(state.board, cell).filter(
    (candidate) => candidate.id !== cell.id && candidate.structureId !== null
  );
}

function getSupportValue(structureId: StructureId | null): number {
  if (!structureId) {
    return 0;
  }

  return SUPPORT_STRUCTURE_VALUES[structureId] ?? 0;
}

function hasIdeologyTrait(
  cell: Pick<BoardCell, "appliedIdeology" | "appliedIdeologies">,
  ideology: "tech" | "magic"
): boolean {
  if (cell.appliedIdeologies.includes(ideology)) {
    return true;
  }

  return cell.appliedIdeology === ideology;
}

function getConnectionStability(
  state: GameState,
  cell: BoardCell
): {
  neutralLinkCount: number;
  ideologyLinkCount: number;
  neutralLinkReduction: number;
  ideologyLinkReduction: number;
  isolationReduction: number;
} {
  const byId = new Map(state.board.map((entry) => [entry.id, entry]));
  let neutralLinkCount = 0;
  let ideologyLinkCount = 0;

  for (const connection of cell.connections) {
    const target = byId.get(connection.toCellId);

    if (!target || target.structureId === null || target.terrain === "core") {
      continue;
    }

    const sharedTech = hasIdeologyTrait(cell, "tech") && hasIdeologyTrait(target, "tech");
    const sharedMagic = hasIdeologyTrait(cell, "magic") && hasIdeologyTrait(target, "magic");

    if (sharedTech || sharedMagic) {
      ideologyLinkCount += sharedTech && sharedMagic ? 2 : 1;
    } else {
      neutralLinkCount += 1;
    }
  }

  const neutralLinkReduction = Math.min(0.8, neutralLinkCount * 0.35);
  const ideologyLinkReduction = Math.min(1.8, ideologyLinkCount * 0.65);
  const isolationReduction = neutralLinkCount > 0 ? 1 : 0;

  return {
    neutralLinkCount,
    ideologyLinkCount,
    neutralLinkReduction,
    ideologyLinkReduction,
    isolationReduction
  };
}

function buildMaintenanceProfiles(state: GameState): MaintenanceProfile[] {
  const builtCells = state.board.filter(
    (cell): cell is BoardCell & { structureId: StructureId } =>
      cell.terrain !== "core" && cell.structureId !== null
  );
  const builtCount = builtCells.length;
  const baseStrainPenalty = builtCount >= 20 ? 2 : builtCount >= 12 ? 1 : 0;

  return builtCells.map((cell) => {
    const neighbors = getNeighborCells(state, cell);
    const density = neighbors.length;
    const connectionStability = getConnectionStability(state, cell);
    const densityReduction = density >= 4 ? 2 : density >= 2 ? 1 : 0;
    const supportValue = neighbors.reduce(
      (total, neighbor) => total + getSupportValue(neighbor.structureId),
      0
    );
    const supportReduction = Math.min(2, supportValue);
    const isolationPenaltyRaw = density === 0 ? 2 : density === 1 ? 1 : 0;
    const isolationPenalty = Math.max(
      0,
      isolationPenaltyRaw - connectionStability.isolationReduction
    );
    const exposurePenalty = cell.ring >= 3 ? 2 : cell.ring >= 2 ? 1 : 0;
    const conditionPenalty = cell.condition <= 1 ? 1 : 0;
    const risk = Math.max(
      0,
      exposurePenalty +
        isolationPenalty +
        baseStrainPenalty +
        conditionPenalty -
        densityReduction -
        supportReduction -
        connectionStability.neutralLinkReduction -
        connectionStability.ideologyLinkReduction
    );
    const upkeepCost = risk >= 2 ? 1 : 0;

    return {
      cellId: cell.id,
      structureId: cell.structureId,
      condition: cell.condition,
      distance: cell.ring,
      density,
      supportValue,
      neutralLinkCount: connectionStability.neutralLinkCount,
      ideologyLinkCount: connectionStability.ideologyLinkCount,
      baseDecay: 1,
      exposurePenalty,
      isolationPenalty,
      strainPenalty: baseStrainPenalty,
      conditionPenalty,
      densityReduction,
      supportReduction,
      neutralLinkReduction: connectionStability.neutralLinkReduction,
      ideologyLinkReduction: connectionStability.ideologyLinkReduction,
      risk,
      upkeepCost
    };
  });
}

export function getBaselineDecayTargetsForTurn(
  summary: Pick<MaintenanceSummary, "decayPriorityCellIds" | "baselineDecayTargetCount">,
  turn: number
): string[] {
  if (
    summary.baselineDecayTargetCount <= 0 ||
    summary.decayPriorityCellIds.length === 0
  ) {
    return [];
  }

  const count = Math.min(
    summary.baselineDecayTargetCount,
    summary.decayPriorityCellIds.length
  );

  return Array.from({ length: count }, (_, index) => {
    const offset = (turn + index) % summary.decayPriorityCellIds.length;

    return summary.decayPriorityCellIds[offset];
  });
}

export function getMaintenanceCellExplanation(
  state: GameState,
  cellId: string
): MaintenanceCellExplanation | null {
  const summary = getMaintenanceSummary(state);
  const profile = summary.profiles.find((entry) => entry.cellId === cellId);

  if (!profile) {
    return null;
  }

  const baselineSet = new Set(getBaselineDecayTargetsForTurn(summary, state.turn));
  const unpaidSet = new Set(summary.threatenedCellIds);
  const baselineApplies = baselineSet.has(cellId);
  const unpaidApplies = unpaidSet.has(cellId);
  const baselineDecay = baselineApplies ? 1 : 0;
  const unpaidDecay = unpaidApplies ? 1 : 0;

  return {
    profile,
    baselineDecay,
    unpaidDecay,
    netDecayThisTurn: baselineDecay + unpaidDecay,
    baselineApplies,
    unpaidApplies
  };
}

export function getMaintenanceSummary(state: GameState): MaintenanceSummary {
  const profiles = buildMaintenanceProfiles(state);
  const upkeepCostRaw = profiles.reduce((total, profile) => total + profile.upkeepCost, 0);
  const builtCount = profiles.length;
  const ringCounts = new Map<number, number>();

  for (const profile of profiles) {
    ringCounts.set(profile.distance, (ringCounts.get(profile.distance) ?? 0) + 1);
  }

  const ringsOccupied = ringCounts.size;
  const developedRings = [...ringCounts.values()].filter((count) => count >= 3).length;
  const outerCoverage = ringCounts.get(3) ?? 0;
  const expansionUpkeepDiscount = Math.min(
    5,
    (ringsOccupied >= 2 ? 1 : 0) +
      (developedRings >= 2 ? 1 : 0) +
      (developedRings >= 3 ? 1 : 0) +
      (builtCount >= 18 ? 1 : 0) +
      (outerCoverage >= 6 ? 1 : 0)
  );
  const upkeepCost = Math.max(0, upkeepCostRaw - expansionUpkeepDiscount);
  const unpaidCount = Math.max(0, upkeepCost - state.resources.materials);
  const sortedByRisk = [...profiles]
    .sort((left, right) => {
      if (right.risk !== left.risk) {
        return right.risk - left.risk;
      }

      if (left.condition !== right.condition) {
        return left.condition - right.condition;
      }

      if (left.distance !== right.distance) {
        return right.distance - left.distance;
      }

      return left.cellId.localeCompare(right.cellId);
    });
  const threatenedCellIds = sortedByRisk
    .filter((profile) => profile.upkeepCost > 0)
    .slice(0, unpaidCount)
    .map((profile) => profile.cellId);
  const baselineDecayTargetCount =
    profiles.length === 0
      ? 0
      : Math.min(
          profiles.length,
          Math.max(1, Math.ceil(profiles.length / 7))
        );
  const decayPriorityCellIds = sortedByRisk.map((profile) => profile.cellId);

  return {
    remoteCount: profiles.filter((profile) => profile.upkeepCost > 0).length,
    stretchedCount: profiles.filter((profile) => profile.risk === 1).length,
    upkeepCost,
    expansionUpkeepDiscount,
    unpaidCount,
    threatenedCellIds,
    baselineDecayTargetCount,
    decayPriorityCellIds,
    profiles
  };
}
