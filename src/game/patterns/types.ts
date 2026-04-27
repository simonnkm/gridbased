export type Ideology = "scrap" | "tech" | "magic";

export type PatternTier = "none" | "small" | "medium" | "large";

export type PatternTemplateId =
  | "scrap-adjacent-pair"
  | "scrap-l-cluster"
  | "scrap-block-2x2"
  | "scrap-dense-cluster"
  | "tech-straight-line"
  | "tech-bent-chain"
  | "tech-t-junction"
  | "tech-loop-2x2"
  | "magic-triangle-2x2"
  | "magic-arc-3"
  | "magic-diamond-ring";

export interface PatternBreakdown {
  structureWeight: number;
  geometryBonus: number;
  wildcardBonus: number;
  modifierBonus: number;
  totalScore: number;
}

export interface PatternMatch {
  ideology: Ideology;
  templateId: PatternTemplateId;
  templateLabel: string;
  tier: Exclude<PatternTier, "none">;
  score: number;
  explanation: string;
  contributingCellIds: string[];
  contributingCoordinates: string[];
  breakdown: PatternBreakdown;
}

export interface PatternDebugEntry {
  ideology: Ideology;
  active: boolean;
  tier: PatternTier;
  score: number;
  templateId: PatternTemplateId | null;
  templateLabel: string;
  explanation: string;
  contributingCellIds: string[];
  contributingCoordinates: string[];
  breakdown: PatternBreakdown;
}

export type PlacementRecommendationTier = "best" | "good" | "possible";

export interface PlacementRecommendation {
  cellId: string;
  tier: PlacementRecommendationTier;
  ideologies: Ideology[];
  score: number;
}

export interface PatternState {
  byIdeology: Record<Ideology, PatternMatch | null>;
  debug: Record<Ideology, PatternDebugEntry>;
  tileHighlights: Record<string, Ideology[]>;
  projectedTileHighlights: Record<string, Ideology[]>;
  placementRecommendations: PlacementRecommendation[];
}
