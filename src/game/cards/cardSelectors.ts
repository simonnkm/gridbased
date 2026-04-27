import type { RaidCombatCard } from "../raid/types";

export function scoreCombatCardForDeck(card: RaidCombatCard): number {
  const effectScore = card.effects.reduce((total, effect) => {
    switch (effect.type) {
      case "attack":
        return total + effect.amount * 1.45;
      case "block":
        return total + effect.amount * 1.22;
      case "heal":
        return total + effect.amount * 1.34;
      case "draw":
        return total + effect.amount * 0.72;
      case "weaken":
        return total + effect.amount * 0.92;
      case "repair":
        return total + effect.amount * 1.58;
    }
  }, 0);
  const costPenalty = 0.9 + card.cost * 0.28;

  return effectScore / Math.max(1, costPenalty) + card.effects.length * 0.08;
}

export function getCardSourceLabel(card: RaidCombatCard): string {
  if (card.sourceType === "structure") {
    return `${card.sourceTitle} x${card.sourceCount}`;
  }

  if (card.sourceType === "reward") {
    return "Raid Reward";
  }

  return "Doctrine";
}
