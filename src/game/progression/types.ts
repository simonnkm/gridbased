import type { RaidCardPool } from "../../data/progression";
import type { Ideology, PatternTier } from "../patterns/types";

export interface IdeologyProgressionState {
  ideology: Ideology;
  currentTier: PatternTier;
  currentPatternLabel: string | null;
  currentScore: number;
  barValue: number;
  nextThresholdValue: number | null;
  doctrineIds: string[];
  buildCardIds: string[];
  supportCardIds: string[];
  attackCardIds: string[];
  unlockedPassiveIds: string[];
  activePassiveIds: string[];
  latestUnlockedIds: string[];
}

export interface ProgressionState {
  discoveredUnlockIds: string[];
  discoveredAtTurn: Record<string, number>;
  latestUnlockedIds: string[];
  raidPools: Record<RaidCardPool, string[]>;
  activePassiveIds: string[];
  byIdeology: Record<Ideology, IdeologyProgressionState>;
}
