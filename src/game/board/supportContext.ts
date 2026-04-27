import type { BoardCell } from "../state/types";
import { getRadialNeighbors } from "./radialTopology";

export function getOrthogonalNeighbors(board: BoardCell[], row: number, col: number): BoardCell[] {
  const target = board.find((cell) => cell.row === row && cell.col === col);

  if (!target) {
    return [];
  }

  return getRadialNeighbors(board, target);
}

export function getLocalDensity(board: BoardCell[], row: number, col: number): number {
  return getOrthogonalNeighbors(board, row, col).filter((cell) => cell.structureId !== null).length;
}
