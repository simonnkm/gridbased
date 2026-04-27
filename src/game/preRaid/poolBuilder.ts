import { shuffleArray } from "../../utils/random";
import type { RaidCombatCard } from "../raid/types";
export { buildAvailableRaidPool } from "../cards/buildAvailableRaidPool";

export type EffectiveRaidCopies = 0 | 1 | 2;

function qualifiesForBonusCopy(card: RaidCombatCard, focused: boolean): boolean {
  if (focused) {
    return true;
  }

  if (card.drawWeight >= 2.15) {
    return true;
  }

  if (card.sourceCount >= 2 && (card.category === "support" || card.category === "block")) {
    return true;
  }

  if (card.sourceCount >= 3) {
    return true;
  }

  return false;
}

export function getEffectiveRaidCopies(
  card: RaidCombatCard,
  active: boolean,
  focused: boolean
): EffectiveRaidCopies {
  if (!active) {
    return 0;
  }

  return qualifiesForBonusCopy(card, focused) ? 2 : 1;
}

export function buildConcreteRaidDeck(
  templates: RaidCombatCard[],
  activeTemplateIds: string[],
  focusedTemplateIds: string[]
): RaidCombatCard[] {
  const activeSet = new Set(activeTemplateIds);
  const focusedSet = new Set(focusedTemplateIds);
  const deck: RaidCombatCard[] = [];

  for (const template of templates) {
    const copies = getEffectiveRaidCopies(
      template,
      activeSet.has(template.templateId),
      focusedSet.has(template.templateId)
    );

    for (let index = 0; index < copies; index += 1) {
      deck.push({
        ...template,
        id: `${template.templateId}::${index + 1}`
      });
    }
  }

  return shuffleArray(deck);
}
