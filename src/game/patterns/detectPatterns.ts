import { formatSiteLabel, getRadialNeighbors } from "../board/radialTopology";
import type { BoardCell, StructureId } from "../state/types";
import type {
  Ideology,
  PlacementRecommendation,
  PatternDebugEntry,
  PatternMatch,
  PatternState,
  PatternTemplateId,
  PatternTier
} from "./types";

interface DetectionOptions {
  selectedStructureId?: StructureId | null;
  connectModeEnabled?: boolean;
}

interface InternalPatternCandidate {
  ideology: Ideology;
  templateId: PatternTemplateId;
  templateLabel: string;
  contributingCells: BoardCell[];
  score: number;
  tier: PatternTier;
  breakdown: PatternMatch["breakdown"];
  explanation: string;
}

interface IdeologyEdge {
  fromCellId: string;
  toCellId: string;
}

const IDEOLOGIES: Ideology[] = ["scrap", "tech", "magic"];
const SCORE_THRESHOLDS: Record<Exclude<PatternTier, "none">, number> = {
  small: 2,
  medium: 5,
  large: 7
};

function createEmptyDebugEntry(ideology: Ideology): PatternDebugEntry {
  return {
    ideology,
    active: false,
    tier: "none",
    score: 0,
    templateId: null,
    templateLabel: "No pattern",
    explanation: `No active ${ideology} pattern.`,
    contributingCellIds: [],
    contributingCoordinates: [],
    breakdown: {
      structureWeight: 0,
      geometryBonus: 0,
      wildcardBonus: 0,
      modifierBonus: 0,
      totalScore: 0
    }
  };
}

export function createEmptyPatternState(): PatternState {
  return {
    byIdeology: {
      scrap: null,
      tech: null,
      magic: null
    },
    debug: {
      scrap: createEmptyDebugEntry("scrap"),
      tech: createEmptyDebugEntry("tech"),
      magic: createEmptyDebugEntry("magic")
    },
    tileHighlights: {},
    projectedTileHighlights: {},
    placementRecommendations: []
  };
}

function getPatternTier(score: number): PatternTier {
  if (score >= SCORE_THRESHOLDS.large) {
    return "large";
  }

  if (score >= SCORE_THRESHOLDS.medium) {
    return "medium";
  }

  if (score >= SCORE_THRESHOLDS.small) {
    return "small";
  }

  return "none";
}

function hasIdeology(
  cell: Pick<BoardCell, "appliedIdeology" | "appliedIdeologies">,
  ideology: "tech" | "magic"
): boolean {
  if (cell.appliedIdeologies.includes(ideology)) {
    return true;
  }

  return cell.appliedIdeology === ideology;
}

function sortCells(cells: BoardCell[]): BoardCell[] {
  return [...cells].sort(
    (left, right) =>
      left.ring - right.ring ||
      left.sector - right.sector ||
      left.row - right.row ||
      left.col - right.col
  );
}

function getCoordinate(cell: BoardCell): string {
  return formatSiteLabel(cell);
}

function getOccupiedCells(board: BoardCell[]): BoardCell[] {
  return board.filter((cell) => cell.structureId !== null);
}

function getNeighborsById(board: BoardCell[], source: BoardCell, idSet: Set<string>): BoardCell[] {
  return getRadialNeighbors(board, source).filter((neighbor) => idSet.has(neighbor.id));
}

function getConnectedComponents(board: BoardCell[], cells: BoardCell[]): BoardCell[][] {
  const idSet = new Set(cells.map((cell) => cell.id));
  const remaining = new Map(cells.map((cell) => [cell.id, cell]));
  const components: BoardCell[][] = [];

  while (remaining.size > 0) {
    const first = remaining.values().next().value as BoardCell;
    const queue = [first];
    const component: BoardCell[] = [];
    remaining.delete(first.id);

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      component.push(current);

      for (const neighbor of getNeighborsById(board, current, idSet)) {
        if (!remaining.has(neighbor.id)) {
          continue;
        }

        remaining.delete(neighbor.id);
        queue.push(neighbor);
      }
    }

    components.push(sortCells(component));
  }

  return components;
}

function countUndirectedAdjacencyEdges(board: BoardCell[], cells: BoardCell[]): number {
  const idSet = new Set(cells.map((cell) => cell.id));
  const edgeKeys = new Set<string>();

  for (const cell of cells) {
    for (const neighbor of getNeighborsById(board, cell, idSet)) {
      const key = [cell.id, neighbor.id].sort().join(":");
      edgeKeys.add(key);
    }
  }

  return edgeKeys.size;
}

function getSectorCount(cell: Pick<BoardCell, "ring">): number {
  return Math.max(1, cell.ring * 8);
}

function getCircularSectorDistance(
  leftSector: number,
  rightSector: number,
  sectorCount: number
): number {
  const raw = Math.abs(leftSector - rightSector) % sectorCount;
  return Math.min(raw, sectorCount - raw);
}

function getSymmetryBonus(cells: BoardCell[]): number {
  if (cells.length <= 1) {
    return 0;
  }

  const byRing = new Map<number, Set<number>>();

  for (const cell of cells) {
    const entries = byRing.get(cell.ring) ?? new Set<number>();
    entries.add(cell.sector);
    byRing.set(cell.ring, entries);
  }

  let mirroredPairs = 0;
  let totalCells = 0;

  for (const [ring, sectors] of byRing.entries()) {
    const sectorCount = Math.max(1, ring * 8);
    totalCells += sectors.size;

    for (const sector of sectors) {
      const opposite = (sector + Math.floor(sectorCount / 2)) % sectorCount;

      if (!sectors.has(opposite)) {
        continue;
      }

      if (sector <= opposite) {
        mirroredPairs += 1;
      }
    }
  }

  if (totalCells <= 0) {
    return 0;
  }

  const mirroredCoverage = (mirroredPairs * 2) / totalCells;

  return Math.round(Math.min(2.4, mirroredCoverage * 2.2) * 10) / 10;
}

function getCompactnessBonus(cells: BoardCell[]): number {
  if (cells.length <= 1) {
    return 0;
  }

  const rings = cells.map((cell) => cell.ring);
  const minRing = Math.min(...rings);
  const maxRing = Math.max(...rings);
  const spread = maxRing - minRing;
  const ringTightness = Math.max(0, 1.6 - spread * 0.5);
  const densityLift = cells.length >= 4 && spread <= 1 ? 0.45 : 0;

  return Math.round((ringTightness + densityLift) * 10) / 10;
}

function getConnectionEdges(board: BoardCell[], ideology: "tech" | "magic"): IdeologyEdge[] {
  const byId = new Map(board.map((cell) => [cell.id, cell]));
  const edgeMap = new Map<string, IdeologyEdge>();

  for (const cell of board) {
    if (!cell.structureId || !hasIdeology(cell, ideology)) {
      continue;
    }

    for (const connection of cell.connections) {
      const other = byId.get(connection.toCellId);

      if (!other || !other.structureId || !hasIdeology(other, ideology)) {
        continue;
      }

      const key = [cell.id, other.id].sort().join(":");

      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          fromCellId: cell.id,
          toCellId: other.id
        });
      }
    }
  }

  return [...edgeMap.values()];
}

function getGraphComponents(
  board: BoardCell[],
  edges: IdeologyEdge[]
): Array<{
  cells: BoardCell[];
  edgeCount: number;
  maxDegree: number;
  longestPath: number;
  cycleCount: number;
  ringDiscipline: number;
  longChordPenalty: number;
  symmetryBonus: number;
}> {
  if (edges.length === 0) {
    return [];
  }

  const byId = new Map(board.map((cell) => [cell.id, cell]));
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const from = byId.get(edge.fromCellId);
    const to = byId.get(edge.toCellId);

    if (!from || !to || !from.structureId || !to.structureId) {
      continue;
    }

    const fromSet = adjacency.get(from.id) ?? new Set<string>();
    fromSet.add(to.id);
    adjacency.set(from.id, fromSet);

    const toSet = adjacency.get(to.id) ?? new Set<string>();
    toSet.add(from.id);
    adjacency.set(to.id, toSet);
  }

  const visited = new Set<string>();
  const components: Array<{
    cells: BoardCell[];
    edgeCount: number;
    maxDegree: number;
    longestPath: number;
    cycleCount: number;
    ringDiscipline: number;
    longChordPenalty: number;
    symmetryBonus: number;
  }> = [];

  for (const nodeId of adjacency.keys()) {
    if (visited.has(nodeId)) {
      continue;
    }

    const queue = [nodeId];
    const nodeIds: string[] = [];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      nodeIds.push(current);
      const neighbors = adjacency.get(current) ?? new Set<string>();

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) {
          continue;
        }

        visited.add(neighborId);
        queue.push(neighborId);
      }
    }

    const cells = nodeIds
      .map((id) => byId.get(id))
      .filter((cell): cell is BoardCell => Boolean(cell))
      .filter((cell) => Boolean(cell.structureId));
    const degreeCounts = nodeIds.map((id) => (adjacency.get(id)?.size ?? 0));
    const edgeCount = degreeCounts.reduce((total, degree) => total + degree, 0) / 2;
    const maxDegree = degreeCounts.reduce((best, degree) => Math.max(best, degree), 0);
    const longestPath = getGraphLongestPath(nodeIds, adjacency);
    const cycleCount = Math.max(0, edgeCount - nodeIds.length + 1);
    const nodeSet = new Set(nodeIds);
    const componentEdges = edges.filter(
      (edge) => nodeSet.has(edge.fromCellId) && nodeSet.has(edge.toCellId)
    );
    let ringDisciplineRaw = 0;
    let longChordPenaltyRaw = 0;

    for (const edge of componentEdges) {
      const from = byId.get(edge.fromCellId);
      const to = byId.get(edge.toCellId);

      if (!from || !to) {
        continue;
      }

      const ringDelta = Math.abs(from.ring - to.ring);
      const sameRing = from.ring === to.ring;
      const sectorCount = sameRing ? getSectorCount(from) : Math.max(getSectorCount(from), getSectorCount(to));
      const sectorDelta = getCircularSectorDistance(from.sector, to.sector, sectorCount);
      const normalizedSectorDelta = sectorCount > 0 ? sectorDelta / sectorCount : 0;
      const ringStepBonus = ringDelta <= 1 ? 1 : 0;
      const shortChordBonus =
        normalizedSectorDelta <= 0.18 ? 0.85 : normalizedSectorDelta <= 0.3 ? 0.45 : 0;
      ringDisciplineRaw += ringStepBonus + shortChordBonus;

      if (sameRing && normalizedSectorDelta > 0.35) {
        longChordPenaltyRaw += 1.2;
      } else if (sameRing && normalizedSectorDelta > 0.25) {
        longChordPenaltyRaw += 0.6;
      }

      if (ringDelta > 1) {
        longChordPenaltyRaw += 0.9;
      }
    }

    const ringDiscipline =
      componentEdges.length > 0
        ? Math.round(((ringDisciplineRaw / componentEdges.length) * 2.2) * 10) / 10
        : 0;
    const longChordPenalty = Math.round(longChordPenaltyRaw * 10) / 10;
    const symmetryBonus = getSymmetryBonus(cells);

    components.push({
      cells: sortCells(cells),
      edgeCount,
      maxDegree,
      longestPath,
      cycleCount,
      ringDiscipline,
      longChordPenalty,
      symmetryBonus
    });
  }

  return components;
}

function getGraphLongestPath(nodeIds: string[], adjacency: Map<string, Set<string>>): number {
  if (nodeIds.length <= 1) {
    return nodeIds.length;
  }

  let best = 1;

  for (const startId of nodeIds) {
    const distances = new Map<string, number>([[startId, 0]]);
    const queue = [startId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDistance = distances.get(currentId) ?? 0;
      best = Math.max(best, currentDistance + 1);

      for (const neighborId of adjacency.get(currentId) ?? []) {
        if (distances.has(neighborId)) {
          continue;
        }

        distances.set(neighborId, currentDistance + 1);
        queue.push(neighborId);
      }
    }
  }

  return best;
}

function findBestScrapCandidate(board: BoardCell[]): InternalPatternCandidate | null {
  const occupied = getOccupiedCells(board);

  if (occupied.length < 2) {
    return null;
  }

  const components = getConnectedComponents(board, occupied);
  let best: InternalPatternCandidate | null = null;

  for (const component of components) {
    const stackScore = component.reduce((total, cell) => total + Math.max(1, cell.stackLevel), 0);
    const edgeCount = countUndirectedAdjacencyEdges(board, component);
    const compactnessBonus = getCompactnessBonus(component);
    const symmetryBonus = getSymmetryBonus(component) * 0.35;
    const structureWeight = component.length + Math.max(0, stackScore - component.length) * 0.55;
    const geometryBonus = edgeCount * 0.68 + compactnessBonus + symmetryBonus;
    const score = Math.round((structureWeight + geometryBonus) * 10) / 10;
    const tier = getPatternTier(score);
    const templateId: PatternTemplateId =
      component.length >= 4 ? "scrap-dense-cluster" : component.length === 3 ? "scrap-l-cluster" : "scrap-adjacent-pair";
    const candidate: InternalPatternCandidate = {
      ideology: "scrap",
      templateId,
      templateLabel: "Scrap Density",
      contributingCells: component,
      score,
      tier,
      breakdown: {
        structureWeight: Math.round(structureWeight * 10) / 10,
        geometryBonus: Math.round(geometryBonus * 10) / 10,
        wildcardBonus: 0,
        modifierBonus: Math.round((compactnessBonus + symmetryBonus) * 10) / 10,
        totalScore: score
      },
      explanation:
        tier === "none"
          ? `Scrap mass scored ${score}; density is present but cluster symmetry is still weak.`
          : `Scrap mass reached ${tier} with score ${score} via dense clustered occupancy.`
    };

    if (
      !best ||
      candidate.score > best.score ||
      candidate.contributingCells.length > best.contributingCells.length
    ) {
      best = candidate;
    }
  }

  return best;
}

function findBestTechCandidate(board: BoardCell[]): InternalPatternCandidate | null {
  const components = getGraphComponents(board, getConnectionEdges(board, "tech"));

  if (components.length === 0) {
    return null;
  }

  let best: InternalPatternCandidate | null = null;

  for (const component of components) {
    const structureWeight = component.cells.length * 1.12;
    const disciplineBonus = component.ringDiscipline;
    const symmetryBonus = component.symmetryBonus * 1.1;
    const chaosPenalty =
      component.longChordPenalty +
      Math.max(0, component.edgeCount - (component.cells.length + 1)) * 0.6;
    const geometryBonus =
      component.edgeCount * 1.24 +
      Math.max(0, component.longestPath - 1) * 0.52 +
      Math.max(0, component.maxDegree - 2) * 1.2 +
      disciplineBonus +
      symmetryBonus -
      chaosPenalty;
    const score = Math.round(Math.max(0, structureWeight + geometryBonus) * 10) / 10;
    const tier = getPatternTier(score);
    const templateId: PatternTemplateId =
      component.maxDegree >= 3
        ? "tech-t-junction"
        : component.longestPath >= 4
          ? "tech-straight-line"
          : "tech-bent-chain";
    const candidate: InternalPatternCandidate = {
      ideology: "tech",
      templateId,
      templateLabel: "Tech Routing",
      contributingCells: component.cells,
      score,
      tier,
      breakdown: {
        structureWeight: Math.round(structureWeight * 10) / 10,
        geometryBonus: Math.round((geometryBonus - symmetryBonus - disciplineBonus + chaosPenalty) * 10) / 10,
        wildcardBonus: 0,
        modifierBonus: Math.round((component.edgeCount * 0.1 + disciplineBonus + symmetryBonus - chaosPenalty) * 10) / 10,
        totalScore: score
      },
      explanation:
        tier === "none"
          ? `Tech routing scored ${score}; line discipline is too noisy for a strong route.`
          : `Tech routing reached ${tier} with score ${score} from disciplined angular links.`
    };

    if (
      !best ||
      candidate.score > best.score ||
      candidate.contributingCells.length > best.contributingCells.length
    ) {
      best = candidate;
    }
  }

  return best;
}

function findBestMagicCandidate(board: BoardCell[]): InternalPatternCandidate | null {
  const components = getGraphComponents(board, getConnectionEdges(board, "magic"));

  if (components.length === 0) {
    return null;
  }

  let best: InternalPatternCandidate | null = null;

  for (const component of components) {
    const uniqueRings = new Set(component.cells.map((cell) => cell.ring)).size;
    const structureWeight = component.cells.length * 1.08;
    const resonanceBalance = component.symmetryBonus * 1.2 + component.ringDiscipline * 0.35;
    const chaosPenalty = component.longChordPenalty * 0.8;
    const geometryBonus =
      component.edgeCount * 1.06 +
      component.cycleCount * 2.2 +
      Math.max(0, component.longestPath - 1) * 0.45 +
      uniqueRings * 0.34 +
      resonanceBalance -
      chaosPenalty;
    const score = Math.round(Math.max(0, structureWeight + geometryBonus) * 10) / 10;
    const tier = getPatternTier(score);
    const templateId: PatternTemplateId =
      component.cycleCount > 0 ? "magic-diamond-ring" : "magic-arc-3";
    const candidate: InternalPatternCandidate = {
      ideology: "magic",
      templateId,
      templateLabel: "Magic Resonance",
      contributingCells: component.cells,
      score,
      tier,
      breakdown: {
        structureWeight: Math.round(structureWeight * 10) / 10,
        geometryBonus: Math.round((geometryBonus - resonanceBalance + chaosPenalty) * 10) / 10,
        wildcardBonus: 0,
        modifierBonus: Math.round((component.cycleCount * 0.3 + resonanceBalance - chaosPenalty) * 10) / 10,
        totalScore: score
      },
      explanation:
        tier === "none"
          ? `Magic resonance scored ${score}; arcs need cleaner balanced loops.`
          : `Magic resonance reached ${tier} with score ${score} through balanced arcs and rings.`
    };

    if (
      !best ||
      candidate.score > best.score ||
      candidate.contributingCells.length > best.contributingCells.length
    ) {
      best = candidate;
    }
  }

  return best;
}

function toPatternMatch(candidate: InternalPatternCandidate): PatternMatch | null {
  if (candidate.tier === "none") {
    return null;
  }

  return {
    ideology: candidate.ideology,
    templateId: candidate.templateId,
    templateLabel: candidate.templateLabel,
    tier: candidate.tier,
    score: candidate.score,
    explanation: candidate.explanation,
    contributingCellIds: candidate.contributingCells.map((cell) => cell.id),
    contributingCoordinates: candidate.contributingCells.map(getCoordinate),
    breakdown: candidate.breakdown
  };
}

function toDebugEntry(ideology: Ideology, candidate: InternalPatternCandidate | null): PatternDebugEntry {
  if (!candidate) {
    return createEmptyDebugEntry(ideology);
  }

  return {
    ideology,
    active: candidate.tier !== "none",
    tier: candidate.tier,
    score: candidate.score,
    templateId: candidate.templateId,
    templateLabel: candidate.templateLabel,
    explanation: candidate.explanation,
    contributingCellIds: candidate.contributingCells.map((cell) => cell.id),
    contributingCoordinates: candidate.contributingCells.map(getCoordinate),
    breakdown: candidate.breakdown
  };
}

function buildBasePatternState(board: BoardCell[]): PatternState {
  const next = createEmptyPatternState();
  const candidates: Record<Ideology, InternalPatternCandidate | null> = {
    scrap: findBestScrapCandidate(board),
    tech: findBestTechCandidate(board),
    magic: findBestMagicCandidate(board)
  };

  for (const ideology of IDEOLOGIES) {
    const candidate = candidates[ideology];
    next.debug[ideology] = toDebugEntry(ideology, candidate);
    const match = candidate ? toPatternMatch(candidate) : null;
    next.byIdeology[ideology] = match;

    if (!match) {
      continue;
    }

    for (const cellId of match.contributingCellIds) {
      const highlights = next.tileHighlights[cellId] ?? [];
      if (!highlights.includes(ideology)) {
        next.tileHighlights[cellId] = [...highlights, ideology];
      }
    }
  }

  return next;
}

function getPlanningCells(board: BoardCell[]): BoardCell[] {
  const occupied = getOccupiedCells(board);

  if (occupied.length === 0) {
    return board.filter((cell) => cell.terrain !== "core" && cell.structureId === null);
  }

  const occupiedIdSet = new Set(occupied.map((cell) => cell.id));

  return board.filter((cell) => {
    if (cell.terrain === "core" || cell.structureId !== null) {
      return false;
    }

    return getRadialNeighbors(board, cell).some((neighbor) => occupiedIdSet.has(neighbor.id));
  });
}

function buildPlacementRecommendationsForStructure(
  board: BoardCell[],
  base: PatternState,
  selectedStructureId: StructureId
): PlacementRecommendation[] {
  const planningCells = getPlanningCells(board);
  const recommendations: PlacementRecommendation[] = [];

  for (const cell of planningCells) {
    const projectedBoard = board.map((candidate) =>
      candidate.id === cell.id
        ? {
            ...candidate,
            structureId: selectedStructureId,
            stackLevel: 1,
            connections: [],
            condition: 3,
            damage: "healthy" as const
          }
        : candidate
    );
    const projected = buildBasePatternState(projectedBoard);
    const improvements = IDEOLOGIES.filter(
      (ideology) =>
        (projected.byIdeology[ideology]?.score ?? 0) > (base.byIdeology[ideology]?.score ?? 0)
    );
    const totalDelta = improvements.reduce(
      (total, ideology) =>
        total +
        ((projected.byIdeology[ideology]?.score ?? 0) -
          (base.byIdeology[ideology]?.score ?? 0)),
      0
    );

    if (improvements.length === 0) {
      continue;
    }

    recommendations.push({
      cellId: cell.id,
      ideologies: improvements,
      score: Math.round(totalDelta * 10) / 10,
      tier: totalDelta >= 2.5 ? "best" : totalDelta >= 1.2 ? "good" : "possible"
    });
  }

  return recommendations
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

function hasAnyConnectionBetween(left: BoardCell, right: BoardCell): boolean {
  return left.connections.some((connection) => connection.toCellId === right.id);
}

function addNeutralConnectionProjection(
  board: BoardCell[],
  fromCellId: string,
  toCellId: string
): BoardCell[] {
  return board.map((cell) => {
    if (cell.id === fromCellId) {
      const withoutTarget = cell.connections.filter((connection) => connection.toCellId !== toCellId);
      return {
        ...cell,
        connections: [...withoutTarget, { toCellId }]
      };
    }

    if (cell.id === toCellId) {
      const withoutTarget = cell.connections.filter((connection) => connection.toCellId !== fromCellId);
      return {
        ...cell,
        connections: [...withoutTarget, { toCellId: fromCellId }]
      };
    }

    return cell;
  });
}

function buildPlacementRecommendationsForConnection(
  board: BoardCell[],
  base: PatternState
): PlacementRecommendation[] {
  const builtCells = board.filter((cell) => cell.structureId !== null && cell.terrain !== "core");
  const bestByCellId = new Map<
    string,
    {
      score: number;
      ideologies: Ideology[];
    }
  >();

  for (let index = 0; index < builtCells.length; index += 1) {
    for (let neighborIndex = index + 1; neighborIndex < builtCells.length; neighborIndex += 1) {
      const left = builtCells[index];
      const right = builtCells[neighborIndex];
      const existingConnection = hasAnyConnectionBetween(left, right);

      if (existingConnection) {
        continue;
      }

      if (left.connections.length >= 3 || right.connections.length >= 3) {
        continue;
      }

      const projectedBoard = addNeutralConnectionProjection(board, left.id, right.id);
      const projected = buildBasePatternState(projectedBoard);
      const improvements = (["tech", "magic"] as const).filter((ideology) => {
        const before = base.byIdeology[ideology]?.score ?? 0;
        const after = projected.byIdeology[ideology]?.score ?? 0;
        return after > before;
      });
      const delta = improvements.reduce((total, ideology) => {
        const before = base.byIdeology[ideology]?.score ?? 0;
        const after = projected.byIdeology[ideology]?.score ?? 0;
        return total + (after - before);
      }, 0);

      if (delta <= 0 || improvements.length === 0) {
        continue;
      }

      for (const cellId of [left.id, right.id]) {
        const current = bestByCellId.get(cellId);

        if (!current || delta > current.score) {
          bestByCellId.set(cellId, {
            score: delta,
            ideologies: improvements
          });
        }
      }
    }
  }

  return [...bestByCellId.entries()]
    .map(([cellId, payload]) => {
      const score = Math.round(payload.score * 10) / 10;
      const tier = score >= 2 ? "best" : score >= 1 ? "good" : "possible";

      return {
        cellId,
        ideologies: payload.ideologies,
        score,
        tier
      } satisfies PlacementRecommendation;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

export function detectPatternState(
  board: BoardCell[],
  options: DetectionOptions = {}
): PatternState {
  const next = buildBasePatternState(board);

  if (options.selectedStructureId) {
    next.placementRecommendations = buildPlacementRecommendationsForStructure(
      board,
      next,
      options.selectedStructureId
    );
  } else if (options.connectModeEnabled) {
    next.placementRecommendations = buildPlacementRecommendationsForConnection(
      board,
      next
    );
  } else {
    next.placementRecommendations = [];
  }

  if (!options.selectedStructureId && !options.connectModeEnabled) {
    next.projectedTileHighlights = {};
    return next;
  }

  next.projectedTileHighlights = Object.fromEntries(
    next.placementRecommendations.slice(0, 8).map((recommendation) => [
      recommendation.cellId,
      recommendation.ideologies
    ])
  );

  return next;
}
