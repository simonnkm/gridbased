import { passiveUnlockIds } from "../../data/progression";
import { getStructureCardDefinition } from "../../data/structures";
import type { GameState, StructureId } from "../state/types";

export interface SalvagePassiveBonus {
  materialsBonus: number;
  note: string | null;
}

export interface EndTurnPassiveBonus {
  coreBonus: number;
  intelBonus: number;
  notes: string[];
}

export function resolveSalvagePassiveBonus(
  state: GameState,
  structureId: StructureId
): SalvagePassiveBonus {
  const scrapWeight = getStructureCardDefinition(structureId).ideologyWeights.scrap;

  if (
    scrapWeight > 0 &&
    state.progression.activePassiveIds.includes(passiveUnlockIds.scrapScroungeCache)
  ) {
    return {
      materialsBonus: 1,
      note: "Scrounge Cache added +1 Materials from the active Scrap doctrine."
    };
  }

  return {
    materialsBonus: 0,
    note: null
  };
}

export function resolveEndTurnPassiveBonus(state: GameState): EndTurnPassiveBonus {
  const notes: string[] = [];
  let coreBonus = 0;
  let intelBonus = 0;

  if (state.progression.activePassiveIds.includes(passiveUnlockIds.magicLeyShelter)) {
    coreBonus += 1;
    notes.push("Ley Shelter restored +1 Core.");
  }

  const activeTechPattern = state.patterns.byIdeology.tech;

  if (
    state.progression.activePassiveIds.includes(passiveUnlockIds.techSurveyGrid) &&
    activeTechPattern &&
    activeTechPattern.contributingCellIds.some((cellId) =>
      state.board.some(
        (cell) => cell.id === cellId && cell.structureId === "watchtower"
      )
    )
  ) {
    intelBonus += 1;
    notes.push("Survey Grid routed +1 Intel through the active Watchtower line.");
  }

  return {
    coreBonus,
    intelBonus,
    notes
  };
}

