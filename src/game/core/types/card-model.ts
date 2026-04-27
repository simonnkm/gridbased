import type { Ideology, PatternTier } from "../../patterns/types";

export type CardKind = "build" | "raid" | "enemy-raid";
export type CardCategory =
  | "build"
  | "attack"
  | "block"
  | "support"
  | "special"
  | "tactic";
export type CostType = "none" | "action" | "energy";
export type CardIdeologyTag = Ideology | "neutral";
export type CardResource = "food" | "materials" | "core" | "progress" | "intel";
export type CardEffectType =
  | "resource"
  | "build-structure"
  | "attack"
  | "block"
  | "heal"
  | "draw"
  | "weaken"
  | "repair"
  | "damage"
  | "guard"
  | "shred-block"
  | "drain-integrity"
  | "reveal";

export interface Cost {
  type: CostType;
  amount: number;
}

export interface CardSource {
  type:
    | "starter-deck"
    | "structure"
    | "unlock"
    | "reward"
    | "enemy-archetype"
    | "shop"
    | "system";
  id: string;
  title: string;
  count?: number;
}

export type CardEffectCondition =
  | {
      kind: "has-structure";
      structureId: string;
    }
  | {
      kind: "pattern-tier-at-least";
      ideology: Ideology;
      minimumTier: Exclude<PatternTier, "none">;
    };

export interface CardEffectScaling {
  kind: "pattern-tier";
  ideology: Ideology;
  amountPerTier: number;
  maxBonus?: number;
}

interface BaseCardEffect {
  type: CardEffectType;
  amount?: number;
  condition?: CardEffectCondition;
  scaling?: CardEffectScaling;
}

export type CardEffect =
  | (BaseCardEffect & {
      type: "resource";
      resource: CardResource;
    })
  | (BaseCardEffect & {
      type: "build-structure";
      structureId: string;
    })
  | (BaseCardEffect & {
      type: "attack" | "block" | "heal" | "draw" | "weaken" | "repair";
      amount: number;
    })
  | (BaseCardEffect & {
      type: "damage" | "guard" | "shred-block" | "drain-integrity";
      amount: number;
    })
  | (BaseCardEffect & {
      type: "reveal";
      target: "raid" | "draw";
      amount?: number;
    });

export interface WeightedCardConfig {
  baseWeight: number;
  focusMultiplier?: number;
  sourceCount?: number;
}

export interface CardDefinition<
  TKind extends CardKind = CardKind,
  TMeta extends object = Record<string, unknown>
> {
  id: string;
  kind: TKind;
  title: string;
  summary: string;
  category: CardCategory;
  ideologies: CardIdeologyTag[];
  cost: Cost;
  source: CardSource;
  effects: CardEffect[];
  weighted?: WeightedCardConfig;
  tags?: string[];
  meta?: TMeta;
}

export interface CardInstance<
  TKind extends CardKind = CardKind,
  TRuntime extends object = Record<string, unknown>
> {
  instanceId: string;
  definitionId: string;
  kind: TKind;
  source: CardSource;
  cost: Cost;
  weight: number;
  tags: string[];
  runtime: TRuntime;
}
