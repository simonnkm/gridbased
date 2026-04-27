import type { BoardCell } from "../state/types";

export function canPlaceOnCell(cell: BoardCell): boolean {
  return cell.terrain !== "core" && cell.structureId === null;
}

export function canDismantleCell(cell: BoardCell): boolean {
  return cell.terrain !== "core" && cell.structureId !== null;
}

