import type { CardInstance as BaseCardInstance } from "../core/types/card-model";
import type { PatternState } from "../patterns/types";
import type { ProgressionState } from "../progression/types";
import type { RaidCombatCard, RaidState } from "../raid/types";

export interface GridPosition {
  row: number;
  col: number;
}

export type StructureId =
  | "farm"
  | "mine"
  | "watchtower"
  | "well"
  | "muster-hall"
  | "workshop"
  | "barricade-yard"
  | "scrounge-depot"
  | "relay-pylon"
  | "junction-array"
  | "ward-sigil"
  | "ley-lantern"
  | "scrap-bastion";

export interface BoardCell {
  id: string;
  row: number;
  col: number;
  ring: number;
  sector: number;
  terrain: "ground" | "core";
  structureId: StructureId | null;
  stackLevel: number;
  appliedIdeologies: StructureIdeology[];
  // Legacy compatibility field; mirrors the first entry in appliedIdeologies when present.
  appliedIdeology: StructureIdeology | null;
  connections: StructureConnection[];
  condition: number;
  damage: StructureDamageState;
}

export type StructureDamageState = "healthy" | "worn" | "damaged" | "ruined";
export type StructureIdeology = "tech" | "magic";

export interface StructureConnection {
  toCellId: string;
}

export interface Resources {
  food: number;
  materials: number;
  core: number;
  progress: number;
  intel: number;
}

export interface IdeologyCardStock {
  tech: number;
  magic: number;
}

export type SalvageMode = "resources" | "application";

export type CardInstance = BaseCardInstance<
  "build",
  {
    structureId: StructureId;
  }
> & {
  structureId: StructureId;
};

export interface ActionMessage {
  tone: "info" | "success" | "error";
  text: string;
}

export interface ScoutReport {
  source: "raid" | "draw";
  title: string;
  detail: string;
}

export interface PostRaidRewardChoice {
  id: string;
  title: string;
  summary: string;
  kind: "combat-card" | "build-card" | "repair";
  combatCardTemplate: RaidCombatCard | null;
  buildCardStructureId: StructureId | null;
  repairCellId: string | null;
}

export interface PostRaidServiceHook {
  id: string;
  title: string;
  summary: string;
  available: boolean;
}

export interface TutorialState {
  visible: boolean;
  stepIndex: number;
  completed: boolean;
}

export interface GameState {
  boardSize: number;
  board: BoardCell[];
  boardViewMode: "build" | "pattern";
  patterns: PatternState;
  progression: ProgressionState;
  selectedTile: GridPosition | null;
  selectedCardInstanceId: string | null;
  selectedNodeStructureId: StructureId | null;
  connectModeEnabled: boolean;
  selectedIdeologyCard: StructureIdeology | null;
  ideologyApplicationsThisTurn: number;
  ideologyApplicationsPerTurnLimit: number;
  ideologyCardStock: IdeologyCardStock;
  applicationPoints: number;
  salvageMode: SalvageMode;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  nextCardSequence: number;
  turn: number;
  nextRaidTurn: number;
  nextRaidWindowStart: number;
  nextRaidWindowEnd: number;
  raidsSurvived: number;
  phase: "build" | "pre-raid" | "raid" | "post-raid" | "game-over" | "victory";
  raid: RaidState | null;
  combatCardPool: RaidCombatCard[];
  bonusCombatCards: RaidCombatCard[];
  activeCombatDeckTemplateIds: string[];
  focusedCombatCardTemplateIds: string[];
  hasCustomizedCombatDeck: boolean;
  activeCombatDeckMaxSize: number;
  postRaidRewardChoices: PostRaidRewardChoice[];
  claimedPostRaidRewardId: string | null;
  postRaidServiceHooks: PostRaidServiceHook[];
  nextRewardSequence: number;
  resources: Resources;
  tutorial: TutorialState;
  scoutReport: ScoutReport | null;
  message: ActionMessage | null;
  activityLog: string[];
}
