import { getUpcomingRaidInfo } from "../game/selectors";
import type { GameState } from "../game/state/types";
import { symbolizeResourceText } from "./resourceSymbols";

function renderActivity(state: GameState): string {
  const recentEntries = state.activityLog.slice(0, 5);

  if (recentEntries.length === 0) {
    return "<li>No actions logged yet.</li>";
  }

  return recentEntries
    .map((entry) => `<li>${symbolizeResourceText(entry)}</li>`)
    .join("");
}

export function renderIntel(root: HTMLElement, state: GameState): void {
  const raidInfo = getUpcomingRaidInfo(state);
  const upcomingRaid = state.raid
    ? {
        title: state.raid.incomingRaidTitle,
        summary: state.raid.incomingRaidSummary
      }
    : raidInfo.card;

  root.innerHTML = `
    <details class="dev-details">
      <summary>Scout & Activity</summary>
      <div class="dev-details-body">
        <p class="card-line"><strong>Incoming:</strong> ${
          state.phase === "raid" || state.phase === "game-over" || state.phase === "victory"
            ? `Active now | ${upcomingRaid.title}`
            : `${raidInfo.exact ? `Turn ${state.nextRaidTurn}` : `Expected ${raidInfo.windowLabel}`} | ${upcomingRaid.title}`
        }</p>
        <p class="card-meta">${upcomingRaid.summary}</p>
        <p class="card-line"><strong>Scout:</strong> ${
          state.scoutReport
            ? `${state.scoutReport.title} | ${state.scoutReport.detail}`
            : "No Watchtower report yet."
        }</p>
        <ul class="activity-list compact">
          ${renderActivity(state)}
        </ul>
      </div>
    </details>
  `;
}
