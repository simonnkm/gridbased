import type { BoardCell, StructureId } from "../state/types";
import type { Ideology, PatternState, PlacementRecommendation } from "./types";
import { getRadialNeighbors, getRadialSitePoint } from "../board/radialTopology";

interface IdeologyWeightMap {
  scrap: number;
  tech: number;
  magic: number;
}

export interface VisualizationPoint {
  x: number;
  y: number;
}

export interface VisualizationAnchor {
  id: string;
  cellId: string;
  row: number;
  col: number;
  point: VisualizationPoint;
  projected: boolean;
  weights: IdeologyWeightMap;
  nodeIdeology: Ideology | null;
}

export interface VisualizationStroke {
  ideology: Ideology;
  cellIds: string[];
  points: VisualizationPoint[];
  projected: boolean;
  emphasized: boolean;
  reinforcement: number;
  closed: boolean;
}

export interface VisualizationJunction {
  ideology: "tech";
  cellId: string;
  point: VisualizationPoint;
  projected: boolean;
  emphasized: boolean;
  reinforcement: number;
}

export interface VisualizationBlob {
  ideology: "scrap";
  cellIds: string[];
  projected: boolean;
  emphasized: boolean;
  reinforcement: number;
  circles: Array<{
    point: VisualizationPoint;
    radius: number;
  }>;
  bridges: Array<{
    from: VisualizationPoint;
    to: VisualizationPoint;
    width: number;
  }>;
}

export interface PatternVisualization {
  anchors: VisualizationAnchor[];
  techPaths: VisualizationStroke[];
  techJunctions: VisualizationJunction[];
  magicPaths: VisualizationStroke[];
  scrapBlobs: VisualizationBlob[];
  recommendationCells: PlacementRecommendation[];
}

interface EdgeCandidate {
  left: VisualizationAnchor;
  right: VisualizationAnchor;
}

const NODE_IDEOLOGY_BY_STRUCTURE_ID: Partial<Record<StructureId, Ideology>> = {
  "scrap-bastion": "scrap"
};

function createEmptyWeights(): IdeologyWeightMap {
  return {
    scrap: 0,
    tech: 0,
    magic: 0
  };
}

function getScrapPresenceForCell(cell: BoardCell): number {
  if (cell.structureId === null || cell.terrain === "core") {
    return 0;
  }

  return 1 + Math.max(0, cell.stackLevel - 1) * 0.45;
}

function hasIdeology(
  cell: Pick<BoardCell, "appliedIdeology" | "appliedIdeologies">,
  ideology: Ideology
): boolean {
  if (ideology === "scrap") {
    return false;
  }

  if (cell.appliedIdeologies.includes(ideology)) {
    return true;
  }

  return cell.appliedIdeology === ideology;
}

function getPrimaryIdeology(cell: Pick<BoardCell, "appliedIdeology" | "appliedIdeologies">): Ideology | null {
  if (cell.appliedIdeologies.length > 0) {
    return cell.appliedIdeologies[0];
  }

  return cell.appliedIdeology;
}

function getMatchingConnectionCount(
  cell: BoardCell,
  boardById: Map<string, BoardCell>,
  ideology: Ideology
): number {
  if (cell.structureId === null || cell.terrain === "core" || !hasIdeology(cell, ideology)) {
    return 0;
  }

  let count = 0;

  for (const connection of cell.connections) {
    const target = boardById.get(connection.toCellId);

    if (!target || !target.structureId || target.terrain === "core") {
      continue;
    }

    if (hasIdeology(target, ideology)) {
      count += 1;
    }
  }

  return count;
}

function getConnectionPresenceForCell(
  cell: BoardCell,
  boardById: Map<string, BoardCell>,
  ideology: Ideology
): number {
  if (cell.structureId === null || cell.terrain === "core") {
    return 0;
  }

  const edgeCount = getMatchingConnectionCount(cell, boardById, ideology);

  if (edgeCount <= 0) {
    return hasIdeology(cell, ideology) ? 1 : 0;
  }

  return 1 + Math.min(2, edgeCount - 1) * 0.3;
}

export function buildPatternVisualization(
  board: BoardCell[],
  patterns: PatternState,
  selectedStructureId: StructureId | null
): PatternVisualization {
  const cellsById = new Map(board.map((cell) => [cell.id, cell]));
  const actualAnchors = buildActualAnchors(board);
  const projectedAnchors = buildProjectedAnchors(cellsById, patterns, selectedStructureId);
  const anchors = [...actualAnchors, ...projectedAnchors];
  const activeCellIds = {
    scrap: new Set(patterns.byIdeology.scrap?.contributingCellIds ?? []),
    tech: new Set(patterns.byIdeology.tech?.contributingCellIds ?? []),
    magic: new Set(patterns.byIdeology.magic?.contributingCellIds ?? [])
  };

  return {
    anchors,
    techPaths: buildConnectionStrokes(board, anchors, "tech", activeCellIds.tech),
    techJunctions: buildTechJunctions(anchors, board, activeCellIds.tech),
    magicPaths: buildConnectionStrokes(board, anchors, "magic", activeCellIds.magic),
    scrapBlobs: buildScrapShapes(board, anchors, activeCellIds.scrap),
    recommendationCells: patterns.placementRecommendations
  };
}

function buildActualAnchors(board: BoardCell[]): VisualizationAnchor[] {
  const boardById = new Map(board.map((cell) => [cell.id, cell]));

  return board.flatMap((cell) => {
    if (cell.terrain === "core" || !cell.structureId) {
      return [];
    }

    const nodeIdeology =
      getPrimaryIdeology(cell) ??
      NODE_IDEOLOGY_BY_STRUCTURE_ID[cell.structureId] ??
      null;
    const weights = createEmptyWeights();
    weights.scrap = getScrapPresenceForCell(cell);
    weights.tech = getConnectionPresenceForCell(cell, boardById, "tech");
    weights.magic = getConnectionPresenceForCell(cell, boardById, "magic");

    return [
      {
        id: cell.id,
        cellId: cell.id,
        row: cell.row,
        col: cell.col,
        point: toCellPoint(cell),
        projected: false,
        weights,
        nodeIdeology
      }
    ];
  });
}

function buildProjectedAnchors(
  cellsById: Map<string, BoardCell>,
  patterns: PatternState,
  selectedStructureId: StructureId | null
): VisualizationAnchor[] {
  if (selectedStructureId) {
    return patterns.placementRecommendations.slice(0, 6).flatMap((recommendation, index) => {
      const cell = cellsById.get(recommendation.cellId);

      if (!cell) {
        return [];
      }

      const weights = createEmptyWeights();
      weights.scrap = 1;
      if (recommendation.ideologies.includes("tech")) {
        weights.tech = 1;
      }
      if (recommendation.ideologies.includes("magic")) {
        weights.magic = 1;
      }

      return [
        {
          id: `${cell.id}:projected:${index}`,
          cellId: cell.id,
          row: cell.row,
          col: cell.col,
          point: toCellPoint(cell),
          projected: true,
          weights,
          nodeIdeology: null
        }
      ];
    });
  }

  return [];
}

function buildConnectionStrokes(
  board: BoardCell[],
  anchors: VisualizationAnchor[],
  ideology: "tech" | "magic",
  activeCellIds: Set<string>
): VisualizationStroke[] {
  const anchorByCellId = new Map(
    anchors
      .filter((anchor) => anchor.weights.scrap > 0 || anchor.weights[ideology] > 0)
      .map((anchor) => [anchor.cellId, anchor])
  );
  const edgeMap = new Map<string, EdgeCandidate>();

  for (const cell of board) {
    if (!cell.structureId) {
      continue;
    }

    for (const connection of cell.connections) {
      const left = anchorByCellId.get(cell.id);
      const right = anchorByCellId.get(connection.toCellId);

      if (!left || !right) {
        continue;
      }

      if (!hasIdeology(cell, ideology)) {
        continue;
      }

      const targetCell = board.find((entry) => entry.id === connection.toCellId);

      if (!targetCell || !hasIdeology(targetCell, ideology)) {
        continue;
      }

      const key = [left.cellId, right.cellId].sort().join(":");

      if (!edgeMap.has(key)) {
        edgeMap.set(key, { left, right });
      }
    }
  }

  const edges = [...edgeMap.values()];
  const strokes: VisualizationStroke[] = edges.map((edge) => {
    const reinforced =
      edge.left.nodeIdeology === ideology || edge.right.nodeIdeology === ideology;
    const emphasized =
      !edge.left.projected &&
      !edge.right.projected &&
      activeCellIds.has(edge.left.cellId) &&
      activeCellIds.has(edge.right.cellId);

    return {
      ideology,
      cellIds: [edge.left.cellId, edge.right.cellId],
      points:
        ideology === "tech"
          ? buildTechPathPoints(edge.left, edge.right)
          : buildMagicArcPoints(edge.left, edge.right),
      projected: edge.left.projected || edge.right.projected,
      emphasized,
      reinforcement: reinforced ? 1 : 0,
      closed: false
    };
  });

  if (ideology === "magic") {
    const closed = buildMagicClosedStroke(strokes, anchors, activeCellIds);

    if (closed) {
      strokes.push(closed);
    }
  }

  return strokes;
}

function buildTechJunctions(
  anchors: VisualizationAnchor[],
  board: BoardCell[],
  activeCellIds: Set<string>
): VisualizationJunction[] {
  const byCellId = new Map(board.map((cell) => [cell.id, cell]));

  return anchors
    .filter((anchor) => !anchor.projected)
    .flatMap((anchor) => {
      const cell = byCellId.get(anchor.cellId);

      if (!cell || !cell.structureId) {
        return [];
      }

      const techDegree = cell.connections.filter((connection) => {
        const target = byCellId.get(connection.toCellId);

        if (!target || target.structureId === null) {
          return false;
        }

        return hasIdeology(target, "tech") && hasIdeology(cell, "tech");
      }).length;

      if (techDegree < 3) {
        return [];
      }

      return [
        {
          ideology: "tech",
          cellId: anchor.cellId,
          point: anchor.point,
          projected: false,
          emphasized: activeCellIds.has(anchor.cellId),
          reinforcement: anchor.nodeIdeology === "tech" ? 1 : 0
        }
      ];
    });
}

function buildMagicClosedStroke(
  strokes: VisualizationStroke[],
  anchors: VisualizationAnchor[],
  activeCellIds: Set<string>
): VisualizationStroke | null {
  const connectedCellIds = new Set(
    strokes
      .filter((stroke) => stroke.ideology === "magic")
      .flatMap((stroke) => stroke.cellIds)
  );
  const ringAnchors = anchors.filter(
    (anchor) =>
      !anchor.projected &&
      connectedCellIds.has(anchor.cellId)
  );

  if (ringAnchors.length < 3) {
    return null;
  }

  return {
    ideology: "magic",
    cellIds: [...new Set(ringAnchors.map((anchor) => anchor.cellId))],
    points: buildClosedMagicPoints(ringAnchors),
    projected: false,
    emphasized: ringAnchors.some((anchor) => activeCellIds.has(anchor.cellId)),
    reinforcement: ringAnchors.some((anchor) => anchor.nodeIdeology === "magic") ? 1 : 0,
    closed: true
  };
}

function buildScrapShapes(
  board: BoardCell[],
  anchors: VisualizationAnchor[],
  activeCellIds: Set<string>
): VisualizationBlob[] {
  const byCellId = new Map(anchors.map((anchor) => [anchor.cellId, anchor]));
  const occupiedCells = board.filter((cell) => cell.structureId !== null);
  const components = getOccupiedComponents(board, occupiedCells);

  return components.map((component) => {
    const componentAnchors = component
      .map((cell) => byCellId.get(cell.id))
      .filter((anchor): anchor is VisualizationAnchor => Boolean(anchor));
    const circles = componentAnchors.map((anchor) => ({
      point: anchor.point,
      radius: 0.24 + Math.max(0, anchor.weights.scrap - 1) * 0.08
    }));
    const bridges: VisualizationBlob["bridges"] = [];

    for (let index = 0; index < componentAnchors.length; index += 1) {
      for (let neighborIndex = index + 1; neighborIndex < componentAnchors.length; neighborIndex += 1) {
        const left = componentAnchors[index];
        const right = componentAnchors[neighborIndex];
        const distance = getGridDistance(left, right);

        if (distance > 1.8) {
          continue;
        }

        bridges.push({
          from: left.point,
          to: right.point,
          width: 0.18 + Math.max(left.weights.scrap, right.weights.scrap) * 0.05
        });
      }
    }

    return {
      ideology: "scrap",
      cellIds: componentAnchors.map((anchor) => anchor.cellId),
      projected: false,
      emphasized: componentAnchors.some((anchor) => activeCellIds.has(anchor.cellId)),
      reinforcement: componentAnchors.some((anchor) => anchor.nodeIdeology === "scrap") ? 1 : 0,
      circles,
      bridges
    };
  });
}

function getOccupiedComponents(board: BoardCell[], occupied: BoardCell[]): BoardCell[][] {
  const idSet = new Set(occupied.map((cell) => cell.id));
  const byId = new Map(occupied.map((cell) => [cell.id, cell]));
  const visited = new Set<string>();
  const components: BoardCell[][] = [];

  for (const cell of occupied) {
    if (visited.has(cell.id)) {
      continue;
    }

    const queue = [cell.id];
    const component: BoardCell[] = [];
    visited.add(cell.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = byId.get(currentId);

      if (!current) {
        continue;
      }

      component.push(current);

      for (const neighbor of getRadialNeighbors(board, current)) {
        if (!idSet.has(neighbor.id) || visited.has(neighbor.id)) {
          continue;
        }

        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }

    components.push(component);
  }

  return components;
}

function buildTechPathPoints(left: VisualizationAnchor, right: VisualizationAnchor): VisualizationPoint[] {
  const deltaX = right.point.x - left.point.x;
  const deltaY = right.point.y - left.point.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return [left.point, { x: right.point.x, y: left.point.y }, right.point];
  }

  return [left.point, { x: left.point.x, y: right.point.y }, right.point];
}

function buildMagicArcPoints(left: VisualizationAnchor, right: VisualizationAnchor): VisualizationPoint[] {
  const midpoint = {
    x: (left.point.x + right.point.x) / 2,
    y: (left.point.y + right.point.y) / 2
  };
  const deltaX = right.point.x - left.point.x;
  const deltaY = right.point.y - left.point.y;
  const distance = Math.max(0.001, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
  const normal = {
    x: -deltaY / distance,
    y: deltaX / distance
  };
  const bend = 0.26 + Math.min(0.22, distance * 0.08);

  return [
    left.point,
    {
      x: midpoint.x + normal.x * bend,
      y: midpoint.y + normal.y * bend
    },
    right.point
  ];
}

function buildClosedMagicPoints(anchors: VisualizationAnchor[]): VisualizationPoint[] {
  const centroid = {
    x: anchors.reduce((total, anchor) => total + anchor.point.x, 0) / anchors.length,
    y: anchors.reduce((total, anchor) => total + anchor.point.y, 0) / anchors.length
  };
  const ordered = [...anchors].sort((left, right) => {
    const leftAngle = Math.atan2(left.point.y - centroid.y, left.point.x - centroid.x);
    const rightAngle = Math.atan2(right.point.y - centroid.y, right.point.x - centroid.x);

    return leftAngle - rightAngle;
  });

  return [...ordered.map((anchor) => anchor.point), ordered[0].point];
}

function getGridDistance(left: VisualizationAnchor, right: VisualizationAnchor): number {
  const rowDelta = left.row - right.row;
  const colDelta = left.col - right.col;

  return Math.sqrt(rowDelta * rowDelta + colDelta * colDelta);
}

function toCellPoint(
  cell: Pick<BoardCell, "row" | "col"> & Partial<Pick<BoardCell, "ring" | "sector">>
): VisualizationPoint {
  if (typeof cell.ring === "number" && typeof cell.sector === "number") {
    return getRadialSitePoint({
      ring: cell.ring,
      sector: cell.sector
    });
  }

  return {
    x: cell.col + 0.5,
    y: cell.row + 0.5
  };
}

export function getIdeologyColor(ideology: Ideology): number {
  switch (ideology) {
    case "scrap":
      return 0xd9b238;
    case "tech":
      return 0x3f7fcb;
    case "magic":
      return 0xbf3d3d;
  }
}

export function getActiveIdeologyWeights(weights: IdeologyWeightMap): Ideology[] {
  return (["scrap", "tech", "magic"] as Ideology[]).filter((ideology) => weights[ideology] > 0);
}
