import { getStructureCardDefinition } from "../data/structures";
import { getEmptyTileCount } from "../game/selectors";
import type { GameState } from "../game/state/types";
import {
  symbolizeResourceText
} from "./resourceSymbols";

export function renderHand(root: HTMLElement, state: GameState): void {
  if (state.phase !== "build") {
    root.innerHTML = `
      <div class="hand-header">
        <div>
          <p class="panel-kicker">Action Hand</p>
          <h2>Build Actions Paused</h2>
        </div>
        <p class="panel-caption">The raid screen is active. Resolve the raid result before drawing the next hand.</p>
      </div>
    `;
    return;
  }

  const boardIsFull = getEmptyTileCount(state) === 0;
  const canEndTurn = state.hand.length === 0;
  const visibleHandCount = state.hand.length;
  const salvageModeLabel = state.salvageMode === "application" ? "AP" : "Resources";

  root.innerHTML = `
    <div class="hand-toolbar">
      <div class="toolbar-pill">Hand ${state.hand.length}/5</div>
      <button
        class="action-button secondary ${state.salvageMode === "resources" ? "active-inline" : ""}"
        data-action="set-salvage-mode"
        data-mode="resources"
      >
        Salvage: Resources
      </button>
      <button
        class="action-button secondary ${state.salvageMode === "application" ? "active-inline" : ""}"
        data-action="set-salvage-mode"
        data-mode="application"
      >
        Salvage: AP
      </button>
      <button
        class="action-button secondary"
        data-action="salvage-all-cards"
      ${state.hand.length > 0 ? "" : "disabled"}
      >
        Salvage All
      </button>
      <button class="action-button end-turn" data-action="end-turn" ${
        canEndTurn ? "" : "disabled"
      }>
        End Turn
      </button>
    </div>

    <div class="hand-scroll hand-scroll-flat" aria-label="Player hand" style="--hand-count: ${Math.max(
      visibleHandCount,
      1
    )}">
      ${
        state.hand
          .map((card) => {
            const definition = getStructureCardDefinition(card.structureId);
            const isSelected = state.selectedCardInstanceId === card.instanceId;
            const buildText = symbolizeResourceText(definition.builtEffectText);
            const salvageText = symbolizeResourceText(definition.salvageEffectText);

            return `
              <div class="hand-card-shell ${isSelected ? "selected" : ""}">
                <article
                  class="hand-card hand-card-flat ${isSelected ? "selected" : ""} ${
                    boardIsFull ? "build-disabled" : ""
                  }"
                  ${boardIsFull ? "" : `data-action="select-card" data-card-id="${card.instanceId}"`}
                  aria-pressed="${isSelected ? "true" : "false"}"
                >
                  <header class="hand-card-header">
                    <div>
                      <p class="card-title">${definition.title}</p>
                    </div>
                    <span class="card-mode">${isSelected ? "Build Armed" : "Ready"}</span>
                  </header>

                  <div class="card-action-lane build card-build-panel ${isSelected ? "armed" : ""}">
                    <span class="card-quick-tag build">Build (Default)</span>
                    <p class="card-line">${buildText}</p>
                  </div>
                  <button
                    class="card-action-lane salvage action-menu-option card-salvage-option"
                    data-action="salvage-card"
                    data-card-id="${card.instanceId}"
                  >
                    <span class="card-quick-tag salvage">Salvage (${salvageModeLabel})</span>
                    <p class="card-line">${
                      state.salvageMode === "application"
                        ? "Gain +1 Application Point."
                        : salvageText
                    }</p>
                  </button>
                </article>
              </div>
            `;
          })
          .join("")
      }
    </div>
    <p class="panel-caption compact-caption hand-inline-hint">
      Build is default. Use Salvage when needed. Drag between built sites to connect (max 3/site).
      Imbue stock resets each round; plays ${state.ideologyApplicationsThisTurn}/${state.ideologyApplicationsPerTurnLimit}. 
      Application Points: ${state.applicationPoints} (2 -> Tech or Magic stock).
    </p>
  `;
}
