export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    return 0;
  }

  return Math.floor(Math.random() * maxExclusive);
}

export function shuffleArray<T>(items: T[]): T[] {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const current = nextItems[index];

    nextItems[index] = nextItems[swapIndex];
    nextItems[swapIndex] = current;
  }

  return nextItems;
}

