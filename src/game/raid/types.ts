import type { RaidCardPool } from "../../data/progression";
import type { Ideology, PatternTier } from "../patterns/types";
import type { StructureDamageState, StructureId } from "../state/types";

export type RaidLayerId = "outer" | "mid" | "inner";
export type RaidCardIdeology = Ideology | "neutral";
export type RaidCardSourceType = "structure" | "unlock" | "reward";
export type RaidCardCategory = "attack" | "block" | "support" | "special";
export type RaidCombatRole =
  | "defense"
  | "burst"
  | "sustain"
  | "tempo"
  | "utility"
  | "ideology-payoff";
export type RaidEnemyArchetype = "scrap" | "tech" | "cult";
export type RaidEnemyCardCategory = "attack" | "block" | "support" | "special";
export type RaidCombatCardEffectType =
  | "attack"
  | "block"
  | "heal"
  | "draw"
  | "weaken"
  | "repair";
export type RaidEnemyCardEffectType =
  | "damage"
  | "guard"
  | "heal"
  | "shred-block"
  | "drain-integrity";

export interface RaidLayerStructureState {
  cellId: string;
  row: number;
  col: number;
  structureId: StructureId;
  title: string;
  condition: number;
  status: "healthy" | "damaged" | "destroyed";
  raidDefense: number;
}

export interface RaidLayerState {
  id: RaidLayerId;
  label: string;
  collapseThresholdRatio: number;
  compromised: boolean;
  structures: RaidLayerStructureState[];
}

export interface RaidPatternSummary {
  ideology: Ideology;
  templateLabel: string;
  tier: PatternTier;
  score: number;
}

export interface RaidStructureSummary {
  structureId: StructureId;
  title: string;
  count: number;
  damagedCount: number;
  destroyedCount: number;
  raidDefense: number;
  layerIds: RaidLayerId[];
}

export interface RaidCombatCardEffect {
  type: RaidCombatCardEffectType;
  amount: number;
}

export interface RaidCombatCard {
  id: string;
  templateId: string;
  title: string;
  summary: string;
  cost: number;
  drawWeight: number;
  sourceCount: number;
  category: RaidCardCategory;
  ideology: RaidCardIdeology;
  ideologies: RaidCardIdeology[];
  sourceType: RaidCardSourceType;
  sourceTitle: string;
  sourceLayerId: RaidLayerId | null;
  originCellId: string | null;
  sourcePool: RaidCardPool | "structure" | "reward";
  effects: RaidCombatCardEffect[];
  noteLines: string[];
  role?: RaidCombatRole;
  sourceTitles?: string[];
}

export interface RaidEnemyCardEffect {
  type: RaidEnemyCardEffectType;
  amount: number;
}

export interface RaidEnemyCard {
  id: string;
  title: string;
  summary: string;
  category: RaidEnemyCardCategory;
  archetype: RaidEnemyArchetype;
  effects: RaidEnemyCardEffect[];
}

export interface RaidPreviewBreakdown {
  projectedAttack: number;
  projectedBlock: number;
  projectedHeal: number;
  projectedDraw: number;
  projectedWeaken: number;
  projectedSettlementIntegrity: number;
  projectedRaidStrength: number;
  selectedCardLines: string[];
  enemyChoiceTitle: string | null;
  enemyChoiceSummary: string;
}

export interface RaidBoardUpdate {
  cellId: string;
  structureId: StructureId | null;
  condition: number;
  damage: StructureDamageState;
}

export interface RaidOutcome {
  survived: boolean;
  roundsResolved: number;
  settlementIntegrityLoss: number;
  damagedCount: number;
  destroyedCount: number;
  compromisedLayerIds: RaidLayerId[];
  boardUpdates: RaidBoardUpdate[];
  rewards: {
    materials: number;
    progress: number;
    intel: number;
    core: number;
  };
  reasonLines: string[];
}

export interface RaidState {
  turn: number;
  incomingRaidId: string;
  incomingRaidTitle: string;
  incomingRaidSummary: string;
  enemyArchetype: RaidEnemyArchetype;
  enemyArchetypeTitle: string;
  enemyArchetypeSummary: string;
  activePatterns: RaidPatternSummary[];
  builtStructures: RaidStructureSummary[];
  layers: RaidLayerState[];
  settlementIntegrity: number;
  maxSettlementIntegrity: number;
  settlementBlock: number;
  enemyWeaken: number;
  raidStrength: number;
  maxRaidStrength: number;
  raidGuard: number;
  playerDrawPile: RaidCombatCard[];
  playerDiscardPile: RaidCombatCard[];
  playerHand: RaidCombatCard[];
  selectedPlayerCardIds: string[];
  playerHandSize: number;
  maxEnergyPerTurn: number;
  energySpentThisTurn: number;
  enemyDrawPile: RaidEnemyCard[];
  enemyDiscardPile: RaidEnemyCard[];
  enemyHand: RaidEnemyCard[];
  enemyHandSize: number;
  turnNumber: number;
  preview: RaidPreviewBreakdown;
  combatLog: string[];
  outcome: RaidOutcome | null;
}
