import type { GameState } from "../state/types";

export function getIdeologyBarSnapshot(state: GameState) {
  return state.progression.byIdeology;
}

