import type { CardIdeologyTag } from "../core/types/card-model";
import type { ProgressionState } from "../progression/types";

function getTierWeightBonus(tier: string): number {
  switch (tier) {
    case "small":
      return 0.08;
    case "medium":
      return 0.18;
    case "large":
      return 0.3;
    default:
      return 0;
  }
}

export function getIdeologyWeightBonus(
  ideologies: CardIdeologyTag[],
  progression: ProgressionState
): number {
  const liveIdeologies = ideologies.filter((ideology) => ideology !== "neutral");

  if (liveIdeologies.length === 0) {
    return 0;
  }

  return liveIdeologies.reduce((bestBonus, ideology) => {
    const ideologyState = progression.byIdeology[ideology];
    const tierBonus = getTierWeightBonus(ideologyState.currentTier);
    const barBonus = Math.min(0.12, ideologyState.barValue / 100);

    return Math.max(bestBonus, tierBonus + barBonus);
  }, 0);
}

export function applyIdeologyWeightBonus(
  baseWeight: number,
  ideologies: CardIdeologyTag[],
  progression: ProgressionState
): number {
  return baseWeight * (1 + getIdeologyWeightBonus(ideologies, progression));
}

export function getFocusedWeight(
  drawWeight: number,
  focused: boolean,
  focusMultiplier = 1.75
): number {
  return drawWeight * (focused ? focusMultiplier : 1);
}

