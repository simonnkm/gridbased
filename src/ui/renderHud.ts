import { getMaintenanceSummary } from "../game/maintenance";
import {
  getBoardOccupancySummary,
  getUpcomingRaidInfo
} from "../game/selectors";
import type { GameState } from "../game/state/types";
import { renderResourceToken } from "./resourceSymbols";

function renderTopResource(label: string, value: number): string {
  return `
    <span class="topbar-resource">
      <span class="topbar-resource-label">${label}</span>
      <strong>${value}</strong>
    </span>
  `;
}

export function renderHud(root: HTMLElement, state: GameState): void {
  const raidInfo = getUpcomingRaidInfo(state);
  const maintenance = getMaintenanceSummary(state);
  const phaseLabel =
    state.phase === "build"
      ? "Build"
      : state.phase === "pre-raid"
        ? "Pre-Raid"
        : "Raid";
  const isBuildLens = state.boardViewMode === "build";
  const isPatternLens = state.boardViewMode === "pattern";

  root.innerHTML = `
    <div class="topbar-shell">
      <div class="topbar-left">
        ${renderTopResource(renderResourceToken("core"), state.resources.core)}
        ${renderTopResource(renderResourceToken("food"), state.resources.food)}
        ${renderTopResource(renderResourceToken("materials"), state.resources.materials)}
        ${renderTopResource(renderResourceToken("progress"), state.resources.progress)}
        ${renderTopResource(renderResourceToken("intel"), state.resources.intel)}
      </div>

      <div class="topbar-middle">
        <span class="toolbar-pill topbar-pill phase">${phaseLabel}</span>
        <span class="toolbar-pill topbar-pill">Turn ${state.turn}</span>
        <span class="toolbar-pill topbar-pill">Next ${raidInfo.countdownText}</span>
        <span class="toolbar-pill topbar-pill">Board ${getBoardOccupancySummary(state)}</span>
        <span class="toolbar-pill topbar-pill">
          ${renderResourceToken("materials", { withName: false })} upkeep ${maintenance.upkeepCost}
        </span>
      </div>

      <div class="topbar-right">
        <span class="toolbar-pill topbar-pill stock tech">Tech stock ${state.ideologyCardStock.tech}</span>
        <span class="toolbar-pill topbar-pill stock magic">Magic stock ${state.ideologyCardStock.magic}</span>
        <span class="toolbar-pill topbar-pill">AP ${state.applicationPoints}</span>
        <span class="toolbar-pill topbar-pill">
          Imbue ${state.ideologyApplicationsThisTurn}/${state.ideologyApplicationsPerTurnLimit}
        </span>
        <div class="topbar-actions">
          <button
            class="action-button ${isBuildLens ? "" : "secondary"}"
            type="button"
            data-action="set-board-view"
            data-view-mode="build"
          >
            Build
          </button>
          <button
            class="action-button ${isPatternLens ? "" : "secondary"}"
            type="button"
            data-action="set-board-view"
            data-view-mode="pattern"
          >
            Pattern
          </button>
          <button class="action-button secondary" type="button" data-action="restart-run">
            Restart
          </button>
        </div>
      </div>
    </div>
  `;
}
