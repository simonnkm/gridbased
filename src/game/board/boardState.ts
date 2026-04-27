import type { BoardCell } from "../state/types";

export function getOccupiedBoardCells(board: BoardCell[]): BoardCell[] {
  return board.filter((cell) => cell.structureId !== null);
}

export function getBuildableBoardCells(board: BoardCell[]): BoardCell[] {
  return board.filter((cell) => cell.terrain !== "core" && cell.structureId === null);
}

