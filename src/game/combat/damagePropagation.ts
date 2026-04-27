import type { StructureId } from "../state/types";
import type {
  RaidBoardUpdate,
  RaidLayerId,
  RaidLayerState
} from "../raid/types";
import type { BoardCell, StructureDamageState } from "../state/types";
import { RAID_LAYER_ORDER } from "./combatSetup";
import { getRadialNeighborIds } from "../board/radialTopology";

interface WorkingStructureState {
  cellId: string;
  row: number;
  col: number;
  ring: number;
  sector: number;
  layerId: RaidLayerId;
  structureId: StructureId;
  raidDefense: number;
  initialCondition: number;
  currentCondition: number;
}

export interface BandDamageSummary {
  layerId: RaidLayerId;
  damagePoints: number;
  damagedCount: number;
  destroyedCount: number;
}

export interface DamagePropagationResult {
  updates: RaidBoardUpdate[];
  damagedCount: number;
  destroyedCount: number;
  bandSummaries: BandDamageSummary[];
  summaryLines: string[];
}

const SUPPORT_STRUCTURE_VALUES: Partial<Record<StructureId, number>> = {
  well: 2,
  workshop: 1,
  farm: 1,
  watchtower: 1,
  "ward-sigil": 1,
  "ley-lantern": 1
};

function getSupportValue(structureId: StructureId): number {
  return SUPPORT_STRUCTURE_VALUES[structureId] ?? 0;
}

function toDamageFlag(condition: number): StructureDamageState {
  if (condition <= 0) {
    return "ruined";
  }

  if (condition === 1) {
    return "damaged";
  }

  if (condition === 2) {
    return "worn";
  }

  return "healthy";
}

function getLayerSeverity(
  finalIntegrityRatio: number,
  layerId: RaidLayerId
): number {
  switch (layerId) {
    case "outer":
      return finalIntegrityRatio <= 0.25 ? 3 : finalIntegrityRatio <= 0.5 ? 2 : finalIntegrityRatio <= 0.75 ? 1 : 0;
    case "mid":
      return finalIntegrityRatio <= 0.25 ? 2 : finalIntegrityRatio <= 0.5 ? 1 : 0;
    case "inner":
      return finalIntegrityRatio <= 0.25 ? 1 : 0;
  }
}

function buildWorkingStructures(
  baseBoard: BoardCell[],
  layers: RaidLayerState[]
): WorkingStructureState[] {
  const layerStructureMap = new Map(
    layers.flatMap((layer) =>
      layer.structures.map((structure) => [structure.cellId, { ...structure, layerId: layer.id }] as const)
    )
  );

  return baseBoard
    .filter((cell) => cell.structureId !== null)
    .flatMap((cell) => {
      const layerStructure = layerStructureMap.get(cell.id);

      if (!layerStructure) {
        return [];
      }

      let currentCondition = cell.condition;

      if (layerStructure.status === "destroyed") {
        currentCondition = 0;
      } else {
        currentCondition = Math.min(currentCondition, layerStructure.condition);
      }

      return [
        {
          cellId: cell.id,
          row: cell.row,
          col: cell.col,
          ring: cell.ring,
          sector: cell.sector,
          layerId: layerStructure.layerId,
          structureId: cell.structureId!,
          raidDefense: layerStructure.raidDefense,
          initialCondition: cell.condition,
          currentCondition
        } satisfies WorkingStructureState
      ];
    });
}

function buildDamageBudgets(
  workingStructures: WorkingStructureState[],
  settlementIntegrityLoss: number,
  finalIntegrityRatio: number,
  compromisedLayerIds: RaidLayerId[]
): Record<RaidLayerId, number> {
  const activeLayerIds = RAID_LAYER_ORDER.filter(
    (layerId) =>
      workingStructures.some((structure) => structure.layerId === layerId && structure.currentCondition > 0) &&
      getLayerSeverity(finalIntegrityRatio, layerId) > 0
  );

  if (activeLayerIds.length === 0) {
    return {
      outer: 0,
      mid: 0,
      inner: 0
    };
  }

  const budgets: Record<RaidLayerId, number> = {
    outer: 0,
    mid: 0,
    inner: 0
  };
  let remainingBudget = Math.max(
    0,
    Math.ceil(settlementIntegrityLoss / 3) + compromisedLayerIds.length
  );

  for (const layerId of activeLayerIds) {
    budgets[layerId] += 1;
    remainingBudget = Math.max(0, remainingBudget - 1);
  }

  const weightedOrder = activeLayerIds.flatMap((layerId) =>
    Array.from(
      {
        length:
          getLayerSeverity(finalIntegrityRatio, layerId) *
          (layerId === "outer" ? 3 : layerId === "mid" ? 2 : 1)
      },
      () => layerId
    )
  );

  let cursor = 0;

  while (remainingBudget > 0 && weightedOrder.length > 0) {
    const layerId = weightedOrder[cursor % weightedOrder.length];
    budgets[layerId] += 1;
    remainingBudget -= 1;
    cursor += 1;
  }

  return budgets;
}

function getNeighbors(
  workingStructures: WorkingStructureState[],
  target: WorkingStructureState
): WorkingStructureState[] {
  const adjacencyBoard: BoardCell[] = workingStructures.map((structure) => ({
    id: structure.cellId,
    row: structure.row,
    col: structure.col,
    ring: structure.ring,
    sector: structure.sector,
    terrain: "ground",
    structureId: structure.currentCondition > 0 ? structure.structureId : null,
    stackLevel: structure.currentCondition > 0 ? 1 : 0,
    appliedIdeologies: [],
    appliedIdeology: null,
    connections: [],
    condition: structure.currentCondition,
    damage: "healthy"
  }));
  const targetCell = adjacencyBoard.find((cell) => cell.id === target.cellId);

  if (!targetCell) {
    return [];
  }

  const neighborIds = new Set(getRadialNeighborIds(adjacencyBoard, targetCell));

  return workingStructures.filter(
    (candidate) =>
      candidate.cellId !== target.cellId &&
      candidate.currentCondition > 0 &&
      neighborIds.has(candidate.cellId)
  );
}

function getStructureVulnerability(
  workingStructures: WorkingStructureState[],
  target: WorkingStructureState
): number {
  const neighbors = getNeighbors(workingStructures, target);
  const density = neighbors.length;
  const nearbySupport = Math.min(
    3,
    neighbors.reduce((total, neighbor) => total + getSupportValue(neighbor.structureId), 0)
  );
  const isolationPenalty = density === 0 ? 5 : density === 1 ? 3 : density === 2 ? 1 : 0;
  const supportPenalty = Math.max(0, 3 - nearbySupport);
  const defensePenalty = Math.max(0, 3 - target.raidDefense);
  const conditionPenalty = (4 - target.currentCondition) * 4;

  return conditionPenalty + isolationPenalty + supportPenalty + defensePenalty;
}

function applyDamagePoint(
  workingStructures: WorkingStructureState[],
  layerId: RaidLayerId
): boolean {
  const liveCandidates = workingStructures
    .filter((structure) => structure.layerId === layerId && structure.currentCondition > 0)
    .sort((left, right) => {
      const vulnerabilityDelta =
        getStructureVulnerability(workingStructures, right) -
        getStructureVulnerability(workingStructures, left);

      if (vulnerabilityDelta !== 0) {
        return vulnerabilityDelta;
      }

      if (left.currentCondition !== right.currentCondition) {
        return left.currentCondition - right.currentCondition;
      }

      if (left.raidDefense !== right.raidDefense) {
        return left.raidDefense - right.raidDefense;
      }

      return left.ring - right.ring || left.sector - right.sector;
    });

  const target = liveCandidates[0];

  if (!target) {
    return false;
  }

  target.currentCondition = Math.max(0, target.currentCondition - 1);
  return true;
}

function summarizeBandDamage(
  workingStructures: WorkingStructureState[],
  layerId: RaidLayerId,
  damagePoints: number
): BandDamageSummary {
  const layerStructures = workingStructures.filter((structure) => structure.layerId === layerId);

  return {
    layerId,
    damagePoints,
    damagedCount: layerStructures.filter(
      (structure) =>
        structure.currentCondition > 0 &&
        structure.currentCondition < structure.initialCondition &&
        structure.currentCondition > 0
    ).length,
    destroyedCount: layerStructures.filter(
      (structure) => structure.initialCondition > 0 && structure.currentCondition <= 0
    ).length
  };
}

function formatBandSummary(summary: BandDamageSummary): string | null {
  if (summary.damagePoints <= 0 && summary.damagedCount === 0 && summary.destroyedCount === 0) {
    return null;
  }

  const label =
    summary.layerId === "outer"
      ? "Outer Ring"
      : summary.layerId === "mid"
        ? "Mid Ring"
        : "Inner Ring";

  return `${label} absorbed ${summary.damagePoints} structural damage. ${summary.destroyedCount} destroyed, ${summary.damagedCount} damaged.`;
}

export function propagateRaidAftermath(
  baseBoard: BoardCell[],
  layers: RaidLayerState[],
  settlementIntegrityLoss: number,
  settlementIntegrity: number,
  maxSettlementIntegrity: number,
  compromisedLayerIds: RaidLayerId[]
): DamagePropagationResult {
  const workingStructures = buildWorkingStructures(baseBoard, layers);
  const finalIntegrityRatio =
    maxSettlementIntegrity > 0 ? settlementIntegrity / maxSettlementIntegrity : 0;
  const budgets = buildDamageBudgets(
    workingStructures,
    settlementIntegrityLoss,
    finalIntegrityRatio,
    compromisedLayerIds
  );
  const bandDamageApplied: Record<RaidLayerId, number> = {
    outer: 0,
    mid: 0,
    inner: 0
  };
  let overflow = 0;

  for (const layerId of RAID_LAYER_ORDER) {
    let remainingForLayer = budgets[layerId] + overflow;
    overflow = 0;

    while (remainingForLayer > 0) {
      const applied = applyDamagePoint(workingStructures, layerId);

      if (!applied) {
        overflow += remainingForLayer;
        break;
      }

      remainingForLayer -= 1;
      bandDamageApplied[layerId] += 1;
    }
  }

  const updates = workingStructures.reduce<RaidBoardUpdate[]>((result, structure) => {
    const baseCell = baseBoard.find((cell) => cell.id === structure.cellId);

    if (!baseCell) {
      return result;
    }

    if (structure.currentCondition === baseCell.condition) {
      const nextDamage = toDamageFlag(structure.currentCondition);

      if (
        (structure.currentCondition > 0 ? structure.structureId : null) === baseCell.structureId &&
        nextDamage === baseCell.damage
      ) {
        return result;
      }
    }

    result.push({
      cellId: structure.cellId,
      structureId: structure.currentCondition > 0 ? structure.structureId : null,
      condition: structure.currentCondition,
      damage: toDamageFlag(structure.currentCondition)
    });

    return result;
  }, []);

  const damagedCount = workingStructures.filter(
    (structure) => structure.currentCondition > 0 && structure.currentCondition < 3
  ).length;
  const destroyedCount = workingStructures.filter((structure) => structure.currentCondition <= 0).length;
  const bandSummaries = RAID_LAYER_ORDER.map((layerId) =>
    summarizeBandDamage(workingStructures, layerId, bandDamageApplied[layerId])
  );

  return {
    updates,
    damagedCount,
    destroyedCount,
    bandSummaries,
    summaryLines: bandSummaries
      .map((summary) => formatBandSummary(summary))
      .filter((line): line is string => Boolean(line))
  };
}

export function summarizeDamagePropagation(updates: RaidBoardUpdate[]): {
  damagedCount: number;
  destroyedCount: number;
} {
  return updates.reduce(
    (summary, update) => ({
      damagedCount:
        summary.damagedCount +
        (update.structureId !== null && update.damage !== "healthy" ? 1 : 0),
      destroyedCount: summary.destroyedCount + (update.structureId === null ? 1 : 0)
    }),
    {
      damagedCount: 0,
      destroyedCount: 0
    }
  );
}
