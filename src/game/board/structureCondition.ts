import type { BoardCell } from "../state/types";

export function hasLiveStructure(cell: BoardCell): boolean {
  return cell.structureId !== null;
}

export function getStructureConditionTier(cell: BoardCell): "none" | "critical" | "worn" | "stable" {
  if (cell.structureId === null) {
    return "none";
  }

  if (cell.condition <= 1) {
    return "critical";
  }

  if (cell.condition === 2) {
    return "worn";
  }

  return "stable";
}
