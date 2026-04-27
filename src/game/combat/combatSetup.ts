import { getStructureCardDefinition } from "../../data/structures";
import type { Ideology, PatternTier } from "../patterns/types";
import type { BoardCell, GameState, StructureId } from "../state/types";
import type {
  RaidLayerId,
  RaidLayerState,
  RaidLayerStructureState,
  RaidPatternSummary,
  RaidStructureSummary
} from "../raid/types";

export const RAID_LAYER_ORDER: RaidLayerId[] = ["outer", "mid", "inner"];

export const RAID_LAYER_LABELS: Record<RaidLayerId, string> = {
  outer: "Outer Ring",
  mid: "Mid Ring",
  inner: "Inner Ring"
};

export const RAID_LAYER_THRESHOLDS: Record<RaidLayerId, number> = {
  outer: 0.75,
  mid: 0.5,
  inner: 0.25
};

export interface PlayerCombatContext {
  patternTierValues: Record<Ideology, number>;
  availableStructureIds: Set<string>;
  hasWatchtower: boolean;
  hasWorkshop: boolean;
  hasMusterHall: boolean;
}

export function getRaidLayerIdForCell(
  _boardSize: number,
  cell: Pick<BoardCell, "row" | "col" | "ring" | "terrain">
): RaidLayerId {
  if (cell.ring >= 3) {
    return "outer";
  }

  if (cell.ring >= 2) {
    return "mid";
  }

  return "inner";
}

export function getPatternTierValue(tier: PatternTier): number {
  switch (tier) {
    case "small":
      return 1;
    case "medium":
      return 2;
    case "large":
      return 3;
    case "none":
    default:
      return 0;
  }
}

export function buildRaidLayerStates(state: GameState): RaidLayerState[] {
  return RAID_LAYER_ORDER.map((layerId) => ({
    id: layerId,
    label: RAID_LAYER_LABELS[layerId],
    collapseThresholdRatio: RAID_LAYER_THRESHOLDS[layerId],
    compromised: false,
    structures: state.board
      .filter(
        (cell) =>
          cell.structureId !== null && getRaidLayerIdForCell(state.boardSize, cell) === layerId
      )
      .map((cell) => {
        const definition = getStructureCardDefinition(cell.structureId!);

        return {
          cellId: cell.id,
          row: cell.row,
          col: cell.col,
          structureId: cell.structureId!,
          title: definition.title,
          condition: cell.condition,
          status: cell.condition <= 0 ? "destroyed" : cell.condition < 3 ? "damaged" : "healthy",
          raidDefense: definition.raidDefense
        } satisfies RaidLayerStructureState;
      })
  }));
}

export function buildRaidPatternSummaries(state: GameState): RaidPatternSummary[] {
  return Object.values(state.patterns.byIdeology)
    .filter((pattern): pattern is NonNullable<(typeof state.patterns.byIdeology)[Ideology]> => pattern !== null)
    .map((pattern) => ({
      ideology: pattern.ideology,
      templateLabel: pattern.templateLabel,
      tier: pattern.tier,
      score: pattern.score
    }));
}

export function buildRaidStructureSummaries(layers: RaidLayerState[]): RaidStructureSummary[] {
  const summaryMap = new Map<
    StructureId,
    {
      title: string;
      count: number;
      damagedCount: number;
      destroyedCount: number;
      raidDefense: number;
      layerIds: Set<RaidLayerId>;
    }
  >();

  for (const layer of layers) {
    for (const structure of layer.structures) {
      const existing =
        summaryMap.get(structure.structureId) ??
        {
          title: structure.title,
          count: 0,
          damagedCount: 0,
          destroyedCount: 0,
          raidDefense: structure.raidDefense,
          layerIds: new Set<RaidLayerId>()
        };

      if (structure.status !== "destroyed") {
        existing.count += 1;
      }

      if (structure.status === "damaged") {
        existing.damagedCount += 1;
      }

      if (structure.status === "destroyed") {
        existing.destroyedCount += 1;
      }

      existing.layerIds.add(layer.id);
      summaryMap.set(structure.structureId, existing);
    }
  }

  return [...summaryMap.entries()]
    .map(([structureId, summary]) => ({
      structureId,
      title: summary.title,
      count: summary.count,
      damagedCount: summary.damagedCount,
      destroyedCount: summary.destroyedCount,
      raidDefense: summary.raidDefense,
      layerIds: [...summary.layerIds]
    }))
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title));
}

export function getRaidPatternTierValues(
  activePatterns: RaidPatternSummary[]
): Record<Ideology, number> {
  return {
    scrap: getPatternTierValue(
      activePatterns.find((pattern) => pattern.ideology === "scrap")?.tier ?? "none"
    ),
    tech: getPatternTierValue(
      activePatterns.find((pattern) => pattern.ideology === "tech")?.tier ?? "none"
    ),
    magic: getPatternTierValue(
      activePatterns.find((pattern) => pattern.ideology === "magic")?.tier ?? "none"
    )
  };
}

export function buildPlayerCombatContext(
  layers: RaidLayerState[],
  activePatterns: RaidPatternSummary[]
): PlayerCombatContext {
  const liveStructures = new Set(
    layers.flatMap((layer) =>
      layer.structures
        .filter((structure) => structure.status !== "destroyed")
        .map((structure) => structure.structureId)
    )
  );

  return {
    patternTierValues: getRaidPatternTierValues(activePatterns),
    availableStructureIds: liveStructures,
    hasWatchtower: liveStructures.has("watchtower"),
    hasWorkshop: liveStructures.has("workshop"),
    hasMusterHall: liveStructures.has("muster-hall")
  };
}
