import { getStructureCardDefinition } from "../../data/structures";
import { getMaintenanceCellState } from "../maintenance";
import {
  buildPatternVisualization,
  type PatternVisualization
} from "../patterns/buildPatternVisualization";
import { detectPatternState } from "../patterns/detectPatterns";
import type { Ideology, PatternState, PatternTier } from "../patterns/types";
import { getSelectedBuildStructureId } from "../selectors";
import type { BoardCell, GameState, StructureId } from "../state/types";

const IDEOLOGIES: Ideology[] = ["scrap", "tech", "magic"];

const TIER_ORDER: Record<PatternTier, number> = {
  none: 0,
  small: 1,
  medium: 2,
  large: 3
};

export interface PlacementPreview {
  cellId: string;
  structureId: StructureId;
  visualization: PatternVisualization;
  projectedPatterns: PatternState;
  affectedIdeologies: Ideology[];
  patternSummary: string;
  maintenanceSummary: string;
  upkeepDelta: number;
  maintenanceTier: ReturnType<typeof getMaintenanceCellState>["tier"];
}

export function getPlacementPreview(
  state: GameState,
  cellId: string
): PlacementPreview | null {
  const selectedStructureId = getSelectedBuildStructureId(state);

  if (!selectedStructureId) {
    return null;
  }

  const targetCell = state.board.find((cell) => cell.id === cellId);

  if (!targetCell || targetCell.terrain === "core" || targetCell.structureId !== null) {
    return null;
  }

  const projectedBoard: BoardCell[] = state.board.map((cell) =>
    cell.id === cellId
      ? {
          ...cell,
          structureId: selectedStructureId,
          stackLevel: 1,
          connections: [],
          condition: 3,
          damage: "healthy" as const
        }
      : cell
  );
  const projectedPatterns = detectPatternState(projectedBoard);
  const visualization = buildPatternVisualization(projectedBoard, projectedPatterns, null);
  const maintenanceState = getMaintenanceCellState(state.boardSize, targetCell);
  const affectedIdeologies = getAffectedIdeologies(
    state.patterns,
    projectedPatterns,
    targetCell.id
  );

  return {
    cellId,
    structureId: selectedStructureId,
    visualization,
    projectedPatterns,
    affectedIdeologies,
    patternSummary: buildPatternSummary(
      state.patterns,
      projectedPatterns,
      targetCell.id,
      selectedStructureId
    ),
    maintenanceSummary: buildMaintenanceSummary(maintenanceState),
    upkeepDelta: maintenanceState.upkeepCost,
    maintenanceTier: maintenanceState.tier
  };
}

function getAffectedIdeologies(
  currentPatterns: PatternState,
  projectedPatterns: PatternState,
  targetCellId: string
): Ideology[] {
  return IDEOLOGIES.filter((ideology) => {
    const projected = projectedPatterns.debug[ideology];
    const current = currentPatterns.debug[ideology];

    return (
      projected.contributingCellIds.includes(targetCellId) &&
      (projected.score > current.score ||
        TIER_ORDER[projected.tier] > TIER_ORDER[current.tier] ||
        (projected.active && !current.active))
    );
  });
}

function buildPatternSummary(
  currentPatterns: PatternState,
  projectedPatterns: PatternState,
  targetCellId: string,
  structureId: StructureId
): string {
  const changes = IDEOLOGIES.flatMap((ideology) => {
    const current = currentPatterns.debug[ideology];
    const projected = projectedPatterns.debug[ideology];

    if (!projected.contributingCellIds.includes(targetCellId)) {
      return [];
    }

    if (TIER_ORDER[projected.tier] > TIER_ORDER[current.tier]) {
      if (current.tier === "none") {
        return [`starts ${capitalize(ideology)} ${projected.tier}`];
      }

      return [`pushes ${capitalize(ideology)} ${current.tier} to ${projected.tier}`];
    }

    if (projected.score > current.score) {
      return [`feeds ${capitalize(ideology)} ${projected.templateLabel.toLowerCase()}`];
    }

    if (projected.active && !current.active) {
      return [`activates ${capitalize(ideology)} ${projected.templateLabel.toLowerCase()}`];
    }

    return [];
  });

  if (changes.length > 0) {
    return changes.slice(0, 2).join(" | ");
  }

  const definition = getStructureCardDefinition(structureId);
  return `${definition.title} adds local support without an immediate tier jump.`;
}

function buildMaintenanceSummary(
  maintenanceState: ReturnType<typeof getMaintenanceCellState>
): string {
  switch (maintenanceState.tier) {
    case "stable":
      return "Stable support zone";
    case "stretched":
      return "Frontier stretch (watch upkeep)";
    case "remote":
      return "Exposed frontier (+1 upkeep)";
    case "core":
      return "Core tile";
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
