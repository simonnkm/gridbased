import type { Ideology, PatternMatch, PatternTier } from "../game/patterns/types";
import type { GameState } from "../game/state/types";

const IDEOLOGY_ORDER: Ideology[] = ["scrap", "tech", "magic"];

const IDEOLOGY_LABELS: Record<Ideology, string> = {
  scrap: "Scrap",
  tech: "Tech",
  magic: "Magic"
};

function formatTier(tier: PatternTier): string {
  return tier === "none" ? "inactive" : tier;
}

function renderPatternRow(ideology: Ideology, match: PatternMatch | null): string {
  return `
    <article class="pattern-summary-row compact ${ideology}">
      <strong>${IDEOLOGY_LABELS[ideology]}</strong>
      <span>${match ? `${match.templateLabel} (${formatTier(match.tier)})` : "No shape"}</span>
    </article>
  `;
}

export function renderPatterns(root: HTMLElement, state: GameState): void {
  root.innerHTML = `
    <div class="floating-heading">
      <p class="panel-kicker">Pattern Lens</p>
    </div>
    <div class="pattern-summary-list compact">
      ${IDEOLOGY_ORDER
        .map((ideology) => renderPatternRow(ideology, state.patterns.byIdeology[ideology]))
        .join("")}
    </div>
  `;
}
