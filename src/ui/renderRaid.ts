import type { Ideology } from "../game/patterns/types";
import { getUpcomingRaidInfo } from "../game/selectors";
import { formatSiteLabel } from "../game/board/radialTopology";
import { getStructureCardDefinition } from "../data/structures";
import type {
  RaidCombatCard,
  RaidCombatCardEffect,
  RaidCombatRole,
  RaidEnemyArchetype,
  RaidLayerId,
  RaidState
} from "../game/raid/types";
import type { GameState } from "../game/state/types";
import { getEffectiveRaidCopies } from "../game/preRaid/poolBuilder";
import { renderResourceAmount, symbolizeResourceText } from "./resourceSymbols";

const IDEOLOGY_LABELS: Record<Ideology, string> = {
  scrap: "Scrap",
  tech: "Tech",
  magic: "Magic"
};

const ENEMY_STYLE_TAGS: Record<RaidEnemyArchetype, string[]> = {
  scrap: ["Aggressive", "Defensive", "Attrition"],
  tech: ["Disruption", "Setup", "Strip Block"],
  cult: ["Sustain", "Drain", "Pressure"]
};

const LAYER_LABELS: Record<RaidLayerId, string> = {
  outer: "Outer",
  mid: "Mid",
  inner: "Inner"
};

const ROLE_LABELS: Record<RaidCombatRole, string> = {
  defense: "Defense",
  burst: "Burst",
  sustain: "Sustain",
  tempo: "Tempo",
  utility: "Utility",
  "ideology-payoff": "Ideology Payoff"
};

let raidRootScrollMemory = 0;
let raidScreenScrollMemory = 0;

function getMeterWidth(current: number, max: number): number {
  if (max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (current / max) * 100));
}

function getSettlementRatio(raid: RaidState): number {
  if (raid.maxSettlementIntegrity <= 0) {
    return 0;
  }

  return raid.settlementIntegrity / raid.maxSettlementIntegrity;
}

function getCombatStage(raid: RaidState): "stable" | "strained" | "critical" {
  const ratio = getSettlementRatio(raid);

  if (ratio <= 0.25) {
    return "critical";
  }

  if (ratio <= 0.5) {
    return "strained";
  }

  return "stable";
}

function getRemainingEnergy(raid: RaidState): number {
  return Math.max(0, raid.maxEnergyPerTurn - raid.energySpentThisTurn);
}

function getSelectedCost(raid: RaidState): number {
  return raid.playerHand
    .filter((card) => raid.selectedPlayerCardIds.includes(card.id))
    .reduce((total, card) => total + card.cost, 0);
}

function getCollapseStateClass(
  raid: RaidState,
  layerId: RaidLayerId
): "intact" | "warned" | "collapsed" {
  const layer = raid.layers.find((entry) => entry.id === layerId);

  if (!layer) {
    return "intact";
  }

  if (layer.compromised) {
    return "collapsed";
  }

  const ratio = getSettlementRatio(raid);

  if (ratio <= layer.collapseThresholdRatio + 0.1) {
    return "warned";
  }

  return "intact";
}

function getPlayerCardBadge(effect: RaidCombatCardEffect): string {
  switch (effect.type) {
    case "attack":
      return `Deal ${effect.amount}`;
    case "block":
      return `Block ${effect.amount}`;
    case "heal":
      return `Restore ${effect.amount}`;
    case "draw":
      return `Draw ${effect.amount}`;
    case "weaken":
      return `Weaken ${effect.amount}`;
    case "repair":
      return `Repair ${effect.amount}`;
  }
}

function renderCollapseTracker(raid: RaidState): string {
  return `
    <div class="raid-collapse-strip" aria-label="Collapse thresholds">
      ${(["outer", "mid", "inner"] as RaidLayerId[])
        .map((layerId) => {
          const layer = raid.layers.find((entry) => entry.id === layerId);
          const stateClass = getCollapseStateClass(raid, layerId);
          const threshold = layer ? Math.round(layer.collapseThresholdRatio * 100) : 0;

          return `
            <span
              class="raid-collapse-pill ${stateClass}"
              title="${LAYER_LABELS[layerId]} breaks at ${threshold}% Settlement Integrity."
            >
              ${LAYER_LABELS[layerId]}
            </span>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPatternBackground(raid: RaidState): string {
  const stage = getCombatStage(raid);
  const compromisedCount = raid.layers.filter((layer) => layer.compromised).length;

  return `
    <div class="raid-scene-backdrop ${stage} collapse-${compromisedCount}" aria-hidden="true">
      <div class="raid-scene-grid"></div>
      <div class="raid-battle-topology scrap ${raid.activePatterns.some((pattern) => pattern.ideology === "scrap") ? "active" : ""}"></div>
      <div class="raid-battle-topology tech ${raid.activePatterns.some((pattern) => pattern.ideology === "tech") ? "active" : ""}"></div>
      <div class="raid-battle-topology magic ${raid.activePatterns.some((pattern) => pattern.ideology === "magic") ? "active" : ""}"></div>
      <div class="raid-scene-cracks"></div>
    </div>
  `;
}

function renderHealthRail(
  label: string,
  current: number,
  max: number,
  tone: "settlement" | "raid"
): string {
  return `
    <section class="raid-health-rail ${tone}">
      <div class="raid-health-rail-top">
        <p class="panel-kicker">${label}</p>
        <strong>${current}/${max}</strong>
      </div>
      <div class="raid-health-track">
        <div class="raid-health-fill ${tone}" style="width: ${getMeterWidth(current, max)}%"></div>
      </div>
    </section>
  `;
}

function renderEnemyRead(archetype: RaidEnemyArchetype, title: string, summary: string): string {
  return `
    <section class="raid-opponent-stage compact">
      <div class="raid-opponent-header">
        <div>
          <p class="panel-kicker">Raider Read</p>
          <h2>${title}</h2>
        </div>
      </div>
      <p class="raid-card-text">${summary}</p>
      <div class="raid-card-tag-row">
        ${ENEMY_STYLE_TAGS[archetype]
          .map((tag) => `<span class="raid-card-tag enemy-archetype ${archetype}">${tag}</span>`)
          .join("")}
      </div>
    </section>
  `;
}

function renderPlayerCard(raid: RaidState, card: RaidCombatCard): string {
  const isSelected = raid.selectedPlayerCardIds.includes(card.id);
  const ideologyClass = card.ideology === "neutral" ? "neutral" : card.ideology;
  const remainingEnergy = getRemainingEnergy(raid);
  const selectedCost = getSelectedCost(raid);
  const remainingSelectionBudget = remainingEnergy - selectedCost;
  const isUnaffordable = !isSelected && card.cost > remainingSelectionBudget;
  const sourceTag =
    card.sourceType === "structure"
      ? card.sourceTitle
      : card.sourceType === "reward"
        ? "Raid Reward"
        : "Doctrine";

  return `
    <button
      class="raid-player-card ${ideologyClass} ${isSelected ? "selected" : ""} ${isUnaffordable ? "unaffordable" : ""}"
      type="button"
      data-action="select-raid-card"
      data-card-id="${card.id}"
      ${raid.outcome || isUnaffordable ? "disabled" : ""}
      title="${card.summary}"
    >
      <div class="raid-card-topline">
        <span class="raid-card-type">${card.category}</span>
        <span class="raid-card-cost">${card.cost}</span>
      </div>
      <h3>${card.title}</h3>
      <p class="raid-card-text">${card.summary}</p>
      <div class="raid-card-badge-row">
        ${card.effects
          .map((effect) => `<span class="raid-effect-badge">${getPlayerCardBadge(effect)}</span>`)
          .join("")}
      </div>
      <div class="raid-card-tag-row">
        <span class="raid-card-tag source">${sourceTag}</span>
        ${
          card.ideology !== "neutral"
            ? `<span class="raid-card-tag ideology ${card.ideology}">${IDEOLOGY_LABELS[card.ideology]}</span>`
            : ""
        }
      </div>
    </button>
  `;
}

function renderPlayerHand(raid: RaidState): string {
  if (raid.playerHand.length === 0) {
    return `
      <div class="raid-empty-hand">
        <strong>No combat cards in hand.</strong>
        <p>Draw if energy remains, or end the turn and let the raiders act.</p>
      </div>
    `;
  }

  return `
    <div class="raid-player-hand compact" style="--raid-hand-count: ${Math.max(raid.playerHand.length, 5)};">
      ${raid.playerHand.map((card) => renderPlayerCard(raid, card)).join("")}
    </div>
  `;
}

function renderRaidLog(lines: string[]): string {
  const visibleLines = lines.slice(-8).reverse();

  return `
    <section class="raid-log-panel">
      <div class="raid-log-header">
        <p class="panel-kicker">Raid Log</p>
      </div>
      <ol class="raid-log-list">
        ${
          visibleLines.length > 0
            ? visibleLines
                .map((line) => `<li>${symbolizeResourceText(line)}</li>`)
                .join("")
            : "<li>The raid has not exchanged damage yet.</li>"
        }
      </ol>
    </section>
  `;
}

function renderPreRaidPoolCard(state: GameState, card: RaidCombatCard): string {
  const active = state.activeCombatDeckTemplateIds.includes(card.templateId);
  const focused = state.focusedCombatCardTemplateIds.includes(card.templateId);
  const effectiveCopies = getEffectiveRaidCopies(card, active, focused);
  const ideologyClass = card.ideology === "neutral" ? "neutral" : card.ideology;
  const sourceTag =
    card.sourceTitles && card.sourceTitles.length > 1
      ? `${card.sourceTitle} (${card.sourceCount})`
      : card.sourceType === "structure"
        ? card.sourceTitle
        : card.sourceType === "reward"
          ? "Raid Reward"
          : "Doctrine";
  const roleTag = card.role ? ROLE_LABELS[card.role] : "General";

  return `
    <article class="pre-raid-card ${ideologyClass} ${active ? "active" : ""} ${focused ? "focused" : ""}">
      <div class="pre-raid-card-head">
        <h3 title="${card.title}">${card.title}</h3>
        <div class="raid-card-topline">
          <span class="raid-card-type">${card.category}</span>
          <span class="raid-card-cost">${card.cost}</span>
        </div>
      </div>
      <p class="pre-raid-summary" title="${card.summary}">${card.summary}</p>
      <div class="raid-card-tag-row">
        <span class="raid-card-tag">${roleTag}</span>
        <span class="raid-card-tag source">${sourceTag}</span>
        ${
          card.ideology !== "neutral"
            ? `<span class="raid-card-tag ideology ${card.ideology}">${IDEOLOGY_LABELS[card.ideology]}</span>`
            : ""
        }
      </div>
      <div class="pre-raid-card-metrics">
        <span>${active ? "Active" : "Inactive"}</span>
        <span>${focused ? "Focused +" : "Normal"}</span>
        <span>Copies ${effectiveCopies}</span>
      </div>
      <div class="raid-control-row compact">
        <button
          class="action-button ${active ? "secondary" : ""}"
          type="button"
          data-action="toggle-combat-deck-card"
          data-template-id="${card.templateId}"
        >
          ${active ? "Disable" : "Activate"}
        </button>
        <button
          class="action-button secondary"
          type="button"
          data-action="toggle-combat-card-focus"
          data-template-id="${card.templateId}"
          ${active ? "" : "disabled"}
        >
          ${focused ? "Focused" : "Focus"}
        </button>
      </div>
    </article>
  `;
}

function renderPreRaid(state: GameState): string {
  const { card: raidDefinition, exact, windowLabel, hint } = getUpcomingRaidInfo(state);

  if (!raidDefinition) {
    return "";
  }

  const activeCopies = state.combatCardPool.reduce(
    (total, card) =>
      total +
      getEffectiveRaidCopies(
        card,
        state.activeCombatDeckTemplateIds.includes(card.templateId),
        state.focusedCombatCardTemplateIds.includes(card.templateId)
      ),
    0
  );
  const sortedPool = [...state.combatCardPool].sort((left, right) => {
    if (left.drawWeight !== right.drawWeight) {
      return right.drawWeight - left.drawWeight;
    }

    return left.title.localeCompare(right.title);
  });

  return `
    <div class="raid-duel-screen pre-raid-screen stable">
      <header class="post-raid-header">
        <div>
          <p class="panel-kicker">Pre-Raid Selection</p>
          <h1>${raidDefinition.title}</h1>
          <p class="raid-header-summary">${raidDefinition.summary}</p>
        </div>
        <div class="post-raid-header-actions">
          <span class="toolbar-pill">Turn ${state.turn}</span>
          <span class="toolbar-pill ${exact ? "emphasis" : "subtle"}">${exact ? `Raid ${windowLabel}` : `Expected ${windowLabel}`}</span>
          <span class="toolbar-pill">Active ${state.activeCombatDeckTemplateIds.length}/${state.activeCombatDeckMaxSize}</span>
          <span class="toolbar-pill">Deck ${activeCopies} cards</span>
          <button
            class="action-button"
            type="button"
            data-action="start-raid-from-prep"
            ${state.activeCombatDeckTemplateIds.length === 0 ? "disabled" : ""}
          >
            Enter Raid
          </button>
        </div>
      </header>

      <section class="post-raid-grid">
        ${renderEnemyRead(
          raidDefinition.enemyArchetype,
          raidDefinition.enemyArchetypeTitle,
          raidDefinition.enemyArchetypeSummary
        )}

        <section class="post-raid-panel">
          <div class="post-raid-panel-header">
            <div>
              <p class="panel-kicker">Combat Card Set</p>
              <h2>Recommended 12 card types</h2>
            </div>
            <span class="toolbar-pill">Duplicate cap: 2</span>
          </div>
          <p class="post-raid-copy">
            ${hint} Focus is a priority boost: focused cards are favored in recommendations and usually gain stronger copy priority in deck assembly.
          </p>
          <div class="raid-control-row compact pre-raid-controls">
            <button
              class="action-button secondary"
              type="button"
              data-action="reset-combat-deck-recommended"
            >
              Use Recommended 12
            </button>
          </div>
          <div class="post-raid-deck-grid">
            ${sortedPool
              .map((card) => renderPreRaidPoolCard(state, card))
              .join("")}
          </div>
        </section>
      </section>
    </div>
  `;
}

function renderLiveRaid(state: GameState, raid: RaidState): string {
  const remainingEnergy = getRemainingEnergy(raid);
  const drawAvailable = raid.playerDrawPile.length + raid.playerDiscardPile.length > 0;

  return `
    <div class="raid-duel-screen duel-live ${getCombatStage(raid)}">
      ${renderPatternBackground(raid)}

      <header class="raid-duel-header compact">
        <div class="raid-header-title-row">
          <div>
            <p class="panel-kicker">Raid</p>
            <h1>${raid.incomingRaidTitle}</h1>
          </div>
          <div class="raid-header-meta compact">
            <span class="toolbar-pill">Turn ${raid.turnNumber}</span>
            <span class="toolbar-pill emphasis">Energy ${remainingEnergy}/${raid.maxEnergyPerTurn}</span>
          </div>
        </div>

        <div class="raid-health-row">
          <div class="raid-health-stack">
            ${renderHealthRail(
              "Settlement Integrity",
              raid.settlementIntegrity,
              raid.maxSettlementIntegrity,
              "settlement"
            )}
            ${renderCollapseTracker(raid)}
          </div>
          ${renderHealthRail("Raid Strength", raid.raidStrength, raid.maxRaidStrength, "raid")}
        </div>
      </header>

      <section class="raid-mid-stage">
        ${renderEnemyRead(raid.enemyArchetype, raid.enemyArchetypeTitle, raid.enemyArchetypeSummary)}
        ${renderRaidLog(raid.combatLog)}
      </section>

      <section class="raid-hand-zone simplified">
        <div class="raid-hand-header compact">
          <div>
            <p class="panel-kicker">Settlement Hand</p>
            <h2>Play from the base</h2>
          </div>
        </div>

        ${renderPlayerHand(raid)}

        <div class="raid-control-row major compact">
          <button
            class="action-button secondary"
            type="button"
            data-action="draw-raid-card"
            ${remainingEnergy <= 0 || !drawAvailable ? "disabled" : ""}
          >
            Draw Card (1 Energy)
          </button>
          <button
            class="action-button"
            type="button"
            data-action="play-raid-cards"
            ${raid.selectedPlayerCardIds.length === 0 ? "disabled" : ""}
          >
            Play Selected
          </button>
          <button
            class="action-button secondary"
            type="button"
            data-action="resolve-raid"
            ${raid.selectedPlayerCardIds.length > 0 ? "disabled" : ""}
          >
            End Turn
          </button>
        </div>
      </section>
    </div>
  `;
}

function renderRewardChoices(state: GameState): string {
  const claimedId = state.claimedPostRaidRewardId;

  return `
    <section class="post-raid-panel">
      <div class="post-raid-panel-header">
        <div>
          <p class="panel-kicker">Reward Choice</p>
          <h2>Choose 1 post-raid gain</h2>
        </div>
        <span class="toolbar-pill ${claimedId ? "success" : ""}">
          ${claimedId ? "Reward Claimed" : "Choose One"}
        </span>
      </div>
      <div class="post-raid-reward-grid">
        ${state.postRaidRewardChoices
          .map((choice) => {
            const claimed = claimedId === choice.id;

            return `
              <article class="post-raid-reward-card ${claimed ? "claimed" : ""}">
                <p class="panel-kicker">${choice.kind.replace("-", " ")}</p>
                <h3>${choice.title}</h3>
                <p>${choice.summary}</p>
                <button
                  class="action-button ${claimed ? "" : "secondary"}"
                  type="button"
                  data-action="claim-post-raid-reward"
                  data-reward-id="${choice.id}"
                  ${claimedId ? "disabled" : ""}
                >
                  ${claimed ? "Claimed" : "Choose"}
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderRecoverySnapshot(state: GameState, raid: RaidState): string {
  const outcome = raid.outcome!;
  const vulnerableCells = state.board.filter(
    (cell) => cell.structureId !== null && cell.condition <= 1
  );
  const wornCells = state.board.filter(
    (cell) => cell.structureId !== null && cell.condition === 2
  );
  const repairableCount = state.board.filter(
    (cell) => cell.structureId !== null && cell.condition < 3
  ).length;

  return `
    <section class="post-raid-panel compact">
      <div class="post-raid-panel-header">
        <div>
          <p class="panel-kicker">Recovery Snapshot</p>
          <h2>Settlement Aftermath</h2>
        </div>
      </div>
      <div class="post-raid-metrics">
        <span class="toolbar-pill">Destroyed ${outcome.destroyedCount}</span>
        <span class="toolbar-pill">Damaged ${outcome.damagedCount}</span>
        <span class="toolbar-pill">Vulnerable ${vulnerableCells.length}</span>
        <span class="toolbar-pill">Worn ${wornCells.length}</span>
      </div>
      <p class="post-raid-copy">
        ${
          repairableCount > 0
            ? `Repair-ready structures: ${repairableCount}. Field Repair in Market restores one damaged structure by +1 condition for ${renderResourceAmount(
                3,
                "materials"
              )}.`
            : "No structures currently need repair."
        }
      </p>
      <ul class="post-raid-recovery-list">
        ${
          vulnerableCells.length > 0
            ? vulnerableCells
                .slice(0, 6)
                .map(
                  (cell) =>
                    `<li>${getStructureCardDefinition(cell.structureId!).title} at ${formatSiteLabel(cell)} is vulnerable (${cell.condition}/3).</li>`
                )
                .join("")
            : "<li>No critically vulnerable structures remain.</li>"
        }
      </ul>
    </section>
  `;
}

function renderPostRaid(state: GameState, raid: RaidState): string {
  const outcome = raid.outcome!;

  return `
    <div class="raid-duel-screen post-raid-screen ${getCombatStage(raid)}">
      ${renderPatternBackground(raid)}

      <header class="post-raid-header">
        <div>
          <p class="panel-kicker">Raid Cleared</p>
          <h1>${raid.incomingRaidTitle}</h1>
          <p class="raid-header-summary">Take a reward, then return to build. Combat pool tuning now happens in pre-raid preparation.</p>
        </div>
        <div class="post-raid-header-actions">
          <span class="toolbar-pill">Rounds ${outcome.roundsResolved}</span>
          <span class="toolbar-pill">Integrity Lost ${outcome.settlementIntegrityLoss}</span>
          <button
            class="action-button"
            type="button"
            data-action="continue-after-raid"
            ${state.claimedPostRaidRewardId ? "" : "disabled"}
          >
            Return to Build
          </button>
        </div>
      </header>

      <section class="post-raid-grid">
        ${renderRecoverySnapshot(state, raid)}
        ${renderRewardChoices(state)}
        ${renderRaidLog(outcome.reasonLines)}
      </section>
    </div>
  `;
}

function renderTerminalOutcome(state: GameState, raid: RaidState): string {
  const outcome = raid.outcome!;
  const title =
    state.phase === "game-over"
      ? "Settlement Lost"
      : state.phase === "victory"
        ? "Final Raid Beaten"
        : "Raid Resolved";

  return `
    <div class="raid-duel-screen duel-terminal ${getCombatStage(raid)}">
      ${renderPatternBackground(raid)}

      <div class="raid-terminal-card ${outcome.survived ? "victory" : "defeat"}">
        <p class="panel-kicker">${outcome.survived ? "Raid Victory" : "Raid Defeat"}</p>
        <h1>${title}</h1>
        <p class="raid-terminal-copy">
          ${
            outcome.survived
              ? "Raid Strength hit zero before the settlement broke."
              : "Settlement Integrity collapsed before the raiders were stopped."
          }
        </p>
        <div class="raid-terminal-metrics">
          <span class="toolbar-pill">Rounds ${outcome.roundsResolved}</span>
          <span class="toolbar-pill">Integrity Lost ${outcome.settlementIntegrityLoss}</span>
          <span class="toolbar-pill">Damaged ${outcome.damagedCount}</span>
          <span class="toolbar-pill">Destroyed ${outcome.destroyedCount}</span>
        </div>
        ${renderRaidLog(outcome.reasonLines)}
        <div class="raid-control-row major">
          <button class="action-button" type="button" data-action="restart-run">Restart Run</button>
        </div>
      </div>
    </div>
  `;
}

export function renderRaid(root: HTMLElement, state: GameState): void {
  const previousRootScrollTop = root.scrollTop;
  const previousScreenScrollTop =
    root.querySelector<HTMLElement>(".raid-duel-screen")?.scrollTop ?? 0;
  raidRootScrollMemory = previousRootScrollTop;
  raidScreenScrollMemory = previousScreenScrollTop;
  const raid = state.raid;
  const visible =
    state.phase === "pre-raid" ||
    state.phase === "raid" ||
    state.phase === "post-raid" ||
    state.phase === "game-over" ||
    state.phase === "victory";

  root.hidden = !visible;

  if (!visible) {
    root.innerHTML = "";
    return;
  }

  if (state.phase === "pre-raid") {
    root.innerHTML = renderPreRaid(state);
    const container = root.querySelector<HTMLElement>(".raid-duel-screen");

    if (container) {
      container.scrollTop = raidScreenScrollMemory;
      requestAnimationFrame(() => {
        root.scrollTop = raidRootScrollMemory;
        container.scrollTop = raidScreenScrollMemory;
      });
    }

    return;
  }

  if (!raid) {
    root.innerHTML = "";
    return;
  }

  if (state.phase === "post-raid" && raid.outcome) {
    root.innerHTML = renderPostRaid(state, raid);
    const container = root.querySelector<HTMLElement>(".raid-duel-screen");

    if (container) {
      container.scrollTop = raidScreenScrollMemory;
      requestAnimationFrame(() => {
        root.scrollTop = raidRootScrollMemory;
        container.scrollTop = raidScreenScrollMemory;
      });
    }

    return;
  }

  if ((state.phase === "game-over" || state.phase === "victory") && raid.outcome) {
    root.innerHTML = renderTerminalOutcome(state, raid);
    const container = root.querySelector<HTMLElement>(".raid-duel-screen");

    if (container) {
      container.scrollTop = raidScreenScrollMemory;
      requestAnimationFrame(() => {
        root.scrollTop = raidRootScrollMemory;
        container.scrollTop = raidScreenScrollMemory;
      });
    }

    return;
  }

  root.innerHTML = renderLiveRaid(state, raid);
  const container = root.querySelector<HTMLElement>(".raid-duel-screen");

  if (container) {
    container.scrollTop = raidScreenScrollMemory;
    requestAnimationFrame(() => {
      root.scrollTop = raidRootScrollMemory;
      container.scrollTop = raidScreenScrollMemory;
    });
  }
}
