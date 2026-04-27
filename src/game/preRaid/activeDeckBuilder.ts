import type { RaidCombatCard } from "../raid/types";
import { scoreCombatCardForDeck } from "../cards/cardSelectors";
import { filterDeckSelections } from "./deckValidation";

export function resolveActiveDeckSelection(
  pool: RaidCombatCard[],
  activeTemplateIds: string[],
  focusedTemplateIds: string[],
  maxSize: number,
  hasCustomizedCombatDeck: boolean
): {
  activeTemplateIds: string[];
  focusedTemplateIds: string[];
} {
  const availableTemplateIds = new Set(pool.map((card) => card.templateId));
  const filtered = filterDeckSelections(
    availableTemplateIds,
    activeTemplateIds,
    focusedTemplateIds
  );
  const focusedSet = new Set(filtered.focusedTemplateIds);
  const sortedPool = [...pool].sort((left, right) => {
    const leftFocusBoost = focusedSet.has(left.templateId) ? 1.2 : 0;
    const rightFocusBoost = focusedSet.has(right.templateId) ? 1.2 : 0;

    return (
      scoreCombatCardForDeck(right) +
      rightFocusBoost -
      (scoreCombatCardForDeck(left) + leftFocusBoost) ||
      left.title.localeCompare(right.title)
    );
  });
  const recommendedIds = sortedPool
    .slice(0, Math.min(maxSize, sortedPool.length))
    .map((card) => card.templateId);
  const nextActiveIds =
    !hasCustomizedCombatDeck || filtered.activeTemplateIds.length === 0
      ? recommendedIds
      : filtered.activeTemplateIds.slice(0, Math.min(maxSize, filtered.activeTemplateIds.length));
  const nextFocusedIds = filtered.focusedTemplateIds
    .filter((templateId) => nextActiveIds.includes(templateId))
    .slice(0, Math.min(4, nextActiveIds.length));

  return {
    activeTemplateIds: nextActiveIds,
    focusedTemplateIds: nextFocusedIds
  };
}
