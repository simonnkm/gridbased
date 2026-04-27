import type { Ideology } from "../game/patterns/types";
import type { GameState } from "../game/state/types";

const IDEOLOGY_ORDER: Ideology[] = ["scrap", "tech", "magic"];

const IDEOLOGY_LABELS: Record<Ideology, string> = {
  scrap: "Scrap",
  tech: "Tech",
  magic: "Magic"
};

export function renderPatternDebug(root: HTMLElement, state: GameState): void {
  root.innerHTML = `
    <details class="dev-details compact">
      <summary>Debug</summary>
      <div class="dev-details-body debug-stack compact">
        ${IDEOLOGY_ORDER.map((ideology) => {
          const debug = state.patterns.debug[ideology];

          return `
            <article class="debug-card ${ideology}">
              <div class="pattern-card-header">
                <p class="card-title">${IDEOLOGY_LABELS[ideology]}</p>
                <span class="pattern-tier ${debug.tier}">${debug.tier}</span>
              </div>
              <p class="card-line">Score ${debug.breakdown.totalScore} | ${debug.templateLabel}</p>
            </article>
          `;
        }).join("")}
      </div>
    </details>
  `;
}
