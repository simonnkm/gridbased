import type { GameState } from "../../game/state/types";

export function renderIdeologyBars(state: GameState): string {
  return `
    <div class="ideology-bars">
      ${(["scrap", "tech", "magic"] as const)
        .map((ideology) => {
          const entry = state.progression.byIdeology[ideology];
          const width = Math.min(100, (entry.barValue / 24) * 100);

          return `
            <section class="ideology-bar ${ideology}">
              <span>${entry.ideology}</span>
              <strong>${entry.barValue}</strong>
              <div class="ideology-bar-track"><div class="ideology-bar-fill" style="width:${width}%"></div></div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}
