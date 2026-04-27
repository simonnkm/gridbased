import { getNodeDefinition } from "../../data/nodes";
import { getProgressionUnlockDefinition } from "../../data/progression";
import { getStructureCardDefinition, isBasicBuildStructureId } from "../../data/structures";
import { getBaselineDecayTargetsForTurn, getMaintenanceSummary } from "../maintenance";
import { formatSiteLabel } from "../board/radialTopology";
import { createEmptyPatternState, detectPatternState } from "../patterns/detectPatterns";
import { resolveEndTurnPassiveBonus, resolveSalvagePassiveBonus } from "../progression/effects";
import {
  createEmptyProgressionState,
  resolveProgressionState
} from "../progression/resolveProgression";
import {
  buildCombatCardPool,
  createInitialRaidForecast,
  createRaidState,
  createRewardCombatCardFromIdeology,
  drawRaidCardAction,
  rollNextRaidForecastAfter,
  isRaidTurn,
  playSelectedRaidCards,
  resolveRaidForecastForTurn,
  resolveRaidEnemyTurn,
  scoreCombatCardForDeck,
  toggleRaidCardSelection
} from "../raid/resolveRaid";
import { resolveActiveDeckSelection } from "../preRaid/activeDeckBuilder";
import {
  getEmptyTileCount,
  getIdeologyForgePlan,
  getNodeAvailability,
  getSettlementExpansionBonuses,
  getShopOfferCost,
  getSelectedBuildStructureId,
  getUpcomingRaidCard
} from "../selectors";
import type {
  ActionMessage,
  BoardCell,
  CardInstance,
  GameState,
  ScoutReport,
  StructureConnection,
  StructureDamageState,
  StructureIdeology,
  IdeologyCardStock,
  StructureId
} from "../state/types";
import { createCardCopies, drawCards, MAX_HAND_SIZE, shuffle } from "./deck";

const CORE_CAP = 10;
const WELL_LIMIT = 2;
const MAX_ACTIVITY_LOG = 8;
const MAX_CONNECTIONS_PER_STRUCTURE = 3;
const MAX_STRUCTURE_STACK = 3;
const MAX_IDEOLOGY_TRAITS_PER_STRUCTURE = 2;
const TUTORIAL_STEP_COUNT = 6;
type ShopOfferId =
  | "charter-farm"
  | "charter-workshop"
  | "field-repair"
  | "food-for-materials"
  | "materials-for-progress"
  | "raid-tactic";

function createMessage(
  tone: ActionMessage["tone"],
  text: string
): ActionMessage {
  return { tone, text };
}

function appendLog(state: GameState, entry: string): string[] {
  return [entry, ...state.activityLog].slice(0, MAX_ACTIVITY_LOG);
}

function clampTutorialStep(stepIndex: number): number {
  return Math.max(0, Math.min(TUTORIAL_STEP_COUNT - 1, stepIndex));
}

function normalizeIdeologyTraits(
  ideologies: readonly StructureIdeology[]
): StructureIdeology[] {
  const unique = Array.from(new Set(ideologies));

  return unique.slice(0, MAX_IDEOLOGY_TRAITS_PER_STRUCTURE);
}

function getPrimaryIdeology(
  ideologies: readonly StructureIdeology[]
): StructureIdeology | null {
  return ideologies[0] ?? null;
}

function withCellIdeologies(
  cell: BoardCell,
  ideologies: readonly StructureIdeology[]
): BoardCell {
  const normalized = normalizeIdeologyTraits(ideologies);

  return {
    ...cell,
    appliedIdeologies: normalized,
    appliedIdeology: getPrimaryIdeology(normalized)
  };
}

function getCellIdeologyList(cell: Pick<BoardCell, "appliedIdeology" | "appliedIdeologies">): StructureIdeology[] {
  if (cell.appliedIdeologies.length > 0) {
    return normalizeIdeologyTraits(cell.appliedIdeologies);
  }

  return cell.appliedIdeology ? [cell.appliedIdeology] : [];
}

function incrementIdeologyCardStock(
  stock: IdeologyCardStock,
  ideology: StructureIdeology,
  amount = 1
): IdeologyCardStock {
  return {
    ...stock,
    [ideology]: stock[ideology] + amount
  };
}

function formatForgeCostParts(cost: {
  food: number;
  materials: number;
  progress: number;
  intel: number;
}): string {
  const parts = [
    cost.materials > 0 ? `${cost.materials} Materials` : "",
    cost.food > 0 ? `${cost.food} Food` : "",
    cost.progress > 0 ? `${cost.progress} Progress` : "",
    cost.intel > 0 ? `${cost.intel} Intel` : ""
  ].filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(", ") : "no resource cost";
}

function removeCardFromHand(
  hand: CardInstance[],
  instanceId: string
): CardInstance[] {
  return hand.filter((card) => card.instanceId !== instanceId);
}

function withClampedCore(nextCore: number): number {
  return Math.max(0, Math.min(CORE_CAP, nextCore));
}

function toDamageState(
  condition: number,
  hasStructure: boolean,
  markRuinsWhenEmpty: boolean
): StructureDamageState {
  if (!hasStructure) {
    return markRuinsWhenEmpty ? "ruined" : "healthy";
  }

  if (condition <= 1) {
    return "damaged";
  }

  if (condition === 2) {
    return "worn";
  }

  return "healthy";
}

function countBuiltStructures(state: GameState, structureId: StructureId): number {
  return state.board.filter((cell) => cell.structureId === structureId).length;
}

function getSiteLabelForCell(cell: Pick<BoardCell, "terrain" | "ring" | "sector">): string {
  return formatSiteLabel(cell);
}

function removeConnectionFromCell(
  cell: BoardCell,
  targetCellId: string
): BoardCell {
  return {
    ...cell,
    connections: cell.connections.filter((connection) => connection.toCellId !== targetCellId)
  };
}

function detachCellConnections(
  board: BoardCell[],
  targetCellId: string
): BoardCell[] {
  return board.map((cell) => {
    if (cell.id === targetCellId) {
      return {
        ...cell,
        connections: []
      };
    }

    if (!cell.connections.some((connection) => connection.toCellId === targetCellId)) {
      return cell;
    }

    return removeConnectionFromCell(cell, targetCellId);
  });
}

function addConnectionOnCell(
  cell: BoardCell,
  connection: StructureConnection
): BoardCell {
  const withoutTarget = cell.connections.filter(
    (entry) => entry.toCellId !== connection.toCellId
  );

  return {
    ...cell,
    connections: [...withoutTarget, connection]
  };
}

function buildOnBoard(
  board: BoardCell[],
  row: number,
  col: number,
  structureId: StructureId
): BoardCell[] {
  return board.map((cell) => {
    if (cell.row === row && cell.col === col) {
      return {
        ...cell,
        structureId,
        stackLevel: 1,
        appliedIdeologies: [],
        appliedIdeology: null,
        connections: [],
        condition: 3,
        damage: "healthy"
      };
    }

    return cell;
  });
}

function stackOnBoard(
  board: BoardCell[],
  targetCellId: string
): BoardCell[] {
  return board.map((cell) =>
    cell.id === targetCellId
      ? {
          ...cell,
          stackLevel: Math.min(MAX_STRUCTURE_STACK, Math.max(1, cell.stackLevel + 1)),
          damage: toDamageState(cell.condition, true, false)
        }
      : cell
  );
}

function damageStructures(board: BoardCell[], targetCellIds: string[]): BoardCell[] {
  const targetIds = new Set(targetCellIds);
  let nextBoard = board;

  for (const targetCellId of targetIds) {
    nextBoard = nextBoard.map((cell) => {
      if (cell.id !== targetCellId) {
        return cell;
      }

      if (cell.structureId === null) {
        return cell;
      }

      const nextCondition = Math.max(0, cell.condition - 1);

      if (nextCondition > 0) {
        return {
          ...cell,
          condition: nextCondition,
          damage: toDamageState(nextCondition, true, false)
        };
      }

      return {
        ...cell,
        structureId: null,
        stackLevel: 0,
        appliedIdeologies: [],
        appliedIdeology: null,
        condition: 0,
        damage: "ruined"
      };
    });

    const targetCell = nextBoard.find((cell) => cell.id === targetCellId);

    if (!targetCell || targetCell.structureId !== null) {
      continue;
    }

    nextBoard = detachCellConnections(nextBoard, targetCellId);
  }

  return nextBoard;
}

function wearStructures(board: BoardCell[], targetCellIds: string[]): BoardCell[] {
  const targetIds = new Set(targetCellIds);

  return board.map((cell) => {
    if (!targetIds.has(cell.id) || cell.structureId === null) {
      return cell;
    }

    const nextCondition = Math.max(1, cell.condition - 1);

    return {
      ...cell,
      condition: nextCondition,
      damage: toDamageState(nextCondition, true, false)
    };
  });
}

function applyRaidBoardUpdates(
  board: BoardCell[],
  updates: Array<{
    cellId: string;
    structureId: StructureId | null;
    condition: number;
    damage: StructureDamageState;
  }>
): BoardCell[] {
  const updateMap = new Map(updates.map((update) => [update.cellId, update]));
  let nextBoard = board.map((cell) => {
    const update = updateMap.get(cell.id);

    if (!update) {
      return cell;
    }

    return {
      ...cell,
      structureId: update.structureId,
      stackLevel: update.structureId === null ? 0 : Math.max(1, cell.stackLevel),
      appliedIdeologies: update.structureId === null ? [] : cell.appliedIdeologies,
      appliedIdeology:
        update.structureId === null ? null : getPrimaryIdeology(cell.appliedIdeologies),
      connections: update.structureId === null ? [] : cell.connections,
      condition: update.structureId === null ? 0 : update.condition,
      damage:
        update.structureId === null
          ? update.damage
          : toDamageState(update.condition, true, false)
    };
  });

  for (const update of updates) {
    if (update.structureId !== null) {
      continue;
    }

    nextBoard = detachCellConnections(nextBoard, update.cellId);
  }

  return nextBoard;
}

function drawUpToHandSize(state: GameState): Pick<GameState, "hand" | "drawPile" | "discardPile"> {
  const cardsNeeded = Math.max(0, MAX_HAND_SIZE - state.hand.length);
  const { drawnCards, nextDrawPile, nextDiscardPile } = drawCards(
    state.drawPile,
    state.discardPile,
    cardsNeeded,
    state.hand
  );

  return {
    hand: [...state.hand, ...drawnCards],
    drawPile: nextDrawPile,
    discardPile: nextDiscardPile
  };
}

function getMostDamagedStructure(board: BoardCell[]): BoardCell | undefined {
  return board.find((cell) => cell.structureId !== null && cell.condition < 3);
}

function getFieldRepairTarget(state: GameState): BoardCell | undefined {
  if (state.selectedTile) {
    const selectedCell = state.board.find(
      (cell) =>
        cell.row === state.selectedTile?.row &&
        cell.col === state.selectedTile?.col &&
        cell.structureId !== null &&
        cell.condition < 3
    );

    if (selectedCell) {
      return selectedCell;
    }
  }

  return [...state.board]
    .filter((cell) => cell.structureId !== null && cell.condition < 3)
    .sort(
      (left, right) =>
        left.condition - right.condition ||
        right.ring - left.ring ||
        left.row - right.row ||
        left.col - right.col
    )[0];
}

function repairStructure(
  board: BoardCell[],
  targetCellId: string
): BoardCell[] {
  return board.map((cell) =>
    cell.id === targetCellId
      ? (() => {
          const nextCondition = Math.min(3, Math.max(1, cell.condition) + 1);

          return {
            ...cell,
            condition: nextCondition,
            damage: toDamageState(nextCondition, true, false)
          };
        })()
      : cell
  );
}

function resolveWatchtowerReport(state: GameState): ScoutReport {
  const upcomingRaid = getUpcomingRaidCard(state);

  if (upcomingRaid) {
    return {
      source: "raid",
      title: upcomingRaid.title,
      detail: upcomingRaid.summary
    };
  }

  const fallbackCard = state.drawPile[0] ?? state.discardPile[0];

  if (fallbackCard) {
    const definition = getStructureCardDefinition(fallbackCard.structureId);

    return {
      source: "draw",
      title: definition.title,
      detail: "No raid is queued yet, so the Watchtower scouts the next draw instead."
    };
  }

  return {
    source: "draw",
    title: "No signal",
    detail: "The Watchtower found no upcoming raid or draw card to report."
  };
}

function formatTitleList(titles: string[]): string {
  if (titles.length <= 2) {
    return titles.join(", ");
  }

  return `${titles.slice(0, 2).join(", ")}, +${titles.length - 2} more`;
}

function formatUnlockSummary(unlockIds: string[]): string {
  const titles = unlockIds.map((unlockId) => getProgressionUnlockDefinition(unlockId).title);

  return formatTitleList(titles);
}

function applyUnlockedBuildCards(state: GameState): GameState {
  const unlockedBuildCards = state.progression.latestUnlockedIds
    .map((unlockId) => getProgressionUnlockDefinition(unlockId))
    .filter(
      (definition) => definition.category === "build-card" && Boolean(definition.buildCardStructureId)
    );

  if (unlockedBuildCards.length === 0) {
    return state;
  }

  const recipe: Partial<Record<StructureId, number>> = {};
  const basicUnlockedBuildCards = unlockedBuildCards.filter((definition) =>
    isBasicBuildStructureId(definition.buildCardStructureId!)
  );

  if (basicUnlockedBuildCards.length === 0) {
    return state;
  }

  for (const definition of basicUnlockedBuildCards) {
    const structureId = definition.buildCardStructureId!;
    recipe[structureId] = (recipe[structureId] ?? 0) + (definition.copiesAddedToDeck ?? 1);
  }

  const { cards, nextSequence } = createCardCopies(recipe, state.nextCardSequence);
  const cardSummary = formatTitleList(
    basicUnlockedBuildCards.map((definition) => getStructureCardDefinition(definition.buildCardStructureId!).title)
  );

  return {
    ...state,
    drawPile: shuffle([...cards, ...state.drawPile]),
    nextCardSequence: nextSequence,
    message: state.message
      ? {
          ...state.message,
          text: `${state.message.text} New draw cards shuffled in: ${cardSummary}.`
        }
      : createMessage("success", `New draw cards shuffled in: ${cardSummary}.`),
    activityLog: appendLog(state, `New build cards entered the draw flow: ${cardSummary}.`)
  };
}

function getDominantCombatIdeology(state: GameState): "scrap" | "tech" | "magic" | "neutral" {
  const entries = [
    ["scrap", state.progression.byIdeology.scrap.barValue],
    ["tech", state.progression.byIdeology.tech.barValue],
    ["magic", state.progression.byIdeology.magic.barValue]
  ] as const;
  const best = [...entries].sort((left, right) => right[1] - left[1])[0];

  if (!best || best[1] <= 0) {
    return "neutral";
  }

  return best[0];
}

function createPostRaidServiceHooks(): GameState["postRaidServiceHooks"] {
  return [
    {
      id: "exchange-bay",
      title: "Exchange Bay",
      summary: "Later: convert resources into targeted build cards and combat picks.",
      available: false
    },
    {
      id: "repair-yard",
      title: "Repair Yard",
      summary: "Later: buy direct repairs and structure upgrades between raids.",
      available: false
    },
    {
      id: "card-broker",
      title: "Card Broker",
      summary: "Later: target or buy specific building cards to reduce draw variance.",
      available: false
    }
  ];
}

function withResolvedCombatDeckState(state: GameState): GameState {
  const nextPool = buildCombatCardPool(state);
  const nextSelection = resolveActiveDeckSelection(
    nextPool,
    state.activeCombatDeckTemplateIds,
    state.focusedCombatCardTemplateIds,
    state.activeCombatDeckMaxSize,
    state.hasCustomizedCombatDeck
  );

  return {
    ...state,
    combatCardPool: nextPool,
    activeCombatDeckTemplateIds: nextSelection.activeTemplateIds,
    focusedCombatCardTemplateIds: nextSelection.focusedTemplateIds,
    postRaidServiceHooks:
      state.postRaidServiceHooks.length > 0 ? state.postRaidServiceHooks : createPostRaidServiceHooks()
  };
}

function createPostRaidRewardChoices(state: GameState): GameState["postRaidRewardChoices"] {
  const dominantIdeology = getDominantCombatIdeology(state);
  const combatRewardCard = createRewardCombatCardFromIdeology(
    dominantIdeology,
    state.nextRewardSequence
  );
  const buildRewardStructureId =
    dominantIdeology === "scrap"
      ? "mine"
      : dominantIdeology === "tech"
        ? "watchtower"
        : dominantIdeology === "magic"
          ? "well"
          : "workshop";
  const damagedTarget = state.board.find(
    (cell) => cell.structureId !== null && cell.condition < 3
  );

  return [
    {
      id: `reward-combat-${state.nextRewardSequence}`,
      title: combatRewardCard.title,
      summary: `Add ${combatRewardCard.title} to the combat pool and active deck planning.`,
      kind: "combat-card",
      combatCardTemplate: combatRewardCard,
      buildCardStructureId: null,
      repairCellId: null
    },
    {
      id: `reward-build-${state.nextRewardSequence}`,
      title: `Charter ${getStructureCardDefinition(buildRewardStructureId).title}`,
      summary: `Add 2 ${getStructureCardDefinition(buildRewardStructureId).title} cards to the build draw flow.`,
      kind: "build-card",
      combatCardTemplate: null,
      buildCardStructureId: buildRewardStructureId,
      repairCellId: null
    },
    {
      id: `reward-repair-${state.nextRewardSequence}`,
      title: damagedTarget ? "Field Repairs" : "Reserve Stores",
      summary: damagedTarget
        ? `Repair ${getStructureCardDefinition(damagedTarget.structureId!).title} before the next build phase.`
        : "No structure is damaged, so bank +2 Materials and +1 Core instead.",
      kind: "repair",
      combatCardTemplate: null,
      buildCardStructureId: null,
      repairCellId: damagedTarget?.id ?? null
    }
  ];
}

function getBuildEffect(
  structureId: StructureId
): {
  food?: number;
  materials?: number;
  progress?: number;
  core?: number;
  intel?: number;
  note: string;
} | null {
  switch (structureId) {
    case "scrounge-depot":
      return {
        materials: 1,
        note: "It paid out +1 Materials on build."
      };
    case "relay-pylon":
      return {
        intel: 1,
        note: "Its first clean signal added Intel +1 on build."
      };
    case "junction-array":
      return {
        progress: 1,
        note: "The fresh routing work added +1 Progress."
      };
    case "ley-lantern":
      return {
        core: 1,
        note: "The lantern settled the district and healed Core +1."
      };
    default:
      return null;
  }
}

function getDismantleRefund(
  structureId: StructureId
): {
  food?: number;
  materials?: number;
  progress?: number;
  core?: number;
  intel?: number;
  note: string;
} {
  switch (structureId) {
    case "farm":
      return { food: 1, note: "Recovered stores returned +1 Food." };
    case "mine":
      return { materials: 1, note: "Recovered braces returned +1 Materials." };
    case "watchtower":
      return { intel: 1, note: "Recovered optics returned Intel +1." };
    case "well":
      return { core: 1, note: "Clean water reserves restored Core +1." };
    case "muster-hall":
      return { core: 1, note: "The militia stood down and steadied Core +1." };
    case "workshop":
      return { progress: 1, note: "Recovered tools returned +1 Progress." };
    case "barricade-yard":
      return { materials: 1, note: "Recovered plating returned +1 Materials." };
    case "scrounge-depot":
      return { materials: 1, note: "Cached salvage returned +1 Materials." };
    case "relay-pylon":
      return { intel: 1, note: "Recovered routing gear returned Intel +1." };
    case "junction-array":
      return { progress: 1, note: "Recovered schematics returned +1 Progress." };
    case "ward-sigil":
      return { core: 1, note: "The ward unraveled gently and restored Core +1." };
    case "ley-lantern":
      return { food: 1, note: "The lantern stores returned +1 Food." };
    case "scrap-bastion":
      return { materials: 2, progress: 1, note: "The bastion broke down into +2 Materials and +1 Progress." };
  }
}

function clearStructureFromBoard(board: BoardCell[], targetCellId: string): BoardCell[] {
  const clearedBoard = board.map((cell) =>
    cell.id === targetCellId
      ? {
          ...cell,
          structureId: null,
          stackLevel: 0,
          appliedIdeologies: [],
          appliedIdeology: null,
          connections: [],
          condition: 0,
          damage: "healthy" as const
        }
      : cell
  );

  return detachCellConnections(clearedBoard, targetCellId);
}

function addBuildCardsToDrawPile(
  state: GameState,
  recipe: Partial<Record<StructureId, number>>
): Pick<GameState, "drawPile" | "nextCardSequence"> {
  const { cards, nextSequence } = createCardCopies(recipe, state.nextCardSequence);

  return {
    drawPile: shuffle([...cards, ...state.drawPile]),
    nextCardSequence: nextSequence
  };
}

function addRaidTacticPurchase(state: GameState): Pick<GameState, "bonusCombatCards" | "nextRewardSequence" | "activeCombatDeckTemplateIds"> {
  const ideology = getDominantCombatIdeology(state);
  const rewardCard = createRewardCombatCardFromIdeology(ideology, state.nextRewardSequence);
  const nextActiveIds =
    !state.activeCombatDeckTemplateIds.includes(rewardCard.templateId) &&
    state.activeCombatDeckTemplateIds.length < state.activeCombatDeckMaxSize
      ? [...state.activeCombatDeckTemplateIds, rewardCard.templateId]
      : state.activeCombatDeckTemplateIds;

  return {
    bonusCombatCards: [...state.bonusCombatCards, rewardCard],
    nextRewardSequence: state.nextRewardSequence + 1,
    activeCombatDeckTemplateIds: nextActiveIds
  };
}

function applyMaintenancePressure(state: GameState): GameState {
  const summary = getMaintenanceSummary(state);
  const baselineDecayTargetIds = getBaselineDecayTargetsForTurn(summary, state.turn);
  const baselineWornBoard =
    baselineDecayTargetIds.length > 0
      ? wearStructures(state.board, baselineDecayTargetIds)
      : state.board;
  const baselineWearText =
    baselineDecayTargetIds.length > 0
      ? `Baseline wear affected ${baselineDecayTargetIds.length} structure${baselineDecayTargetIds.length === 1 ? "" : "s"}.`
      : "";

  if (summary.upkeepCost === 0) {
    if (baselineDecayTargetIds.length === 0) {
      return state;
    }

    return {
      ...state,
      board: baselineWornBoard,
      message: createMessage(
        "info",
        `${baselineWearText} Support prevented additional upkeep losses this turn.`
      ),
      activityLog: appendLog(
        state,
        `${baselineWearText} Support coverage prevented extra upkeep failures.`
      )
    };
  }

  const remainingMaterials = Math.max(0, state.resources.materials - summary.upkeepCost);

  if (summary.unpaidCount === 0) {
    const priorText = state.message?.text ? `${state.message.text} ` : "";

    return {
      ...state,
      board: baselineWornBoard,
      resources: {
        ...state.resources,
        materials: remainingMaterials
      },
      message: createMessage(
        "info",
        `${priorText}${baselineWearText} Upkeep stabilized ${summary.remoteCount} exposed structure${summary.remoteCount === 1 ? "" : "s"} for ${summary.upkeepCost} Materials.`
      ),
      activityLog: appendLog(
        state,
        `${baselineWearText} Upkeep held ${summary.remoteCount} exposed structure${summary.remoteCount === 1 ? "" : "s"} together for ${summary.upkeepCost} Materials.`
      )
    };
  }

  const damagedBoard = damageStructures(
    baselineWornBoard,
    summary.threatenedCellIds
  );
  const destroyedCount =
    baselineWornBoard.filter((cell) => cell.structureId !== null).length -
    damagedBoard.filter((cell) => cell.structureId !== null).length;

  return {
    ...state,
    board: damagedBoard,
    resources: {
      ...state.resources,
      materials: 0
    },
    message: createMessage(
      "error",
      `${baselineWearText} Base strain outpaced support. ${summary.upkeepCost - summary.unpaidCount} Materials were spent, but ${summary.unpaidCount} unsupported structure${summary.unpaidCount === 1 ? "" : "s"} degraded${destroyedCount > 0 ? ` and ${destroyedCount} collapsed completely` : ""}.`
    ),
    activityLog: appendLog(
      state,
      `${baselineWearText} Maintenance fell short. ${summary.unpaidCount} unsupported structure${summary.unpaidCount === 1 ? "" : "s"} degraded${destroyedCount > 0 ? ` and ${destroyedCount} disappeared` : ""}.`
    )
  };
}

function withResolvedDerivedState(state: GameState): GameState {
  const expansionBonuses = getSettlementExpansionBonuses(state);
  const growthImbueCap = expansionBonuses.developedRings >= 2 ? 3 : 2;
  const ideologyApplicationsPerTurnLimit = Math.max(
    2,
    state.ideologyApplicationsPerTurnLimit,
    growthImbueCap
  );
  const patterns = detectPatternState(state.board, {
    selectedStructureId: getSelectedBuildStructureId(state),
    connectModeEnabled: state.connectModeEnabled
  });
  const progression = resolveProgressionState(state.progression, patterns, state.board, state.turn);
  let nextState: GameState = {
    ...state,
    ideologyApplicationsPerTurnLimit,
    patterns,
    progression
  };

  if (progression.latestUnlockedIds.length === 0) {
    return withResolvedCombatDeckState(nextState);
  }

  const unlockSummary = formatUnlockSummary(progression.latestUnlockedIds);

  nextState = {
    ...nextState,
    message: nextState.message
      ? {
          ...nextState.message,
          text: `${nextState.message.text} New unlocks: ${unlockSummary}.`
        }
      : createMessage("success", `New unlocks: ${unlockSummary}.`),
    activityLog: appendLog(nextState, `Unlocked ${unlockSummary}.`)
  };

  return withResolvedCombatDeckState(applyUnlockedBuildCards(nextState));
}

function applyEndTurnPassiveBonuses(state: GameState): GameState {
  const passiveBonus = resolveEndTurnPassiveBonus(state);

  if (passiveBonus.coreBonus === 0 && passiveBonus.intelBonus === 0) {
    return state;
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      core: withClampedCore(state.resources.core + passiveBonus.coreBonus),
      intel: state.resources.intel + passiveBonus.intelBonus
    },
    message: createMessage(
      "success",
      `${state.message?.text ?? `Turn ${state.turn} started.`} ${passiveBonus.notes.join(" ")}`
    ),
    activityLog: appendLog(
      state,
      `Passive effects: ${passiveBonus.notes.join(" ")}`
    )
  };
}

function beginPreRaidPhase(state: GameState): GameState {
  const upcomingRaid = getUpcomingRaidCard(state);

  return {
    ...state,
    phase: "pre-raid",
    raid: null,
    message: createMessage(
      "info",
      `Raid turn ${state.turn}: ${upcomingRaid.title} is incoming. Recommended deck types were auto-selected; adjust if needed, then enter the duel.`
    ),
    activityLog: appendLog(state, `Raid turn ${state.turn} entered pre-raid preparation.`)
  };
}

function getRaidSelectedCost(state: GameState): number {
  if (!state.raid) {
    return 0;
  }

  return state.raid.playerHand
    .filter((card) => state.raid!.selectedPlayerCardIds.includes(card.id))
    .reduce((total, card) => total + card.cost, 0);
}

function getRaidRemainingEnergy(state: GameState): number {
  if (!state.raid) {
    return 0;
  }

  return Math.max(0, state.raid.maxEnergyPerTurn - state.raid.energySpentThisTurn);
}

function finalizeRaidState(state: GameState, nextRaid: NonNullable<GameState["raid"]>): GameState {
  const outcome = nextRaid.outcome!;
  const nextBoard = applyRaidBoardUpdates(state.board, outcome.boardUpdates);
  const completedRaidCount = outcome.survived ? state.raidsSurvived + 1 : state.raidsSurvived;
  const nextPhase =
    outcome.survived
      ? completedRaidCount >= 3
        ? "victory"
        : "post-raid"
      : "game-over";
  const nextCore =
    nextPhase === "game-over"
      ? 0
      : withClampedCore(state.resources.core + outcome.rewards.core);

  let resolvedState = withResolvedDerivedState({
    ...state,
    board: nextBoard,
    raidsSurvived: completedRaidCount,
    phase: nextPhase,
    resources: {
      ...state.resources,
      core: nextCore,
      materials: state.resources.materials + outcome.rewards.materials,
      progress: state.resources.progress + outcome.rewards.progress,
      intel: state.resources.intel + outcome.rewards.intel
    },
    raid: nextRaid,
    message: createMessage(
      nextPhase === "game-over" ? "error" : "success",
      outcome.reasonLines[outcome.reasonLines.length - 1]
    ),
    activityLog: appendLog(
      state,
      `${state.raid!.incomingRaidTitle} resolved. ${outcome.reasonLines[outcome.reasonLines.length - 1]}`
    )
  });

  if (nextPhase !== "post-raid") {
    return resolvedState;
  }

  const rewardChoices = createPostRaidRewardChoices(resolvedState);

  return {
    ...resolvedState,
    postRaidRewardChoices: rewardChoices,
    claimedPostRaidRewardId: null,
    nextRewardSequence: resolvedState.nextRewardSequence + 1,
    message: createMessage(
      "success",
      `${outcome.reasonLines[outcome.reasonLines.length - 1]} Choose a post-raid reward and tune the active combat deck before returning to build.`
    ),
    activityLog: appendLog(
      resolvedState,
      `Raid won. Post-raid planning opened with ${rewardChoices.length} reward options.`
    )
  };
}

export function createInitialRunState(
  baseState: Omit<
    GameState,
    | "hand"
    | "drawPile"
    | "discardPile"
    | "selectedCardInstanceId"
    | "selectedNodeStructureId"
    | "connectModeEnabled"
    | "selectedIdeologyCard"
    | "raid"
    | "scoutReport"
    | "message"
    | "activityLog"
    | "patterns"
    | "progression"
    | "combatCardPool"
    | "bonusCombatCards"
    | "activeCombatDeckTemplateIds"
    | "focusedCombatCardTemplateIds"
    | "hasCustomizedCombatDeck"
    | "activeCombatDeckMaxSize"
    | "postRaidRewardChoices"
    | "claimedPostRaidRewardId"
    | "postRaidServiceHooks"
    | "nextRewardSequence"
  >,
  starterDeck: CardInstance[]
): GameState {
  const initialRaidForecast = createInitialRaidForecast();
  const seededState: GameState = {
    ...baseState,
    nextRaidTurn: baseState.nextRaidTurn || initialRaidForecast.nextRaidTurn,
    nextRaidWindowStart:
      baseState.nextRaidWindowStart || initialRaidForecast.nextRaidWindowStart,
    nextRaidWindowEnd:
      baseState.nextRaidWindowEnd || initialRaidForecast.nextRaidWindowEnd,
    patterns: createEmptyPatternState(),
    progression: createEmptyProgressionState(),
    combatCardPool: [],
    bonusCombatCards: [],
    activeCombatDeckTemplateIds: [],
    focusedCombatCardTemplateIds: [],
    hasCustomizedCombatDeck: false,
    activeCombatDeckMaxSize: 12,
    postRaidRewardChoices: [],
    claimedPostRaidRewardId: null,
    postRaidServiceHooks: [],
    nextRewardSequence: 1,
    hand: [],
    drawPile: starterDeck,
    discardPile: [],
    selectedCardInstanceId: null,
    selectedNodeStructureId: null,
    connectModeEnabled: false,
    selectedIdeologyCard: null,
    ideologyApplicationsThisTurn: 0,
    ideologyApplicationsPerTurnLimit: baseState.ideologyApplicationsPerTurnLimit || 2,
    raid: null,
    scoutReport: null,
    message: createMessage("info", "Resolve each card by building it in the settlement or salvaging it."),
    activityLog: ["Run initialized. Drawn 5 common structure cards."]
  };

  return {
    ...withResolvedDerivedState(seededState),
    ...drawUpToHandSize(seededState)
  };
}

export function selectCardForBuild(
  state: GameState,
  instanceId: string
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  const card = state.hand.find((entry) => entry.instanceId === instanceId);

  if (!card) {
    return state;
  }

  if (getEmptyTileCount(state) === 0) {
    return {
      ...state,
      selectedCardInstanceId: null,
      selectedNodeStructureId: null,
      connectModeEnabled: false,
      selectedIdeologyCard: null,
      message: createMessage(
        "error",
        "The board is full. Cards may only be salvaged until a later milestone adds other board management tools."
      )
    };
  }

  const selectedCardInstanceId =
    state.selectedCardInstanceId === instanceId ? null : instanceId;

  const definition = getStructureCardDefinition(card.structureId);

  return withResolvedDerivedState({
    ...state,
    selectedCardInstanceId,
    selectedNodeStructureId: null,
    connectModeEnabled: false,
    selectedIdeologyCard: null,
    message: selectedCardInstanceId
      ? createMessage(
          "info",
          `${definition.title} armed for build. Click an empty tile to place it, or use Salvage instead.`
        )
      : createMessage("info", "Build selection cleared.")
  });
}

export function showTutorial(state: GameState): GameState {
  return {
    ...state,
    tutorial: {
      ...state.tutorial,
      visible: true
    }
  };
}

export function previousTutorialStep(state: GameState): GameState {
  return {
    ...state,
    tutorial: {
      ...state.tutorial,
      visible: true,
      stepIndex: clampTutorialStep(state.tutorial.stepIndex - 1)
    }
  };
}

export function nextTutorialStep(state: GameState): GameState {
  return {
    ...state,
    tutorial: {
      ...state.tutorial,
      visible: true,
      stepIndex: clampTutorialStep(state.tutorial.stepIndex + 1)
    }
  };
}

export function finishTutorial(state: GameState): GameState {
  return {
    ...state,
    tutorial: {
      ...state.tutorial,
      visible: false,
      completed: true,
      stepIndex: TUTORIAL_STEP_COUNT - 1
    },
    message: createMessage("info", "Tutorial completed. You can reopen it anytime from the brief panel.")
  };
}

export function closeTutorial(state: GameState): GameState {
  return {
    ...state,
    tutorial: {
      ...state.tutorial,
      visible: false
    }
  };
}

export function selectNodeForBuild(
  state: GameState,
  structureId: "scrap-bastion"
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  const availability = getNodeAvailability(state, structureId);

  if (!availability.available) {
    return {
      ...state,
      selectedNodeStructureId: null,
      message: createMessage("error", availability.reason)
    };
  }

  const selectedNodeStructureId =
    state.selectedNodeStructureId === structureId ? null : structureId;
  const nodeDefinition = getNodeDefinition(structureId);

  return withResolvedDerivedState({
    ...state,
    selectedNodeStructureId,
    selectedCardInstanceId: null,
    connectModeEnabled: false,
    selectedIdeologyCard: null,
    message: selectedNodeStructureId
      ? createMessage(
          "info",
          `${nodeDefinition.title} ready. Click an empty tile to found the node.`
        )
      : createMessage("info", "Node placement cancelled.")
  });
}

export function toggleConnectMode(
  state: GameState,
  enabled?: boolean
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  const nextEnabled = enabled ?? !state.connectModeEnabled;

  return withResolvedDerivedState({
    ...state,
    connectModeEnabled: nextEnabled,
    selectedIdeologyCard: null,
    selectedCardInstanceId: null,
    selectedNodeStructureId: null,
    message: nextEnabled
      ? createMessage(
          "info",
          "Connect mode armed. Drag from one built structure to another to create or remove a neutral connection."
        )
      : createMessage("info", "Connect mode cleared.")
  });
}

export function armIdeologyCard(
  state: GameState,
  ideology: StructureIdeology | null
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  if (
    ideology &&
    state.ideologyApplicationsThisTurn >= state.ideologyApplicationsPerTurnLimit
  ) {
    return {
      ...state,
      selectedIdeologyCard: null,
      message: createMessage(
        "error",
        `Ideology application limit reached (${state.ideologyApplicationsPerTurnLimit}/${state.ideologyApplicationsPerTurnLimit}) for this turn.`
      )
    };
  }

  if (ideology && state.ideologyCardStock[ideology] <= 0) {
    return {
      ...state,
      selectedIdeologyCard: null,
      message: createMessage(
        "error",
        `${ideology === "tech" ? "Tech" : "Magic"} cards are empty. Forge one from resources.`
      )
    };
  }

  const nextIdeology =
    ideology && state.selectedIdeologyCard === ideology ? null : ideology;
  const nextStock =
    nextIdeology === null
      ? state.ideologyCardStock
      : {
          ...state.ideologyCardStock,
          [nextIdeology === "tech" ? "magic" : "tech"]: 0
        };
  const choiceNote =
    nextIdeology && state.ideologyCardStock[nextIdeology === "tech" ? "magic" : "tech"] > 0
      ? ` ${nextIdeology === "tech" ? "Magic" : "Tech"} stock set to 0 for this round.`
      : "";

  return withResolvedDerivedState({
    ...state,
    selectedIdeologyCard: nextIdeology,
    ideologyCardStock: nextStock,
    connectModeEnabled: false,
    selectedCardInstanceId: null,
    selectedNodeStructureId: null,
    message: nextIdeology
      ? createMessage(
          "info",
          `${nextIdeology === "tech" ? "Tech" : "Magic"} card armed. Click a built structure to apply it.${choiceNote}`
        )
      : createMessage("info", "Ideology card cleared.")
  });
}

export function connectStructureCells(
  state: GameState,
  fromCellId: string,
  toCellId: string
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  if (fromCellId === toCellId) {
    return {
      ...state,
      message: createMessage("error", "A structure cannot connect to itself.")
    };
  }

  const fromCell = state.board.find((cell) => cell.id === fromCellId);
  const toCell = state.board.find((cell) => cell.id === toCellId);

  if (
    !fromCell ||
    !toCell ||
    fromCell.terrain === "core" ||
    toCell.terrain === "core" ||
    !fromCell.structureId ||
    !toCell.structureId
  ) {
    return {
      ...state,
      message: createMessage(
        "error",
        "Connections can only be authored between two built non-core structures."
      )
    };
  }

  const existingFromConnection = fromCell.connections.find(
    (connection) => connection.toCellId === toCell.id
  );
  const existingToConnection = toCell.connections.find(
    (connection) => connection.toCellId === fromCell.id
  );
  const hasExistingConnection = Boolean(existingFromConnection && existingToConnection);
  const isNewPairConnection = !existingFromConnection && !existingToConnection;

  if (isNewPairConnection) {
    if (fromCell.connections.length >= MAX_CONNECTIONS_PER_STRUCTURE) {
      return {
        ...state,
        message: createMessage(
          "error",
          `${getStructureCardDefinition(fromCell.structureId).title} already has ${MAX_CONNECTIONS_PER_STRUCTURE} links.`
        )
      };
    }

    if (toCell.connections.length >= MAX_CONNECTIONS_PER_STRUCTURE) {
      return {
        ...state,
        message: createMessage(
          "error",
          `${getStructureCardDefinition(toCell.structureId).title} already has ${MAX_CONNECTIONS_PER_STRUCTURE} links.`
        )
      };
    }
  }

  const nextBoard = state.board.map((cell) => {
    if (cell.id === fromCell.id) {
      return hasExistingConnection
        ? removeConnectionFromCell(cell, toCell.id)
        : addConnectionOnCell(cell, {
            toCellId: toCell.id
          });
    }

    if (cell.id === toCell.id) {
      return hasExistingConnection
        ? removeConnectionFromCell(cell, fromCell.id)
        : addConnectionOnCell(cell, {
            toCellId: fromCell.id
          });
    }

    return cell;
  });
  const actionText = hasExistingConnection
    ? `Connection removed between ${getStructureCardDefinition(fromCell.structureId).title} and ${getStructureCardDefinition(toCell.structureId).title}.`
    : `Connection created between ${getStructureCardDefinition(fromCell.structureId).title} and ${getStructureCardDefinition(toCell.structureId).title} (${fromCell.connections.length + 1}/${MAX_CONNECTIONS_PER_STRUCTURE} and ${toCell.connections.length + 1}/${MAX_CONNECTIONS_PER_STRUCTURE} links).`;

  return withResolvedDerivedState({
    ...state,
    board: nextBoard,
    selectedTile: { row: toCell.row, col: toCell.col },
    message: createMessage("success", actionText),
    activityLog: appendLog(state, actionText)
  });
}

export function cancelConnectionDraft(
  state: GameState,
  reason = "Connection cancelled. Drag from one built structure to another built structure."
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  return {
    ...state,
    message: createMessage("error", reason)
  };
}

function applyIdeologyUpgradeToCell(
  state: GameState,
  targetCell: BoardCell,
  ideology: StructureIdeology
): GameState {
  if (state.ideologyCardStock[ideology] <= 0) {
    return {
      ...state,
      selectedTile: { row: targetCell.row, col: targetCell.col },
      selectedIdeologyCard: null,
      message: createMessage(
        "error",
        `${ideology === "tech" ? "Tech" : "Magic"} stock is empty. Forge more with mixed resources.`
      )
    };
  }

  if (
    state.ideologyApplicationsThisTurn >= state.ideologyApplicationsPerTurnLimit
  ) {
    return {
      ...state,
      selectedTile: { row: targetCell.row, col: targetCell.col },
      selectedIdeologyCard: null,
      message: createMessage(
        "error",
        `Ideology applications are capped at ${state.ideologyApplicationsPerTurnLimit} per turn. End turn to refresh.`
      )
    };
  }

  if (!targetCell.structureId) {
    return {
      ...state,
      selectedTile: { row: targetCell.row, col: targetCell.col },
      message: createMessage(
        "error",
        "Ideology upgrades can only be applied to built structures."
      )
    };
  }

  const currentTraits = getCellIdeologyList(targetCell);
  const ideologyLabel = ideology === "tech" ? "Tech" : "Magic";

  if (currentTraits.includes(ideology)) {
    return {
      ...state,
      selectedTile: { row: targetCell.row, col: targetCell.col },
      message: createMessage(
        "info",
        `${getStructureCardDefinition(targetCell.structureId).title} already has ${ideologyLabel}.`
      )
    };
  }

  if (currentTraits.length >= MAX_IDEOLOGY_TRAITS_PER_STRUCTURE) {
    return {
      ...state,
      selectedTile: { row: targetCell.row, col: targetCell.col },
      message: createMessage(
        "error",
        `${getStructureCardDefinition(targetCell.structureId).title} already has ${MAX_IDEOLOGY_TRAITS_PER_STRUCTURE} ideology traits.`
      )
    };
  }

  const nextTraits = normalizeIdeologyTraits([...currentTraits, ideology]);
  const structureTitle = getStructureCardDefinition(targetCell.structureId).title;
  const traitText = nextTraits.map((trait) => trait.toUpperCase()).join(" + ");
  const nextUsed = state.ideologyApplicationsThisTurn + 1;
  const oppositeIdeology: StructureIdeology = ideology === "tech" ? "magic" : "tech";
  const shouldLockOppositeStartingStock =
    state.ideologyApplicationsThisTurn === 0 &&
    state.ideologyCardStock.tech > 0 &&
    state.ideologyCardStock.magic > 0;
  const nextStock: IdeologyCardStock = {
    ...state.ideologyCardStock,
    [ideology]: Math.max(0, state.ideologyCardStock[ideology] - 1),
    ...(shouldLockOppositeStartingStock ? { [oppositeIdeology]: 0 } : {})
  };
  const lockNote = shouldLockOppositeStartingStock
    ? ` ${oppositeIdeology === "tech" ? "Tech" : "Magic"} starting stock set to 0 this round.`
    : "";
  const actionText = `${structureTitle} at ${getSiteLabelForCell(targetCell)} gained ${ideologyLabel} (${traitText}). Ideology plays ${nextUsed}/${state.ideologyApplicationsPerTurnLimit} this turn.${lockNote}`;

  return withResolvedDerivedState({
    ...state,
    board: state.board.map((cell) =>
      cell.id === targetCell.id ? withCellIdeologies(cell, nextTraits) : cell
    ),
    ideologyApplicationsThisTurn: nextUsed,
    selectedIdeologyCard: null,
    selectedTile: { row: targetCell.row, col: targetCell.col },
    message: createMessage("success", actionText),
    ideologyCardStock: nextStock,
    activityLog: appendLog(state, actionText)
  });
}

export function handleTileClick(
  state: GameState,
  row: number,
  col: number
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  const targetCell = state.board.find(
    (cell) => cell.row === row && cell.col === col
  );

  if (!targetCell) {
    return state;
  }

  if (
    !state.selectedCardInstanceId &&
    !state.selectedNodeStructureId &&
    !state.selectedIdeologyCard
  ) {
    return {
      ...state,
      selectedTile: { row, col },
      message: createMessage(
        "info",
        targetCell.terrain === "core"
          ? "Core selected. Build around it and keep nearby support strong."
          : `${getSiteLabelForCell(targetCell)} selected. Choose a build action, or dismantle the current structure.`
      )
    };
  }

  if (targetCell.terrain === "core") {
    return {
      ...state,
      selectedTile: { row, col },
      message: createMessage(
        "error",
        "The Core is fixed in the center. Build around it, not on top of it."
      )
    };
  }

  if (
    state.selectedIdeologyCard &&
    !state.selectedCardInstanceId &&
    !state.selectedNodeStructureId
  ) {
    return applyIdeologyUpgradeToCell(state, targetCell, state.selectedIdeologyCard);
  }

  if (targetCell.structureId !== null) {
    if (state.selectedCardInstanceId) {
      const selectedCard = state.hand.find(
        (card) => card.instanceId === state.selectedCardInstanceId
      );

      if (selectedCard?.structureId === targetCell.structureId) {
        if (targetCell.stackLevel >= MAX_STRUCTURE_STACK) {
          return {
            ...state,
            selectedTile: { row, col },
            message: createMessage(
              "error",
              `${getStructureCardDefinition(targetCell.structureId).title} is already at max stack (${MAX_STRUCTURE_STACK}).`
            )
          };
        }

        return withResolvedDerivedState({
          ...state,
          board: stackOnBoard(state.board, targetCell.id),
          hand: removeCardFromHand(state.hand, selectedCard.instanceId),
          discardPile: [...state.discardPile, selectedCard],
          selectedCardInstanceId: null,
          selectedTile: { row, col },
          message: createMessage(
            "success",
            `${getStructureCardDefinition(targetCell.structureId).title} stack increased to ${targetCell.stackLevel + 1}/${MAX_STRUCTURE_STACK} at ${getSiteLabelForCell(targetCell)}.`
          ),
          activityLog: appendLog(
            state,
            `Stacked ${getStructureCardDefinition(targetCell.structureId).title} to ${targetCell.stackLevel + 1}/${MAX_STRUCTURE_STACK} at ${getSiteLabelForCell(targetCell)}.`
          )
        });
      }
    }

    return {
      ...state,
      selectedTile: { row, col },
      message: createMessage(
        "error",
        `${getSiteLabelForCell(targetCell)} already contains ${getStructureCardDefinition(targetCell.structureId).title}.`
      )
    };
  }

  if (state.selectedNodeStructureId) {
    const nodeDefinition = getNodeDefinition("scrap-bastion");

    return withResolvedDerivedState({
      ...state,
      board: buildOnBoard(state.board, row, col, state.selectedNodeStructureId),
      resources: {
        ...state.resources,
        materials: state.resources.materials - nodeDefinition.cost.materials,
        progress: state.resources.progress - nodeDefinition.cost.progress
      },
      selectedNodeStructureId: null,
      connectModeEnabled: false,
      selectedIdeologyCard: null,
      selectedTile: { row, col },
      message: createMessage(
        "success",
        `${nodeDefinition.title} founded on ${getSiteLabelForCell(targetCell)}.`
      ),
      activityLog: appendLog(
        state,
        `Founded ${nodeDefinition.title} at ${getSiteLabelForCell(targetCell)}.`
      )
    });
  }

  const selectedCard = state.hand.find(
    (card) => card.instanceId === state.selectedCardInstanceId
  );

  if (!selectedCard) {
    return {
      ...state,
      selectedCardInstanceId: null,
      message: createMessage("error", "The selected card is no longer in hand.")
    };
  }

  const definition = getStructureCardDefinition(selectedCard.structureId);

  if (
    selectedCard.structureId === "well" &&
    countBuiltStructures(state, "well") >= WELL_LIMIT
  ) {
    return {
      ...state,
      selectedTile: { row, col },
      message: createMessage(
        "error",
        "You already have 2 active Wells. Salvage this Well or choose another structure."
      )
    };
  }

  const buildEffect = getBuildEffect(selectedCard.structureId);

  return withResolvedDerivedState({
    ...state,
    board: buildOnBoard(state.board, row, col, selectedCard.structureId),
    hand: removeCardFromHand(state.hand, selectedCard.instanceId),
    discardPile: [...state.discardPile, selectedCard],
    resources: buildEffect
      ? {
          ...state.resources,
          food: state.resources.food + (buildEffect.food ?? 0),
          materials: state.resources.materials + (buildEffect.materials ?? 0),
          progress: state.resources.progress + (buildEffect.progress ?? 0),
          core: withClampedCore(state.resources.core + (buildEffect.core ?? 0)),
          intel: state.resources.intel + (buildEffect.intel ?? 0)
        }
      : state.resources,
    selectedCardInstanceId: null,
    connectModeEnabled: false,
    selectedIdeologyCard: null,
    selectedTile: { row, col },
    message: createMessage(
      "success",
      `${definition.title} built on ${getSiteLabelForCell(targetCell)}.${buildEffect ? ` ${buildEffect.note}` : ""}`
    ),
    activityLog: appendLog(
      state,
      `Built ${definition.title} at ${getSiteLabelForCell(targetCell)}.${buildEffect ? ` ${buildEffect.note}` : ""}`
    )
  });
}

export function applyIdeologyToSelectedStructure(
  state: GameState,
  ideology: StructureIdeology
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  if (!state.selectedTile) {
    return {
      ...state,
      selectedIdeologyCard: null,
      message: createMessage(
        "error",
        "Select a built structure first, then apply Tech or Magic upgrade."
      )
    };
  }

  const targetCell = state.board.find(
    (cell) =>
      cell.row === state.selectedTile?.row && cell.col === state.selectedTile?.col
  );

  if (!targetCell) {
    return state;
  }

  if (targetCell.terrain === "core" || !targetCell.structureId) {
    return {
      ...state,
      selectedIdeologyCard: null,
      message: createMessage(
        "error",
        "Tech and Magic upgrades can only be applied to built non-core structures."
      )
    };
  }

  return applyIdeologyUpgradeToCell(state, targetCell, ideology);
}

function getSalvageModeLabel(mode: GameState["salvageMode"]): string {
  return mode === "application" ? "application points" : "resources";
}

export function setSalvageMode(
  state: GameState,
  mode: GameState["salvageMode"]
): GameState {
  if (state.phase !== "build" || state.salvageMode === mode) {
    return state;
  }

  return {
    ...state,
    salvageMode: mode,
    message: createMessage(
      "info",
      mode === "application"
        ? "Salvage mode set to Application Points. Each salvaged card grants +1 AP."
        : "Salvage mode set to Resources."
    )
  };
}

export function convertApplicationPointsToIdeologyCard(
  state: GameState,
  ideology: StructureIdeology
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  if (state.applicationPoints < 2) {
    return {
      ...state,
      message: createMessage(
        "error",
        `Need 2 Application Points to craft ${ideology === "tech" ? "Tech" : "Magic"} stock.`
      )
    };
  }

  const ideologyLabel = ideology === "tech" ? "Tech" : "Magic";
  const nextPoints = state.applicationPoints - 2;
  const nextStock = incrementIdeologyCardStock(state.ideologyCardStock, ideology, 1);

  return {
    ...state,
    applicationPoints: nextPoints,
    ideologyCardStock: nextStock,
    message: createMessage(
      "success",
      `${ideologyLabel} stock +1 from Application Points. AP now ${nextPoints}.`
    ),
    activityLog: appendLog(
      state,
      `Converted 2 Application Points into ${ideologyLabel} stock (+1).`
    )
  };
}

export function salvageCard(
  state: GameState,
  instanceId: string,
  modeOverride?: GameState["salvageMode"]
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  const card = state.hand.find((entry) => entry.instanceId === instanceId);

  if (!card) {
    return state;
  }

  const definition = getStructureCardDefinition(card.structureId);
  const salvageMode = modeOverride ?? state.salvageMode;
  const nextApplicationPoints = state.applicationPoints + 1;

  const salvagePassiveBonus = resolveSalvagePassiveBonus(state, card.structureId);
  let nextState: GameState = {
    ...state,
    hand: removeCardFromHand(state.hand, instanceId),
    discardPile: [...state.discardPile, card],
    selectedCardInstanceId:
      state.selectedCardInstanceId === instanceId ? null : state.selectedCardInstanceId
  };

  if (salvageMode === "application") {
    return withResolvedDerivedState({
      ...nextState,
      applicationPoints: nextApplicationPoints,
      message: createMessage(
        "success",
        `${definition.title} salvaged for +1 Application Point (${nextApplicationPoints} AP total, 2 AP -> 1 Tech/Magic stock).`
      ),
      activityLog: appendLog(
        state,
        `Salvaged ${definition.title} for +1 Application Point (${nextApplicationPoints} total).`
      )
    });
  }

  switch (card.structureId) {
    case "farm":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          food: nextState.resources.food + 2,
          materials: nextState.resources.materials + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Farm salvaged for +2 Food.${
            salvagePassiveBonus.note ? ` ${salvagePassiveBonus.note}` : ""
          }`
        )
      };
      break;
    case "mine":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          materials: nextState.resources.materials + 2 + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Mine salvaged for +2 Materials${
            salvagePassiveBonus.materialsBonus > 0 ? " and +1 bonus Materials" : ""
          }.`
        )
      };
      break;
    case "watchtower":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          intel: nextState.resources.intel + 1,
          materials: nextState.resources.materials + salvagePassiveBonus.materialsBonus
        },
        scoutReport: resolveWatchtowerReport(nextState),
        message: createMessage(
          "success",
          `Watchtower salvaged. Recon updated and Intel increased by 1.${
            salvagePassiveBonus.note ? ` ${salvagePassiveBonus.note}` : ""
          }`
        )
      };
      break;
    case "well": {
      const damagedStructure = getMostDamagedStructure(nextState.board);

      if (damagedStructure) {
        nextState = withResolvedDerivedState({
          ...nextState,
          board: repairStructure(nextState.board, damagedStructure.id),
          message: createMessage(
            "success",
            `Well salvaged. ${damagedStructure.id} was repaired.`
          )
        });
      } else {
        nextState = {
          ...nextState,
          resources: {
            ...nextState.resources,
            core: withClampedCore(nextState.resources.core + 1)
          },
          message: createMessage(
            "success",
            "Well salvaged. No damaged structure existed, so Core healed by 1."
          )
        };
      }
      break;
    }
    case "muster-hall":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          core: withClampedCore(nextState.resources.core + 2),
          materials: nextState.resources.materials + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Muster Hall salvaged for +2 Core.${
            salvagePassiveBonus.note ? ` ${salvagePassiveBonus.note}` : ""
          }`
        )
      };
      break;
    case "workshop":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          progress: nextState.resources.progress + 2,
          materials: nextState.resources.materials + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Workshop salvaged for +2 Progress.${
            salvagePassiveBonus.note ? ` ${salvagePassiveBonus.note}` : ""
          }`
        )
      };
      break;
    case "barricade-yard":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          core: withClampedCore(nextState.resources.core + 1),
          materials: nextState.resources.materials + 1 + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Barricade Yard salvaged for +1 Materials and Core +1.${
            salvagePassiveBonus.note ? ` ${salvagePassiveBonus.note}` : ""
          }`
        )
      };
      break;
    case "scrounge-depot":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          materials: nextState.resources.materials + 2 + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Scrounge Depot salvaged for +2 Materials${
            salvagePassiveBonus.materialsBonus > 0 ? " and +1 bonus Materials" : ""
          }.`
        )
      };
      break;
    case "relay-pylon":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          intel: nextState.resources.intel + 1,
          materials: nextState.resources.materials + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Relay Pylon salvaged for Intel +1.${
            salvagePassiveBonus.note ? ` ${salvagePassiveBonus.note}` : ""
          }`
        )
      };
      break;
    case "junction-array":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          progress: nextState.resources.progress + 2,
          materials: nextState.resources.materials + salvagePassiveBonus.materialsBonus
        },
        message: createMessage(
          "success",
          `Junction Array salvaged for +2 Progress.${
            salvagePassiveBonus.note ? ` ${salvagePassiveBonus.note}` : ""
          }`
        )
      };
      break;
    case "ward-sigil":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          core: withClampedCore(nextState.resources.core + 1)
        },
        message: createMessage(
          "success",
          "Ward Sigil salvaged. Core healed by 1."
        )
      };
      break;
    case "ley-lantern":
      nextState = {
        ...nextState,
        resources: {
          ...nextState.resources,
          food: nextState.resources.food + 1,
          core: withClampedCore(nextState.resources.core + 1)
        },
        message: createMessage(
          "success",
          "Ley Lantern salvaged for +1 Food and Core +1."
        )
      };
      break;
    case "scrap-bastion":
      return state;
  }

  return withResolvedDerivedState({
    ...nextState,
    activityLog: appendLog(nextState, `Salvaged ${definition.title} for resources.`)
  });
}

export function salvageAllCards(state: GameState): GameState {
  if (state.phase !== "build" || state.hand.length === 0) {
    return state;
  }

  const salvagedTitles = state.hand.map((card) => getStructureCardDefinition(card.structureId).title);
  let nextState = state;

  for (const card of state.hand) {
    nextState = salvageCard(nextState, card.instanceId);
  }

  const summary =
    salvagedTitles.length <= 3
      ? salvagedTitles.join(", ")
      : `${salvagedTitles.slice(0, 3).join(", ")}, +${salvagedTitles.length - 3} more`;

  return {
    ...nextState,
    message: createMessage(
      "success",
      `Salvaged the rest of the hand for ${getSalvageModeLabel(state.salvageMode)}: ${summary}.`
    ),
    activityLog: appendLog(
      nextState,
      `Bulk salvaged remaining hand for ${getSalvageModeLabel(state.salvageMode)}: ${summary}.`
    )
  };
}

export function forgeIdeologyCard(
  state: GameState,
  ideology: StructureIdeology
): GameState {
  if (state.phase !== "build") {
    return state;
  }

  const forgePlan = getIdeologyForgePlan(state);

  if (!forgePlan.affordable) {
    return {
      ...state,
      message: createMessage(
        "error",
        "Not enough resources to forge another ideology card this turn."
      )
    };
  }

  const cost = forgePlan.cost;
  const nextResources = {
    ...state.resources,
    food: state.resources.food - cost.food,
    materials: state.resources.materials - cost.materials,
    progress: state.resources.progress - cost.progress,
    intel: state.resources.intel - cost.intel
  };
  const ideologyLabel = ideology === "tech" ? "Tech" : "Magic";
  const costText = formatForgeCostParts(cost);

  return {
    ...state,
    resources: nextResources,
    ideologyCardStock: incrementIdeologyCardStock(state.ideologyCardStock, ideology, 1),
    message: createMessage(
      "success",
      `${ideologyLabel} card forged (cost: ${costText}). Stock: ${state.ideologyCardStock[ideology] + 1}. Unspent forged stock resets next round.`
    ),
    activityLog: appendLog(
      state,
      `Forged ${ideologyLabel} card (cost: ${costText}). Unspent forged stock resets next round.`
    )
  };
}

export function dismantleSelectedStructure(state: GameState): GameState {
  if (state.phase !== "build" || !state.selectedTile) {
    return state;
  }

  const targetCell = state.board.find(
    (cell) => cell.row === state.selectedTile?.row && cell.col === state.selectedTile?.col
  );

  if (!targetCell || targetCell.terrain === "core" || !targetCell.structureId) {
    return {
      ...state,
      message: createMessage("error", "Select a built structure to dismantle it.")
    };
  }

  const definition = getStructureCardDefinition(targetCell.structureId);
  const refund = getDismantleRefund(targetCell.structureId);

  return withResolvedDerivedState({
    ...state,
    board: clearStructureFromBoard(state.board, targetCell.id),
    resources: {
      ...state.resources,
      food: state.resources.food + (refund.food ?? 0),
      materials: state.resources.materials + (refund.materials ?? 0),
      progress: state.resources.progress + (refund.progress ?? 0),
      core: withClampedCore(state.resources.core + (refund.core ?? 0)),
      intel: state.resources.intel + (refund.intel ?? 0)
    },
    selectedCardInstanceId: null,
    selectedNodeStructureId: null,
    connectModeEnabled: false,
    selectedIdeologyCard: null,
    message: createMessage(
      "success",
      `${definition.title} dismantled. ${refund.note}`
    ),
    activityLog: appendLog(
      state,
      `Dismantled ${definition.title}. ${refund.note}`
    )
  });
}

export function setBoardViewMode(
  state: GameState,
  boardViewMode: GameState["boardViewMode"]
): GameState {
  if (state.boardViewMode === boardViewMode) {
    return state;
  }

  return {
    ...state,
    boardViewMode,
    message: createMessage(
      "info",
      boardViewMode === "build"
        ? "Build View active. The board now emphasizes physical placement and maintenance rings."
        : "Pattern View active. Ideology color and live pattern influence are emphasized."
    )
  };
}

export function buyShopOffer(state: GameState, offerId: string): GameState {
  if (state.phase !== "build") {
    return state;
  }

  const parsedOfferId = offerId as ShopOfferId;

  switch (parsedOfferId) {
    case "charter-farm": {
      const cost = getShopOfferCost(state, "charter-farm");

      if (state.resources.materials < cost.materials) {
        return {
          ...state,
          message: createMessage(
            "error",
            `Need ${cost.materials} Materials to buy a Farm charter.`
          )
        };
      }

      const addedCards = addBuildCardsToDrawPile(state, { farm: 1 });

      return withResolvedDerivedState({
        ...state,
        ...addedCards,
        resources: {
          ...state.resources,
          materials: state.resources.materials - cost.materials
        },
        message: createMessage(
          "success",
          `Market: bought 1 Farm card for ${cost.materials} Materials.`
        ),
        activityLog: appendLog(
          state,
          `Market purchase: Farm charter (${cost.materials} Materials).`
        )
      });
    }
    case "charter-workshop": {
      const cost = getShopOfferCost(state, "charter-workshop");

      if (state.resources.materials < cost.materials) {
        return {
          ...state,
          message: createMessage(
            "error",
            `Need ${cost.materials} Materials to buy a Workshop charter.`
          )
        };
      }

      const addedCards = addBuildCardsToDrawPile(state, { workshop: 1 });

      return withResolvedDerivedState({
        ...state,
        ...addedCards,
        resources: {
          ...state.resources,
          materials: state.resources.materials - cost.materials
        },
        message: createMessage(
          "success",
          `Market: bought 1 Workshop card for ${cost.materials} Materials.`
        ),
        activityLog: appendLog(
          state,
          `Market purchase: Workshop charter (${cost.materials} Materials).`
        )
      });
    }
    case "field-repair": {
      const cost = getShopOfferCost(state, "field-repair");

      if (state.resources.materials < cost.materials) {
        return {
          ...state,
          message: createMessage(
            "error",
            `Need ${cost.materials} Materials for field repair.`
          )
        };
      }

      const damagedTarget = getFieldRepairTarget(state);

      if (!damagedTarget) {
        return {
          ...state,
          message: createMessage("error", "No damaged structure is available for field repair.")
        };
      }

      const definition = getStructureCardDefinition(damagedTarget.structureId!);
      const before = damagedTarget.condition;
      const after = Math.min(3, Math.max(1, before) + 1);
      const siteLabel = getSiteLabelForCell(damagedTarget);

      return withResolvedDerivedState({
        ...state,
        board: repairStructure(state.board, damagedTarget.id),
        resources: {
          ...state.resources,
          materials: state.resources.materials - cost.materials
        },
        selectedTile: {
          row: damagedTarget.row,
          col: damagedTarget.col
        },
        message: createMessage(
          "success",
          `Field Repair: ${definition.title} at ${siteLabel} restored from ${before}/3 to ${after}/3 for ${cost.materials} Materials.`
        ),
        activityLog: appendLog(
          state,
          `Field Repair: ${definition.title} at ${siteLabel} ${before}/3 -> ${after}/3 (${cost.materials} Materials).`
        )
      });
    }
    case "food-for-materials": {
      const cost = getShopOfferCost(state, "food-for-materials");

      if (state.resources.food < cost.food) {
        return {
          ...state,
          message: createMessage(
            "error",
            `Need ${cost.food} Food to trade for Materials.`
          )
        };
      }

      return {
        ...state,
        resources: {
          ...state.resources,
          food: state.resources.food - cost.food,
          materials: state.resources.materials + 3
        },
        message: createMessage(
          "success",
          `Market trade: ${cost.food} Food -> 3 Materials.`
        ),
        activityLog: appendLog(
          state,
          `Market trade: converted ${cost.food} Food into 3 Materials.`
        )
      };
    }
    case "materials-for-progress": {
      const cost = getShopOfferCost(state, "materials-for-progress");

      if (state.resources.materials < cost.materials) {
        return {
          ...state,
          message: createMessage(
            "error",
            `Need ${cost.materials} Materials to trade for Progress.`
          )
        };
      }

      return {
        ...state,
        resources: {
          ...state.resources,
          materials: state.resources.materials - cost.materials,
          progress: state.resources.progress + 2
        },
        message: createMessage(
          "success",
          `Market trade: ${cost.materials} Materials -> 2 Progress.`
        ),
        activityLog: appendLog(
          state,
          `Market trade: converted ${cost.materials} Materials into 2 Progress.`
        )
      };
    }
    case "raid-tactic": {
      const cost = getShopOfferCost(state, "raid-tactic");

      if (
        state.resources.materials < cost.materials ||
        state.resources.progress < cost.progress
      ) {
        return {
          ...state,
          message: createMessage(
            "error",
            `Need ${cost.materials} Materials and ${cost.progress} Progress to commission a raid tactic.`
          )
        };
      }

      const tacticPurchase = addRaidTacticPurchase(state);
      const purchasedCard = tacticPurchase.bonusCombatCards[tacticPurchase.bonusCombatCards.length - 1];

      return withResolvedDerivedState({
        ...state,
        ...tacticPurchase,
        resources: {
          ...state.resources,
          materials: state.resources.materials - cost.materials,
          progress: state.resources.progress - cost.progress
        },
        message: createMessage(
          "success",
          `Market: commissioned ${purchasedCard.title} for the next raid pool (${cost.materials} Materials, ${cost.progress} Progress).`
        ),
        activityLog: appendLog(
          state,
          `Market purchase: commissioned raid tactic ${purchasedCard.title} (${cost.materials} Materials, ${cost.progress} Progress).`
        )
      });
    }
    default:
      return state;
  }
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== "build") {
    return state;
  }

  if (state.hand.length > 0) {
    return {
      ...state,
      message: createMessage(
        "error",
        "Resolve every card in hand before ending the turn. Unused cards are not auto-salvaged."
      )
    };
  }

  const farmCount = countBuiltStructures(state, "farm");
  const mineCount = countBuiltStructures(state, "mine");
  const workshopCount = countBuiltStructures(state, "workshop");
  const expansionBonuses = getSettlementExpansionBonuses(state);
  const districtProgressBonus = expansionBonuses.districtProgressBonus;
  const applicationPointBonus = expansionBonuses.applicationPointBonus;
  const nextTurn = state.turn + 1;
  const nextRaidForecast = resolveRaidForecastForTurn(
    nextTurn,
    state.nextRaidTurn,
    state.nextRaidWindowStart,
    state.nextRaidWindowEnd
  );
  const yieldParts = [
    `+${farmCount} Food`,
    `+${mineCount} Materials`,
    `+${workshopCount} Progress`,
    districtProgressBonus > 0 ? `+${districtProgressBonus} District Progress` : "",
    applicationPointBonus > 0 ? `+${applicationPointBonus} Application Point${applicationPointBonus === 1 ? "" : "s"}` : ""
  ].filter((part) => part.length > 0);
  const yieldText = yieldParts.join(", ");

  let advancedState = withResolvedDerivedState({
    ...state,
    turn: nextTurn,
    nextRaidTurn: nextRaidForecast.nextRaidTurn,
    nextRaidWindowStart: nextRaidForecast.nextRaidWindowStart,
    nextRaidWindowEnd: nextRaidForecast.nextRaidWindowEnd,
    resources: {
      ...state.resources,
      food: state.resources.food + farmCount,
      materials: state.resources.materials + mineCount,
      progress: state.resources.progress + workshopCount + districtProgressBonus
    },
    applicationPoints: state.applicationPoints + applicationPointBonus,
    selectedTile: null,
    selectedCardInstanceId: null,
    selectedNodeStructureId: null,
    connectModeEnabled: false,
    selectedIdeologyCard: null,
    ideologyApplicationsThisTurn: 0,
    ideologyCardStock: {
      tech: 1,
      magic: 1
    },
    message: createMessage(
      "success",
      `Turn ${nextTurn} advanced. End-turn yields: ${yieldText}.`
    ),
    activityLog: appendLog(
      state,
      `Advanced to turn ${nextTurn}. Production: ${yieldText}.`
    )
  });

  advancedState = applyMaintenancePressure(advancedState);
  advancedState = applyEndTurnPassiveBonuses(advancedState);

  if (isRaidTurn(nextTurn, nextRaidForecast.nextRaidTurn)) {
    return beginPreRaidPhase({
      ...advancedState,
      hand: [],
      selectedCardInstanceId: null,
      selectedNodeStructureId: null,
      connectModeEnabled: false,
      selectedIdeologyCard: null
    });
  }

  const refillState = drawUpToHandSize(advancedState);

  return {
    ...advancedState,
    ...refillState,
    message: createMessage(
      "success",
      `Turn ${nextTurn} build phase begins. Drawn back up to ${Math.min(
        MAX_HAND_SIZE,
        refillState.hand.length
      )} cards.`
    )
  };
}

export function selectRaidCard(
  state: GameState,
  cardId: string
): GameState {
  if (state.phase !== "raid" || !state.raid || state.raid.outcome) {
    return state;
  }

  const wasSelected = state.raid.selectedPlayerCardIds.includes(cardId);
  const selectedCard = state.raid.playerHand.find((card) => card.id === cardId);
  const remainingEnergy = getRaidRemainingEnergy(state);
  const selectedCost = getRaidSelectedCost(state);
  const remainingSelectionBudget = remainingEnergy - selectedCost;

  if (
    !wasSelected &&
    selectedCard &&
    selectedCard.cost > remainingSelectionBudget
  ) {
    return {
      ...state,
      message: createMessage(
        "error",
        remainingEnergy <= 0
          ? "No energy remains this turn."
          : `${selectedCard.title} costs ${selectedCard.cost} energy, but only ${remainingSelectionBudget} is still open in the current queue.`
      )
    };
  }

  const nextRaid = toggleRaidCardSelection(state.raid, cardId);
  const nextSelectedCard = nextRaid.playerHand.find((card) => card.id === cardId);

  return {
    ...state,
    raid: nextRaid,
    message: createMessage(
      "info",
      wasSelected
        ? "Combat card selection cleared."
        : `${nextSelectedCard?.title ?? "Combat card"} queued for ${nextSelectedCard?.cost ?? 1} energy.`
    )
  };
}

export function playRaidCards(state: GameState): GameState {
  if (state.phase !== "raid" || !state.raid || state.raid.outcome) {
    return state;
  }

  if (state.raid.selectedPlayerCardIds.length === 0) {
    return {
      ...state,
      message: createMessage("error", "Select at least one combat card to play.")
    };
  }

  const nextRaid = playSelectedRaidCards(state);
  const latestLine = nextRaid.combatLog[nextRaid.combatLog.length - 1];

  if (!nextRaid.outcome) {
    return {
      ...state,
      raid: nextRaid,
      message: createMessage("success", latestLine ?? "Combat cards resolved."),
      activityLog: appendLog(
        state,
        `Played combat cards on raid turn ${state.turn}. ${latestLine ?? ""}`.trim()
      )
    };
  }

  return finalizeRaidState(state, nextRaid);
}

export function drawRaidCard(state: GameState): GameState {
  if (state.phase !== "raid" || !state.raid || state.raid.outcome) {
    return state;
  }

  const nextRaid = drawRaidCardAction(state.raid);

  if (nextRaid === state.raid) {
    return {
      ...state,
      message: createMessage(
        "error",
        getRaidRemainingEnergy(state) <= 0
          ? "No energy remains this turn."
          : "No more combat cards can be drawn."
      )
    };
  }

  const latestLine = nextRaid.combatLog[nextRaid.combatLog.length - 1];

  return {
    ...state,
    raid: nextRaid,
    message: createMessage("info", latestLine ?? "Drew 1 combat card."),
    activityLog: appendLog(
      state,
      `Spent 1 raid energy to draw a combat card. ${latestLine ?? ""}`.trim()
    )
  };
}

export function startRaidFromPrep(state: GameState): GameState {
  if (state.phase !== "pre-raid") {
    return state;
  }

  if (state.activeCombatDeckTemplateIds.length === 0) {
    return {
      ...state,
      message: createMessage("error", "Activate at least one combat card before starting the raid.")
    };
  }

  const raidState = createRaidState(state);

  return {
    ...state,
    phase: "raid",
    raid: raidState,
    message: createMessage(
      "info",
      `Raid turn ${state.turn}: ${getUpcomingRaidCard(state).title} has begun. Draw ${raidState.playerHand.length} combat cards, spend up to ${raidState.maxEnergyPerTurn} energy each turn, then end turn to let the raiders answer.`
    ),
    activityLog: appendLog(state, `Raid turn ${state.turn} began with a prepared combat pool.`)
  };
}

export function toggleActiveCombatDeckCard(
  state: GameState,
  templateId: string
): GameState {
  if (state.phase !== "post-raid" && state.phase !== "pre-raid") {
    return state;
  }

  const targetCard = state.combatCardPool.find((card) => card.templateId === templateId);

  if (!targetCard) {
    return state;
  }

  const isActive = state.activeCombatDeckTemplateIds.includes(templateId);

  if (isActive) {
    if (state.activeCombatDeckTemplateIds.length <= 1) {
      return {
        ...state,
        message: createMessage("error", "Keep at least one combat card active for the next raid.")
      };
    }

    return {
      ...state,
      activeCombatDeckTemplateIds: state.activeCombatDeckTemplateIds.filter(
        (activeId) => activeId !== templateId
      ),
      focusedCombatCardTemplateIds: state.focusedCombatCardTemplateIds.filter(
        (focusedId) => focusedId !== templateId
      ),
      hasCustomizedCombatDeck: true,
      message: createMessage("info", `${targetCard.title} removed from the active combat deck.`),
      activityLog: appendLog(state, `Removed ${targetCard.title} from the active combat deck.`)
    };
  }

  if (state.activeCombatDeckTemplateIds.length >= state.activeCombatDeckMaxSize) {
    return {
      ...state,
      message: createMessage(
        "error",
        `The active combat deck is full (${state.activeCombatDeckMaxSize} cards). Remove one first.`
      )
    };
  }

  return {
    ...state,
    activeCombatDeckTemplateIds: [...state.activeCombatDeckTemplateIds, templateId],
    hasCustomizedCombatDeck: true,
    message: createMessage("success", `${targetCard.title} added to the active combat deck.`),
    activityLog: appendLog(state, `Added ${targetCard.title} to the active combat deck.`)
  };
}

export function toggleCombatCardFocus(
  state: GameState,
  templateId: string
): GameState {
  if (state.phase !== "pre-raid") {
    return state;
  }

  if (!state.activeCombatDeckTemplateIds.includes(templateId)) {
    return {
      ...state,
      message: createMessage("error", "Only active combat cards can be prioritized.")
    };
  }

  const targetCard = state.combatCardPool.find((card) => card.templateId === templateId);

  if (!targetCard) {
    return state;
  }

  const isFocused = state.focusedCombatCardTemplateIds.includes(templateId);

  if (isFocused) {
    return {
      ...state,
      focusedCombatCardTemplateIds: state.focusedCombatCardTemplateIds.filter(
        (focusedId) => focusedId !== templateId
      ),
      hasCustomizedCombatDeck: true,
      message: createMessage("info", `${targetCard.title} returned to normal copy priority.`)
    };
  }

  return {
    ...state,
    focusedCombatCardTemplateIds: [...state.focusedCombatCardTemplateIds, templateId],
    hasCustomizedCombatDeck: true,
    message: createMessage(
      "success",
      `${targetCard.title} is focused and more likely to gain a second raid-deck copy.`
    )
  };
}

export function resetCombatDeckToRecommended(state: GameState): GameState {
  if (state.phase !== "pre-raid") {
    return state;
  }

  return withResolvedCombatDeckState({
    ...state,
    hasCustomizedCombatDeck: false,
    message: createMessage(
      "info",
      "Recommended 12-card type set restored from current settlement and focus priorities."
    )
  });
}

export function claimPostRaidReward(state: GameState, rewardId: string): GameState {
  if (state.phase !== "post-raid") {
    return state;
  }

  if (state.claimedPostRaidRewardId) {
    return {
      ...state,
      message: createMessage("info", "A post-raid reward has already been claimed.")
    };
  }

  const rewardChoice = state.postRaidRewardChoices.find((choice) => choice.id === rewardId);

  if (!rewardChoice) {
    return state;
  }

  let nextState: GameState = {
    ...state,
    claimedPostRaidRewardId: rewardChoice.id
  };

  switch (rewardChoice.kind) {
    case "combat-card": {
      const rewardCard = rewardChoice.combatCardTemplate;

      if (!rewardCard) {
        return state;
      }

      const nextBonusCards = [...state.bonusCombatCards, rewardCard];
      let nextActiveIds = state.activeCombatDeckTemplateIds;

      if (!nextActiveIds.includes(rewardCard.templateId)) {
        if (nextActiveIds.length < state.activeCombatDeckMaxSize) {
          nextActiveIds = [...nextActiveIds, rewardCard.templateId];
        } else {
          const poolMap = new Map(
            [...state.combatCardPool, rewardCard].map((card) => [card.templateId, card])
          );
          const weakestActiveId = [...nextActiveIds].sort((leftId, rightId) => {
            const leftCard = poolMap.get(leftId);
            const rightCard = poolMap.get(rightId);

            return (
              scoreCombatCardForDeck(leftCard ?? rewardCard) -
              scoreCombatCardForDeck(rightCard ?? rewardCard)
            );
          })[0];

          if (
            weakestActiveId &&
            scoreCombatCardForDeck(rewardCard) >
              scoreCombatCardForDeck(poolMap.get(weakestActiveId) ?? rewardCard)
          ) {
            nextActiveIds = nextActiveIds.map((activeId) =>
              activeId === weakestActiveId ? rewardCard.templateId : activeId
            );
          }
        }
      }

      nextState = withResolvedDerivedState({
        ...nextState,
        bonusCombatCards: nextBonusCards,
        activeCombatDeckTemplateIds: nextActiveIds,
        message: createMessage(
          "success",
          `${rewardCard.title} added to the combat pool. Review the active deck before returning to build.`
        ),
        activityLog: appendLog(state, `Claimed post-raid combat reward: ${rewardCard.title}.`)
      });
      break;
    }
    case "build-card": {
      const structureId = rewardChoice.buildCardStructureId;

      if (!structureId) {
        return state;
      }

      const { cards, nextSequence } = createCardCopies(
        {
          [structureId]: 2
        },
        state.nextCardSequence
      );

      nextState = withResolvedDerivedState({
        ...nextState,
        drawPile: shuffle([...cards, ...state.drawPile]),
        nextCardSequence: nextSequence,
        message: createMessage(
          "success",
          `${getStructureCardDefinition(structureId).title} was chartered. Two copies entered the build draw flow.`
        ),
        activityLog: appendLog(
          state,
          `Claimed post-raid build reward: ${getStructureCardDefinition(structureId).title}.`
        )
      });
      break;
    }
    case "repair": {
      if (rewardChoice.repairCellId) {
        const targetCell = state.board.find((cell) => cell.id === rewardChoice.repairCellId);
        const targetTitle = targetCell?.structureId
          ? getStructureCardDefinition(targetCell.structureId).title
          : "Structure";

        nextState = withResolvedDerivedState({
          ...nextState,
          board: repairStructure(state.board, rewardChoice.repairCellId),
          message: createMessage("success", `${targetTitle} was repaired after the raid.`),
          activityLog: appendLog(state, `Claimed post-raid repair reward: ${targetTitle}.`)
        });
      } else {
        nextState = withResolvedDerivedState({
          ...nextState,
          resources: {
            ...state.resources,
            materials: state.resources.materials + 2,
            core: withClampedCore(state.resources.core + 1)
          },
          message: createMessage("success", "Reserve Stores claimed: +2 Materials and +1 Core."),
          activityLog: appendLog(state, "Claimed post-raid reserve stores.")
        });
      }
      break;
    }
  }

  return {
    ...nextState,
    claimedPostRaidRewardId: rewardChoice.id
  };
}

export function resolveRaid(state: GameState): GameState {
  if (state.phase !== "raid" || !state.raid || state.raid.outcome) {
    return state;
  }

  if (state.raid.selectedPlayerCardIds.length > 0) {
    return {
      ...state,
      message: createMessage(
        "error",
        "Play or clear the queued combat cards before ending the turn."
      )
    };
  }

  const nextRaid = resolveRaidEnemyTurn(state);
  const latestLine = nextRaid.combatLog[nextRaid.combatLog.length - 1];

  if (!nextRaid.outcome) {
    return {
      ...state,
      raid: nextRaid,
      message: createMessage(
        "info",
        latestLine ? `Raider turn resolved. ${latestLine}` : "Raider turn resolved."
      ),
      activityLog: appendLog(
        state,
        `Raider turn ${nextRaid.turnNumber - 1} resolved. ${latestLine ?? ""}`.trim()
      )
    };
  }

  return finalizeRaidState(state, nextRaid);
}

export function continueAfterRaid(state: GameState): GameState {
  if (!state.raid || !state.raid.outcome) {
    return state;
  }

  if (state.phase === "game-over" || state.phase === "victory") {
    return state;
  }

  if (state.phase === "post-raid" && !state.claimedPostRaidRewardId) {
    return {
      ...state,
      message: createMessage("error", "Claim a post-raid reward before returning to build.")
    };
  }

  const refillState = drawUpToHandSize({
    ...state,
    hand: []
  });

  return {
    ...state,
    ...refillState,
    phase: "build",
    raid: null,
    ...rollNextRaidForecastAfter(state.turn),
    postRaidRewardChoices: [],
    claimedPostRaidRewardId: null,
    selectedCardInstanceId: null,
    selectedNodeStructureId: null,
    connectModeEnabled: false,
    selectedIdeologyCard: null,
    ideologyApplicationsThisTurn: 0,
    ideologyCardStock: {
      tech: 1,
      magic: 1
    },
    selectedTile: null,
    message: createMessage(
      "success",
      `Raid resolved. Turn ${state.turn} build phase begins with ${refillState.hand.length} cards.`
    ),
    activityLog: appendLog(
      state,
      `Returned to build phase after raid turn ${state.turn}.`
    )
  };
}

