import { IDEOLOGY_BAR_THRESHOLDS } from "../game/progression/resolveProgression";
import type { Ideology } from "../game/patterns/types";
import type { GameState } from "../game/state/types";

const IDEOLOGY_ORDER: Ideology[] = ["scrap", "tech", "magic"];

const IDEOLOGY_LABELS: Record<Ideology, string> = {
  scrap: "Scrap",
  tech: "Tech",
  magic: "Magic"
};

function getBarPercent(value: number): number {
  return Math.max(
    0,
    Math.min(100, (value / IDEOLOGY_BAR_THRESHOLDS.large) * 100)
  );
}

function renderIdeologyBar(state: GameState, ideology: Ideology): string {
  const entry = state.progression.byIdeology[ideology];
  const unlockCount =
    entry.buildCardIds.length + entry.supportCardIds.length + entry.attackCardIds.length;

  return `
    <article class="ideology-bar-card ${ideology}">
      <div class="ideology-bar-header compact">
        <strong>${IDEOLOGY_LABELS[ideology]}</strong>
        <span>${entry.barValue.toFixed(1)} | ${entry.currentTier}</span>
      </div>
      <div class="ideology-bar-track" aria-label="${IDEOLOGY_LABELS[ideology]} progression">
        <div class="ideology-bar-fill ${ideology}" style="width: ${getBarPercent(entry.barValue)}%"></div>
      </div>
      <p class="card-meta compact">
        ${entry.currentPatternLabel ? entry.currentPatternLabel : "No strong pattern"} | unlocks ${unlockCount}
      </p>
    </article>
  `;
}

export function renderProgression(root: HTMLElement, state: GameState): void {
  root.innerHTML = `
    <div class="floating-heading">
      <p class="panel-kicker">Ideology Bars</p>
    </div>
    <div class="ideology-bar-list compact">
      ${IDEOLOGY_ORDER.map((ideology) => renderIdeologyBar(state, ideology)).join("")}
    </div>
  `;
}
