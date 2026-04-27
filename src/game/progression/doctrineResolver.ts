import { getProgressionUnlockDefinition } from "../../data/progression";
import type { ProgressionState } from "./types";

export function getUnlockedDoctrineIds(progression: ProgressionState): string[] {
  return progression.discoveredUnlockIds.filter(
    (unlockId) => getProgressionUnlockDefinition(unlockId).category === "doctrine"
  );
}

