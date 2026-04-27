import "./styles.css";

import { createInitialGameState } from "./game/state/createInitialGameState";
import { GameStore } from "./game/state/gameStore";
import { renderCommandBrief } from "./ui/renderCommandBrief";
import { createSettlementBoardSurface } from "./ui/createSettlementBoardSurface";
import { renderHand } from "./ui/renderHand";
import { renderPatternDebug } from "./ui/renderPatternDebug";
import { renderPatterns } from "./ui/renderPatterns";
import { renderProgression } from "./ui/renderProgression";
import { renderRaid } from "./ui/renderRaid";
import { renderHud } from "./ui/renderHud";
import { renderIntel } from "./ui/renderIntel";

const appRoot = document.querySelector<HTMLElement>("#app");
const briefRoot = document.querySelector<HTMLElement>("#brief-root");
const hudRoot = document.querySelector<HTMLElement>("#hud-root");
const handRoot = document.querySelector<HTMLElement>("#hand-root");
const patternsRoot = document.querySelector<HTMLElement>("#patterns-root");
const progressionRoot = document.querySelector<HTMLElement>("#progression-root");
const patternDebugRoot = document.querySelector<HTMLElement>("#pattern-debug-root");
const intelRoot = document.querySelector<HTMLElement>("#intel-root");
const boardSurfaceTarget = document.querySelector<HTMLElement>("#phaser-target");
const boardShell = document.querySelector<HTMLElement>("#board-shell");
const raidRoot = document.querySelector<HTMLElement>("#raid-root");

if (!appRoot || !briefRoot || !hudRoot || !handRoot || !patternsRoot || !progressionRoot || !patternDebugRoot || !intelRoot || !boardSurfaceTarget || !boardShell || !raidRoot) {
  throw new Error("Expected the brief, HUD, hand, patterns, progression, raid, debug, intel, board shell, and board surface elements to exist.");
}

const store = new GameStore(createInitialGameState());

briefRoot.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const actionableElement = target.closest<HTMLElement>("[data-action]");

  if (!actionableElement) {
    return;
  }

  const action = actionableElement.dataset.action;

  const dismantleButton = target.closest<HTMLElement>('[data-action="dismantle-selected"]');

  if (dismantleButton) {
    store.dismantleSelectedStructure();
    return;
  }

  const menuBuildButton = target.closest<HTMLElement>('[data-action="menu-build-selected"]');

  if (menuBuildButton) {
    const row = Number(menuBuildButton.dataset.row);
    const col = Number(menuBuildButton.dataset.col);

    if (Number.isFinite(row) && Number.isFinite(col)) {
      store.handleTileClick(row, col);
    }

    return;
  }

  const menuSalvageButton = target.closest<HTMLElement>('[data-action="menu-salvage-selected"]');

  if (menuSalvageButton) {
    const cardId = menuSalvageButton.dataset.cardId;

    if (cardId) {
      store.salvageCard(cardId);
    }

    return;
  }

  const applyIdeologyButton = target.closest<HTMLElement>('[data-action="apply-ideology-upgrade"]');

  if (applyIdeologyButton) {
    const ideology = applyIdeologyButton.dataset.ideology;

    if (ideology === "tech" || ideology === "magic") {
      store.applyIdeologyToSelectedStructure(ideology);
    }

    return;
  }

  const forgeIdeologyButton = target.closest<HTMLElement>('[data-action="forge-ideology-upgrade"]');

  if (forgeIdeologyButton) {
    const ideology = forgeIdeologyButton.dataset.ideology;

    if (ideology === "tech" || ideology === "magic") {
      store.forgeIdeologyCard(ideology);
    }

    return;
  }

  const buyShopOfferButton = target.closest<HTMLElement>('[data-action="buy-shop-offer"]');

  if (buyShopOfferButton) {
    const offerId = buyShopOfferButton.dataset.offerId;

    if (offerId) {
      store.buyShopOffer(offerId);
    }

    return;
  }

  const convertApplicationPointsButton = target.closest<HTMLElement>('[data-action="convert-application-points"]');

  if (convertApplicationPointsButton) {
    const ideology = convertApplicationPointsButton.dataset.ideology;

    if (ideology === "tech" || ideology === "magic") {
      store.convertApplicationPoints(ideology);
    }

    return;
  }

  if (action === "tutorial-open") {
    store.showTutorial();
    return;
  }

  if (action === "tutorial-prev") {
    store.previousTutorialStep();
    return;
  }

  if (action === "tutorial-next") {
    store.nextTutorialStep();
    return;
  }

  if (action === "tutorial-finish") {
    store.finishTutorial();
    return;
  }

  if (action === "tutorial-close") {
    store.closeTutorial();
  }
});

hudRoot.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const restartButton = target.closest<HTMLElement>('[data-action="restart-run"]');

  if (restartButton) {
    store.restartRun();
    return;
  }

  const viewModeButton = target.closest<HTMLElement>('[data-action="set-board-view"]');

  if (viewModeButton) {
    const viewMode = viewModeButton.dataset.viewMode;

    if (viewMode === "build" || viewMode === "pattern") {
      store.setBoardViewMode(viewMode);
    }

    return;
  }

  const dismantleButton = target.closest<HTMLElement>('[data-action="dismantle-selected"]');

  if (dismantleButton) {
    store.dismantleSelectedStructure();
    return;
  }

  const menuBuildButton = target.closest<HTMLElement>('[data-action="menu-build-selected"]');

  if (menuBuildButton) {
    const row = Number(menuBuildButton.dataset.row);
    const col = Number(menuBuildButton.dataset.col);

    if (Number.isFinite(row) && Number.isFinite(col)) {
      store.handleTileClick(row, col);
    }

    return;
  }

  const menuSalvageButton = target.closest<HTMLElement>('[data-action="menu-salvage-selected"]');

  if (menuSalvageButton) {
    const cardId = menuSalvageButton.dataset.cardId;

    if (cardId) {
      store.salvageCard(cardId);
    }

    return;
  }

  const applyIdeologyButton = target.closest<HTMLElement>('[data-action="apply-ideology-upgrade"]');

  if (applyIdeologyButton) {
    const ideology = applyIdeologyButton.dataset.ideology;

    if (ideology === "tech" || ideology === "magic") {
      store.applyIdeologyToSelectedStructure(ideology);
    }

    return;
  }

  const forgeIdeologyButton = target.closest<HTMLElement>('[data-action="forge-ideology-upgrade"]');

  if (forgeIdeologyButton) {
    const ideology = forgeIdeologyButton.dataset.ideology;

    if (ideology === "tech" || ideology === "magic") {
      store.forgeIdeologyCard(ideology);
    }

    return;
  }

  const buyShopOfferButton = target.closest<HTMLElement>('[data-action="buy-shop-offer"]');

  if (buyShopOfferButton) {
    const offerId = buyShopOfferButton.dataset.offerId;

    if (offerId) {
      store.buyShopOffer(offerId);
    }
  }
});

handRoot.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const setSalvageModeButton = target.closest<HTMLElement>('[data-action="set-salvage-mode"]');

  if (setSalvageModeButton) {
    const mode = setSalvageModeButton.dataset.mode;

    if (mode === "resources" || mode === "application") {
      store.setSalvageMode(mode);
    }

    return;
  }

  const helpButton = target.closest<HTMLElement>('[data-action="card-help"]');

  if (helpButton) {
    event.stopPropagation();
    return;
  }

  const salvageButton = target.closest<HTMLElement>('[data-action="salvage-card"]');

  if (salvageButton) {
    const instanceId = salvageButton.dataset.cardId;

    if (instanceId) {
      store.salvageCard(instanceId);
    }

    return;
  }

  const forgeIdeologyButton = target.closest<HTMLElement>(
    '[data-action="forge-ideology-card"]'
  );

  if (forgeIdeologyButton) {
    const ideology = forgeIdeologyButton.dataset.ideology;

    if (ideology === "tech" || ideology === "magic") {
      store.forgeIdeologyCard(ideology);
    }

    return;
  }

  const salvageAllButton = target.closest<HTMLElement>('[data-action="salvage-all-cards"]');

  if (salvageAllButton) {
    store.salvageAllCards();
    return;
  }

  const endTurnButton = target.closest<HTMLElement>('[data-action="end-turn"]');

  if (endTurnButton) {
    store.endTurn();
    return;
  }

  const cardTarget = target.closest<HTMLElement>('[data-action="select-card"]');

  if (cardTarget) {
    const instanceId = cardTarget.dataset.cardId;

    if (instanceId) {
      store.selectCard(instanceId);
    }

    return;
  }

  const ideologyCardButton = target.closest<HTMLElement>('[data-action="arm-ideology-card"]');

  if (ideologyCardButton) {
    const ideology = ideologyCardButton.dataset.ideology;

    if (ideology === "tech" || ideology === "magic") {
      store.armIdeologyCard(ideology);
      return;
    }

    store.armIdeologyCard(null);
  }
});

progressionRoot.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const nodeButton = target.closest<HTMLElement>('[data-action="select-node"]');

  if (nodeButton) {
    const structureId = nodeButton.dataset.structureId;

    if (structureId === "scrap-bastion") {
      store.selectNode("scrap-bastion");
    }
  }
});

raidRoot.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const actionableElement = target.closest<HTMLElement>("[data-action]");

  if (actionableElement) {
    event.preventDefault();
  }
  const restartButton = target.closest<HTMLElement>('[data-action="restart-run"]');

  if (restartButton) {
    store.restartRun();
    return;
  }

  const continueButton = target.closest<HTMLElement>('[data-action="continue-after-raid"]');

  if (continueButton) {
    store.continueAfterRaid();
    return;
  }

  const resolveButton = target.closest<HTMLElement>('[data-action="resolve-raid"]');

  if (resolveButton) {
    store.resolveRaid();
    return;
  }

  const playRaidCardsButton = target.closest<HTMLElement>('[data-action="play-raid-cards"]');

  if (playRaidCardsButton) {
    store.playRaidCards();
    return;
  }

  const drawRaidCardButton = target.closest<HTMLElement>('[data-action="draw-raid-card"]');

  if (drawRaidCardButton) {
    store.drawRaidCard();
    return;
  }

  const startRaidButton = target.closest<HTMLElement>('[data-action="start-raid-from-prep"]');

  if (startRaidButton) {
    store.startRaidFromPrep();
    return;
  }

  const toggleCombatDeckButton = target.closest<HTMLElement>('[data-action="toggle-combat-deck-card"]');

  if (toggleCombatDeckButton) {
    const templateId = toggleCombatDeckButton.dataset.templateId;

    if (templateId) {
      store.toggleActiveCombatDeckCard(templateId);
    }

    return;
  }

  const toggleCombatCardFocusButton = target.closest<HTMLElement>('[data-action="toggle-combat-card-focus"]');

  if (toggleCombatCardFocusButton) {
    const templateId = toggleCombatCardFocusButton.dataset.templateId;

    if (templateId) {
      store.toggleCombatCardFocus(templateId);
    }

    return;
  }

  const resetDeckRecommendedButton = target.closest<HTMLElement>('[data-action="reset-combat-deck-recommended"]');

  if (resetDeckRecommendedButton) {
    store.resetCombatDeckToRecommended();
    return;
  }

  const claimRewardButton = target.closest<HTMLElement>('[data-action="claim-post-raid-reward"]');

  if (claimRewardButton) {
    const rewardId = claimRewardButton.dataset.rewardId;

    if (rewardId) {
      store.claimPostRaidReward(rewardId);
    }

    return;
  }

  const selectRaidCardButton = target.closest<HTMLElement>('[data-action="select-raid-card"]');

  if (selectRaidCardButton) {
    const cardId = selectRaidCardButton.dataset.cardId;

    if (cardId) {
      store.selectRaidCard(cardId);
    }
  }
});

store.subscribe((state) => {
  const raidActive =
    state.phase === "pre-raid" ||
    state.phase === "raid" ||
    state.phase === "post-raid" ||
    state.phase === "game-over" ||
    state.phase === "victory";

  appRoot.classList.toggle("raid-active", raidActive);
  appRoot.classList.toggle("terminal-active", state.phase === "game-over" || state.phase === "victory");
  boardShell.hidden = raidActive;
  handRoot.hidden = raidActive;
  boardSurfaceTarget.hidden = false;
  renderCommandBrief(briefRoot, state);
  renderHud(hudRoot, state);
  renderHand(handRoot, state);
  renderPatterns(patternsRoot, state);
  renderProgression(progressionRoot, state);
  renderPatternDebug(patternDebugRoot, state);
  renderIntel(intelRoot, state);
  renderRaid(raidRoot, state);
});

createSettlementBoardSurface(boardSurfaceTarget, store);
