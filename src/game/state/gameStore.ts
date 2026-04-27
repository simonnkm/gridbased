import { createInitialGameState } from "./createInitialGameState";
import {
  applyIdeologyToSelectedStructure,
  convertApplicationPointsToIdeologyCard,
  buyShopOffer,
  closeTutorial,
  claimPostRaidReward,
  cancelConnectionDraft,
  continueAfterRaid,
  dismantleSelectedStructure,
  drawRaidCard,
  endTurn,
  handleTileClick,
  playRaidCards,
  previousTutorialStep,
  resetCombatDeckToRecommended,
  resolveRaid,
  armIdeologyCard,
  finishTutorial,
  forgeIdeologyCard,
  nextTutorialStep,
  showTutorial,
  toggleConnectMode,
  connectStructureCells,
  salvageAllCards,
  salvageCard,
  setSalvageMode,
  setBoardViewMode,
  selectNodeForBuild,
  selectRaidCard,
  selectCardForBuild,
  startRaidFromPrep,
  toggleCombatCardFocus,
  toggleActiveCombatDeckCard
} from "../rules/gameFlow";
import type { GameState } from "./types";

type Listener = (state: GameState) => void;

export class GameStore {
  private state: GameState;
  private readonly listeners = new Set<Listener>();

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  selectCard(instanceId: string): void {
    this.setState(selectCardForBuild(this.state, instanceId));
  }

  showTutorial(): void {
    this.setState(showTutorial(this.state));
  }

  previousTutorialStep(): void {
    this.setState(previousTutorialStep(this.state));
  }

  nextTutorialStep(): void {
    this.setState(nextTutorialStep(this.state));
  }

  finishTutorial(): void {
    this.setState(finishTutorial(this.state));
  }

  closeTutorial(): void {
    this.setState(closeTutorial(this.state));
  }

  salvageCard(instanceId: string): void {
    this.setState(salvageCard(this.state, instanceId));
  }

  salvageAllCards(): void {
    this.setState(salvageAllCards(this.state));
  }

  setSalvageMode(mode: GameState["salvageMode"]): void {
    this.setState(setSalvageMode(this.state, mode));
  }

  convertApplicationPoints(ideology: "tech" | "magic"): void {
    this.setState(convertApplicationPointsToIdeologyCard(this.state, ideology));
  }

  dismantleSelectedStructure(): void {
    this.setState(dismantleSelectedStructure(this.state));
  }

  selectNode(structureId: "scrap-bastion"): void {
    this.setState(selectNodeForBuild(this.state, structureId));
  }

  toggleConnectMode(enabled?: boolean): void {
    this.setState(toggleConnectMode(this.state, enabled));
  }

  armIdeologyCard(ideology: "tech" | "magic" | null): void {
    this.setState(armIdeologyCard(this.state, ideology));
  }

  applyIdeologyToSelectedStructure(ideology: "tech" | "magic"): void {
    this.setState(applyIdeologyToSelectedStructure(this.state, ideology));
  }

  forgeIdeologyCard(ideology: "tech" | "magic"): void {
    this.setState(forgeIdeologyCard(this.state, ideology));
  }

  connectStructureCells(fromCellId: string, toCellId: string): void {
    this.setState(connectStructureCells(this.state, fromCellId, toCellId));
  }

  cancelConnectionDraft(reason?: string): void {
    this.setState(cancelConnectionDraft(this.state, reason));
  }

  setBoardViewMode(boardViewMode: GameState["boardViewMode"]): void {
    this.setState(setBoardViewMode(this.state, boardViewMode));
  }

  handleTileClick(row: number, col: number): void {
    this.setState(handleTileClick(this.state, row, col));
  }

  endTurn(): void {
    this.setState(endTurn(this.state));
  }

  selectRaidCard(cardId: string): void {
    this.setState(selectRaidCard(this.state, cardId));
  }

  playRaidCards(): void {
    this.setState(playRaidCards(this.state));
  }

  drawRaidCard(): void {
    this.setState(drawRaidCard(this.state));
  }

  resolveRaid(): void {
    this.setState(resolveRaid(this.state));
  }

  startRaidFromPrep(): void {
    this.setState(startRaidFromPrep(this.state));
  }

  toggleActiveCombatDeckCard(templateId: string): void {
    this.setState(toggleActiveCombatDeckCard(this.state, templateId));
  }

  toggleCombatCardFocus(templateId: string): void {
    this.setState(toggleCombatCardFocus(this.state, templateId));
  }

  resetCombatDeckToRecommended(): void {
    this.setState(resetCombatDeckToRecommended(this.state));
  }

  buyShopOffer(offerId: string): void {
    this.setState(buyShopOffer(this.state, offerId));
  }

  claimPostRaidReward(rewardId: string): void {
    this.setState(claimPostRaidReward(this.state, rewardId));
  }

  continueAfterRaid(): void {
    this.setState(continueAfterRaid(this.state));
  }

  restartRun(): void {
    this.setState(createInitialGameState());
  }

  private setState(nextState: GameState): void {
    this.state = nextState;

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
