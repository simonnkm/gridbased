import { createStarterDeck } from "../rules/deck";
import { createInitialRunState } from "../rules/gameFlow";
import type { BoardCell, GameState } from "./types";
import { assignRadialTopology } from "../board/radialTopology";

const BOARD_SIZE = 7;

function createBoard(size: number): BoardCell[] {
  const coreRow = Math.floor(size / 2);
  const coreCol = Math.floor(size / 2);
  const seededBoard: BoardCell[] = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    const isCore = row === coreRow && col === coreCol;

    return {
      id: `cell-${row}-${col}`,
      row,
      col,
      ring: 0,
      sector: 0,
      terrain: isCore ? "core" : "ground",
      structureId: null,
      stackLevel: 0,
      appliedIdeologies: [],
      appliedIdeology: null,
      connections: [],
      condition: 0,
      damage: "healthy"
    };
  });

  return assignRadialTopology(seededBoard, size);
}

export function createInitialGameState(): GameState {
  const starterDeck = createStarterDeck();

  return createInitialRunState(
    {
      boardSize: BOARD_SIZE,
      board: createBoard(BOARD_SIZE),
      boardViewMode: "build",
      selectedTile: null,
      nextCardSequence: starterDeck.nextSequence,
      ideologyApplicationsThisTurn: 0,
      ideologyApplicationsPerTurnLimit: 2,
      ideologyCardStock: {
        tech: 1,
        magic: 1
      },
      applicationPoints: 0,
      salvageMode: "resources",
      turn: 1,
      nextRaidTurn: 8,
      nextRaidWindowStart: 8,
      nextRaidWindowEnd: 8,
      raidsSurvived: 0,
      phase: "build",
      resources: {
        food: 3,
        materials: 2,
        core: 10,
        progress: 0,
        intel: 0
      },
      tutorial: {
        visible: true,
        stepIndex: 0,
        completed: false
      }
    },
    starterDeck.deck
  );
}
