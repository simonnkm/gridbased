import type { RaidCombatCard } from "../raid/types";
import { weightedChoice } from "../../utils/weightedChoice";
import { shuffleArray } from "../../utils/random";
import { getFocusedWeight } from "./applyIdeologyWeights";

export function instantiateWeightedCombatDeck(
  templates: RaidCombatCard[],
  focusedTemplateIds: string[],
  deckSize: number
): RaidCombatCard[] {
  if (templates.length === 0) {
    return [];
  }

  const deck: RaidCombatCard[] = [];

  for (let index = 0; index < deckSize; index += 1) {
    const choice = weightedChoice(
      templates.map((card) => ({
        item: card,
        weight: getFocusedWeight(
          card.drawWeight,
          focusedTemplateIds.includes(card.templateId)
        )
      }))
    );

    if (!choice) {
      break;
    }

    deck.push({
      ...choice,
      id: `${choice.templateId}::${index + 1}`
    });
  }

  return shuffleArray(deck);
}

