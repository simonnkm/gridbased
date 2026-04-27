import type { BoardCell } from "../state/types";

interface CorePosition {
  row: number;
  col: number;
}

export interface RadialPoint {
  x: number;
  y: number;
}

function getCorePosition(boardSize: number): CorePosition {
  return {
    row: Math.floor(boardSize / 2),
    col: Math.floor(boardSize / 2)
  };
}

function getAngleFromNorthClockwise(
  row: number,
  col: number,
  core: CorePosition
): number {
  const deltaRow = row - core.row;
  const deltaCol = col - core.col;
  const angle = Math.atan2(deltaCol, -deltaRow);

  return (angle + Math.PI * 2) % (Math.PI * 2);
}

export function getRingForCell(
  boardSize: number,
  row: number,
  col: number
): number {
  const core = getCorePosition(boardSize);

  return Math.max(Math.abs(row - core.row), Math.abs(col - core.col));
}

export function getSectorCountForRing(ring: number): number {
  if (ring <= 0) {
    return 1;
  }

  return ring * 8;
}

export function normalizeSector(sector: number, sectorCount: number): number {
  return ((sector % sectorCount) + sectorCount) % sectorCount;
}

function getIntersectionCandidateSectors(
  sourceSector: number,
  sourceCount: number,
  targetCount: number
): number[] {
  const sourceStart = sourceSector / sourceCount;
  const sourceEnd = (sourceSector + 1) / sourceCount;
  const candidates = new Set<number>();
  const addCandidate = (index: number): void => {
    candidates.add(normalizeSector(index, targetCount));
  };

  addCandidate(Math.floor(sourceStart * targetCount));
  addCandidate(Math.floor((sourceEnd - 1e-6) * targetCount));
  const midpoint = ((sourceSector + 0.5) / sourceCount) * targetCount;
  addCandidate(Math.round(midpoint));

  const expanded = Array.from(candidates);

  for (const index of expanded) {
    addCandidate(index - 1);
    addCandidate(index + 1);
  }

  return Array.from(candidates).filter((targetSector) => {
    const targetStart = targetSector / targetCount;
    const targetEnd = (targetSector + 1) / targetCount;

    return sourceStart < targetEnd && sourceEnd > targetStart;
  });
}

export function assignRadialTopology(
  board: Array<
    Omit<BoardCell, "ring" | "sector"> & Partial<Pick<BoardCell, "ring" | "sector">>
  >,
  boardSize: number
): BoardCell[] {
  const core = getCorePosition(boardSize);
  const groupedByRing = new Map<number, BoardCell[]>();

  const seededBoard = board.map((cell) => {
    const ring = getRingForCell(boardSize, cell.row, cell.col);
    const nextCell: BoardCell = {
      ...cell,
      ring,
      sector: ring === 0 ? 0 : -1
    };
    const group = groupedByRing.get(ring) ?? [];

    group.push(nextCell);
    groupedByRing.set(ring, group);

    return nextCell;
  });

  for (const [ring, cells] of groupedByRing.entries()) {
    if (ring === 0) {
      continue;
    }

    const sorted = [...cells].sort((left, right) => {
      const leftAngle = getAngleFromNorthClockwise(left.row, left.col, core);
      const rightAngle = getAngleFromNorthClockwise(right.row, right.col, core);

      if (leftAngle !== rightAngle) {
        return leftAngle - rightAngle;
      }

      if (left.row !== right.row) {
        return left.row - right.row;
      }

      return left.col - right.col;
    });

    sorted.forEach((cell, index) => {
      cell.sector = index;
    });
  }

  return seededBoard;
}

export function getRadialNeighborIds(board: BoardCell[], cell: BoardCell): string[] {
  if (cell.terrain === "core") {
    return board
      .filter((candidate) => candidate.ring === 1)
      .map((candidate) => candidate.id);
  }

  const neighborIds = new Set<string>();
  const byRing = new Map<number, BoardCell[]>();

  for (const candidate of board) {
    if (candidate.terrain === "core") {
      continue;
    }

    const ringEntries = byRing.get(candidate.ring) ?? [];
    ringEntries.push(candidate);
    byRing.set(candidate.ring, ringEntries);
  }

  for (const ringEntries of byRing.values()) {
    ringEntries.sort((left, right) => left.sector - right.sector);
  }

  const sameRing = byRing.get(cell.ring);

  if (sameRing && sameRing.length > 1) {
    const sectorCount = sameRing.length;
    const leftSector = normalizeSector(cell.sector - 1, sectorCount);
    const rightSector = normalizeSector(cell.sector + 1, sectorCount);
    const left = sameRing.find((entry) => entry.sector === leftSector);
    const right = sameRing.find((entry) => entry.sector === rightSector);

    if (left) {
      neighborIds.add(left.id);
    }

    if (right) {
      neighborIds.add(right.id);
    }
  }

  for (const ringDelta of [-1, 1]) {
    const targetRing = cell.ring + ringDelta;

    if (targetRing < 0) {
      continue;
    }

    if (targetRing === 0) {
      const coreCell = board.find((candidate) => candidate.terrain === "core");

      if (coreCell) {
        neighborIds.add(coreCell.id);
      }

      continue;
    }

    const targetRingCells = byRing.get(targetRing);

    if (!targetRingCells || targetRingCells.length === 0) {
      continue;
    }

    const mappedSectors = getIntersectionCandidateSectors(
      cell.sector,
      sameRing?.length ?? getSectorCountForRing(cell.ring),
      targetRingCells.length
    );

    for (const mappedSector of mappedSectors) {
      const target = targetRingCells.find((entry) => entry.sector === mappedSector);

      if (target) {
        neighborIds.add(target.id);
      }
    }
  }

  return Array.from(neighborIds);
}

export function getRadialNeighbors(board: BoardCell[], cell: BoardCell): BoardCell[] {
  const idSet = new Set(getRadialNeighborIds(board, cell));

  return board.filter((candidate) => idSet.has(candidate.id));
}

export function getRadialSitePoint(cell: Pick<BoardCell, "ring" | "sector">): RadialPoint {
  if (cell.ring === 0) {
    return { x: 0, y: 0 };
  }

  const sectorCount = getSectorCountForRing(cell.ring);
  const angle = (cell.sector / sectorCount) * Math.PI * 2 - Math.PI / 2;

  return {
    x: Math.cos(angle) * cell.ring,
    y: Math.sin(angle) * cell.ring
  };
}

export function formatSiteLabel(
  cell: Pick<BoardCell, "terrain" | "ring" | "sector">
): string {
  if (cell.terrain === "core" || cell.ring === 0) {
    return "Core";
  }

  return `Ring ${cell.ring} / Sector ${cell.sector + 1}`;
}
