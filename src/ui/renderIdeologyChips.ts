import type { StructureCardDefinition } from "../data/structures";

export function renderIdeologyChips(definition: StructureCardDefinition): string {
  const chips = [
    definition.ideologyWeights.scrap > 0
      ? `<span class="ideology-chip scrap">Scrap ${definition.ideologyWeights.scrap}</span>`
      : "",
    definition.ideologyWeights.tech > 0
      ? `<span class="ideology-chip tech">Tech ${definition.ideologyWeights.tech}</span>`
      : "",
    definition.ideologyWeights.magic > 0
      ? `<span class="ideology-chip magic">Magic ${definition.ideologyWeights.magic}</span>`
      : ""
  ].filter(Boolean);

  if (chips.length === 0) {
    return "";
  }

  return `<div class="ideology-chip-row">${chips.join("")}</div>`;
}
