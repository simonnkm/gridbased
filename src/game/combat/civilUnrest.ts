export function getCivilUnrestDamage(surplusCards: number): number {
  return (surplusCards * (surplusCards + 1)) / 2;
}

