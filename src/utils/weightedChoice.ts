export interface WeightedChoiceItem<T> {
  item: T;
  weight: number;
}

export function weightedChoice<T>(entries: WeightedChoiceItem<T>[]): T | null {
  const validEntries = entries.filter((entry) => entry.weight > 0);

  if (validEntries.length === 0) {
    return null;
  }

  const totalWeight = validEntries.reduce((total, entry) => total + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of validEntries) {
    roll -= entry.weight;

    if (roll <= 0) {
      return entry.item;
    }
  }

  return validEntries[validEntries.length - 1]?.item ?? null;
}

