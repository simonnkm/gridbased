import { isBasicBuildStructureId, starterDeckRecipe } from "../../data/structures";
import { createBuildCardInstance } from "../cards/createCardInstance";
import type { CardInstance, StructureId } from "../state/types";
import { shuffleArray } from "../../utils/random";

export const MAX_HAND_SIZE = 5;

export function createCardCopies(
  recipe: Partial<Record<StructureId, number>>,
  startingSequence: number
): {
  cards: CardInstance[];
  nextSequence: number;
} {
  const cards: CardInstance[] = [];
  let nextSequence = startingSequence;

  for (const [structureId, copies] of Object.entries(recipe) as Array<[StructureId, number]>) {
    if (!isBasicBuildStructureId(structureId)) {
      continue;
    }

    for (let index = 0; index < copies; index += 1) {
      cards.push(createBuildCardInstance(structureId, nextSequence));
      nextSequence += 1;
    }
  }

  return {
    cards,
    nextSequence
  };
}

export function createStarterDeck(): {
  deck: CardInstance[];
  nextSequence: number;
} {
  const { cards, nextSequence } = createCardCopies(starterDeckRecipe, 1);

  return {
    deck: shuffle(cards),
    nextSequence
  };
}

export function shuffle<T>(items: T[]): T[] {
  return shuffleArray(items);
}

function pullPreferredCard(
  drawPile: CardInstance[],
  blockedStructureIds: Set<StructureId>
): CardInstance | undefined {
  if (drawPile.length === 0) {
    return undefined;
  }

  let preferredIndex = drawPile.findIndex((card) => !blockedStructureIds.has(card.structureId));

  if (preferredIndex === -1) {
    preferredIndex = 0;
  }

  const [card] = drawPile.splice(preferredIndex, 1);
  return card;
}

export function drawCards(
  drawPile: CardInstance[],
  discardPile: CardInstance[],
  count: number,
  existingHand: CardInstance[] = []
): {
  drawnCards: CardInstance[];
  nextDrawPile: CardInstance[];
  nextDiscardPile: CardInstance[];
} {
  let nextDrawPile = [...drawPile];
  let nextDiscardPile = [...discardPile];
  const drawnCards: CardInstance[] = [];
  const blockedStructureIds = new Set(existingHand.map((card) => card.structureId));

  while (drawnCards.length < count) {
    if (nextDrawPile.length === 0) {
      if (nextDiscardPile.length === 0) {
        break;
      }

      nextDrawPile = shuffle(nextDiscardPile);
      nextDiscardPile = [];
    }

    const card = pullPreferredCard(nextDrawPile, blockedStructureIds);

    if (!card) {
      break;
    }

    drawnCards.push(card);
    blockedStructureIds.add(card.structureId);
  }

  return {
    drawnCards,
    nextDrawPile,
    nextDiscardPile
  };
}
