import { getStructureCardDefinition } from "../data/structures";
import { getMaintenanceSummary } from "../game/maintenance";
import {
  getCellAtPosition,
  getIdeologyForgePlan,
  getSettlementExpansionBonuses,
  getSelectedBuildStructureId,
  getSelectedCard,
  getShopOfferCost,
  getUpcomingRaidInfo
} from "../game/selectors";
import type { GameState } from "../game/state/types";
import {
  renderResourceAmount,
  renderResourceToken,
  symbolizeResourceText
} from "./resourceSymbols";

interface TutorialStep {
  title: string;
  body: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Build First",
    body: "Click a hand card to arm Build, then click an empty settlement site."
  },
  {
    title: "Salvage Tradeoff",
    body: "Salvage gives immediate resources but no board presence."
  },
  {
    title: "Connect",
    body: "Drag from one built structure to another to create a plain link."
  },
  {
    title: "Imbue",
    body: "Select a built structure, then apply Tech or Magic from this panel."
  },
  {
    title: "Maintain",
    body: "Weak support and isolation increase decay pressure each turn."
  },
  {
    title: "Raid Flow",
    body: "Loop is Build -> Pre-Raid -> Raid. Survive 3 raids to win."
  }
];

function formatSelectedTile(state: GameState): string {
  if (!state.selectedTile) {
    return "No site selected";
  }

  const cell = getCellAtPosition(state.board, state.selectedTile);

  if (!cell) {
    return "No site selected";
  }

  if (cell.terrain === "core") {
    return "Core";
  }

  if (!cell.structureId) {
    return "Open site";
  }

  return `${getStructureCardDefinition(cell.structureId).title} (${cell.condition}/3)`;
}

function formatForgeCostSummary(cost: {
  food: number;
  materials: number;
  progress: number;
  intel: number;
}): string {
  const parts = [
    cost.materials > 0 ? renderResourceAmount(cost.materials, "materials") : "",
    cost.food > 0 ? renderResourceAmount(cost.food, "food") : "",
    cost.progress > 0 ? renderResourceAmount(cost.progress, "progress") : "",
    cost.intel > 0 ? renderResourceAmount(cost.intel, "intel") : ""
  ].filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(" + ") : "none";
}

function renderTutorial(state: GameState): string {
  const total = TUTORIAL_STEPS.length;
  const safeStepIndex = Math.max(
    0,
    Math.min(total - 1, state.tutorial.stepIndex)
  );
  const step = TUTORIAL_STEPS[safeStepIndex];
  const isFirst = safeStepIndex === 0;
  const isLast = safeStepIndex === total - 1;

  if (!state.tutorial.visible) {
    return `
      <div class="tutorial-collapsed">
        <span>${state.tutorial.completed ? "Tutorial complete" : "Need a quick refresher?"}</span>
        <button class="action-button secondary" type="button" data-action="tutorial-open">
          ${state.tutorial.completed ? "Review" : "Open"}
        </button>
      </div>
    `;
  }

  return `
    <section class="tutorial-panel" aria-label="Quick tutorial">
      <div class="tutorial-header">
        <strong>Quick Tutorial</strong>
        <span>Step ${safeStepIndex + 1}/${total}</span>
      </div>
      <p class="tutorial-title">${step.title}</p>
      <p class="tutorial-body">${step.body}</p>
      <div class="tutorial-actions">
        <button class="action-button secondary" type="button" data-action="tutorial-prev" ${
          isFirst ? "disabled" : ""
        }>
          Back
        </button>
        ${
          isLast
            ? `<button class="action-button" type="button" data-action="tutorial-finish">Finish</button>`
            : `<button class="action-button" type="button" data-action="tutorial-next">Next</button>`
        }
        <button class="action-button secondary" type="button" data-action="tutorial-close">
          Close
        </button>
      </div>
    </section>
  `;
}

export function renderCommandBrief(root: HTMLElement, state: GameState): void {
  const maintenance = getMaintenanceSummary(state);
  const raidInfo = getUpcomingRaidInfo(state);
  const expansionBonuses = getSettlementExpansionBonuses(state);
  const selectedBuildStructureId = getSelectedBuildStructureId(state);
  const selectedCard = getSelectedCard(state);
  const selectedCardDefinition = selectedCard
    ? getStructureCardDefinition(selectedCard.structureId)
    : null;
  const selectedCell = state.selectedTile
    ? getCellAtPosition(state.board, state.selectedTile)
    : undefined;
  const selectedStructure = selectedCell && selectedCell.structureId ? selectedCell : null;
  const selectedTraits = selectedStructure?.appliedIdeologies ?? [];
  const selectedTraitLabel =
    selectedTraits.length > 0 ? selectedTraits.map((ideology) => ideology.toUpperCase()).join(" + ") : "Neutral";
  const selectedTraitCount = selectedTraits.length;
  const selectedHasTech = selectedTraits.includes("tech");
  const selectedHasMagic = selectedTraits.includes("magic");
  const ideologyLimitReached =
    state.ideologyApplicationsThisTurn >= state.ideologyApplicationsPerTurnLimit;
  const canApplyTechUpgrade = Boolean(selectedStructure) && state.ideologyCardStock.tech > 0;
  const canApplyMagicUpgrade = Boolean(selectedStructure) && state.ideologyCardStock.magic > 0;
  const techUpgradeStatus =
    state.ideologyCardStock.tech <= 0
      ? "No stock."
      : selectedHasTech
        ? "Already Tech."
        : selectedTraitCount >= 2
          ? "Trait cap reached."
          : ideologyLimitReached
            ? `Turn cap ${state.ideologyApplicationsThisTurn}/${state.ideologyApplicationsPerTurnLimit}.`
            : "Ready.";
  const magicUpgradeStatus =
    state.ideologyCardStock.magic <= 0
      ? "No stock."
      : selectedHasMagic
        ? "Already Magic."
        : selectedTraitCount >= 2
          ? "Trait cap reached."
          : ideologyLimitReached
            ? `Turn cap ${state.ideologyApplicationsThisTurn}/${state.ideologyApplicationsPerTurnLimit}.`
            : "Ready.";
  const forgePlan = getIdeologyForgePlan(state);
  const forgeCostSummary = forgePlan.affordable
    ? formatForgeCostSummary(forgePlan.cost)
    : "insufficient";

  const farmCharterCost = getShopOfferCost(state, "charter-farm");
  const workshopCharterCost = getShopOfferCost(state, "charter-workshop");
  const fieldRepairCost = getShopOfferCost(state, "field-repair");
  const hasDamagedStructure = state.board.some(
    (cell) => cell.structureId !== null && cell.condition < 3
  );
  const canBuyFarmCharter = state.resources.materials >= farmCharterCost.materials;
  const canBuyWorkshopCharter = state.resources.materials >= workshopCharterCost.materials;
  const canFieldRepair =
    state.resources.materials >= fieldRepairCost.materials && hasDamagedStructure;

  root.innerHTML = `
    <div class="command-brief-shell">
      <div class="command-brief-head">
        <p class="panel-kicker">Settlement Command</p>
        <span class="toolbar-pill topbar-pill">
          ${raidInfo.exact ? raidInfo.windowLabel : `Raid ${raidInfo.windowLabel}`}
        </span>
      </div>

      <div class="command-brief-row">
        <span class="toolbar-pill topbar-pill">${renderResourceToken("materials", { withName: false })} upkeep ${maintenance.upkeepCost}</span>
        <span class="toolbar-pill topbar-pill">${maintenance.unpaidCount > 0 ? `${maintenance.unpaidCount} unpaid` : "Upkeep covered"}</span>
      </div>

      <div class="command-brief-row">
        <span class="toolbar-pill topbar-pill">Growth ${expansionBonuses.builtCount} built | rings ${expansionBonuses.ringsOccupied}/${expansionBonuses.developedRings}</span>
        <span class="toolbar-pill topbar-pill">Market -${expansionBonuses.marketDiscount} | AP +${expansionBonuses.applicationPointBonus}/turn</span>
      </div>

      <div class="command-brief-row">
        <span class="toolbar-pill topbar-pill">Card ${selectedBuildStructureId ? getStructureCardDefinition(selectedBuildStructureId).title : "None"}</span>
        <span class="toolbar-pill topbar-pill">Site ${formatSelectedTile(state)}</span>
      </div>

      <div class="command-brief-row">
        <span class="toolbar-pill topbar-pill">Application Points ${state.applicationPoints}/2</span>
        <span class="toolbar-pill topbar-pill">Salvage mode: ${state.salvageMode === "application" ? "Application" : "Resources"}</span>
      </div>
      <div class="structure-menu-upgrades">
        <button
          class="structure-menu-option tech"
          type="button"
          data-action="convert-application-points"
          data-ideology="tech"
          ${state.applicationPoints >= 2 ? "" : "disabled"}
        >
          <span class="structure-menu-label">2 AP -> Tech</span>
          <span class="structure-menu-copy">Convert points into Tech stock.</span>
        </button>
        <button
          class="structure-menu-option magic"
          type="button"
          data-action="convert-application-points"
          data-ideology="magic"
          ${state.applicationPoints >= 2 ? "" : "disabled"}
        >
          <span class="structure-menu-label">2 AP -> Magic</span>
          <span class="structure-menu-copy">Convert points into Magic stock.</span>
        </button>
      </div>

      ${
        selectedStructure
          ? `
            <div class="command-brief-row">
              <span class="toolbar-pill topbar-pill">Links ${selectedStructure.connections.length}/3</span>
              <span class="toolbar-pill topbar-pill">Stack ${selectedStructure.stackLevel}</span>
            </div>
          `
          : ""
      }

      ${
        selectedCell && selectedCell.structureId && selectedCell.terrain !== "core" && state.phase === "build"
          ? `
            <div class="structure-menu compact">
              <p class="structure-menu-title">Selected: ${getStructureCardDefinition(selectedCell.structureId).title} (${selectedTraitLabel})</p>
              <div class="structure-menu-upgrades">
                <button
                  class="structure-menu-option tech"
                  type="button"
                  data-action="apply-ideology-upgrade"
                  data-ideology="tech"
                  ${canApplyTechUpgrade ? "" : "disabled"}
                >
                  <span class="structure-menu-label">Apply Tech</span>
                  <span class="structure-menu-copy">Stock ${state.ideologyCardStock.tech}. ${techUpgradeStatus}</span>
                </button>
                <button
                  class="structure-menu-option magic"
                  type="button"
                  data-action="apply-ideology-upgrade"
                  data-ideology="magic"
                  ${canApplyMagicUpgrade ? "" : "disabled"}
                >
                  <span class="structure-menu-label">Apply Magic</span>
                  <span class="structure-menu-copy">Stock ${state.ideologyCardStock.magic}. ${magicUpgradeStatus}</span>
                </button>
              </div>
              <div class="structure-menu-upgrades">
                <button
                  class="structure-menu-option forge"
                  type="button"
                  data-action="forge-ideology-upgrade"
                  data-ideology="tech"
                  ${forgePlan.affordable ? "" : "disabled"}
                >
                  <span class="structure-menu-label">Forge Tech</span>
                  <span class="structure-menu-copy">Cost ${forgeCostSummary}</span>
                </button>
                <button
                  class="structure-menu-option forge"
                  type="button"
                  data-action="forge-ideology-upgrade"
                  data-ideology="magic"
                  ${forgePlan.affordable ? "" : "disabled"}
                >
                  <span class="structure-menu-label">Forge Magic</span>
                  <span class="structure-menu-copy">Cost ${forgeCostSummary}</span>
                </button>
              </div>
              ${
                selectedCard && selectedCardDefinition
                  ? `
                    <button
                      class="structure-menu-option build"
                      type="button"
                      data-action="menu-build-selected"
                      data-row="${selectedCell.row}"
                      data-col="${selectedCell.col}"
                    >
                      <span class="structure-menu-label">${selectedCardDefinition.title} Build</span>
                      <span class="structure-menu-copy">${symbolizeResourceText(
                        selectedCardDefinition.builtEffectText
                      )}</span>
                    </button>
                    <button
                      class="structure-menu-option salvage"
                      type="button"
                      data-action="menu-salvage-selected"
                      data-card-id="${selectedCard.instanceId}"
                    >
                      <span class="structure-menu-label">${selectedCardDefinition.title} Salvage</span>
                      <span class="structure-menu-copy">${symbolizeResourceText(
                        selectedCardDefinition.salvageEffectText
                      )}</span>
                    </button>
                  `
                  : ""
              }
              <button class="structure-menu-option dismantle" type="button" data-action="dismantle-selected">
                <span class="structure-menu-label">Dismantle</span>
                <span class="structure-menu-copy">Remove structure and receive a partial refund.</span>
              </button>
              <p class="structure-menu-note">
                Unspent forged stock resets next round.
              </p>
            </div>
          `
          : ""
      }

      <details class="floating-details">
        <summary>Market</summary>
        <div class="shop-offer-grid">
          <button class="action-button secondary" type="button" data-action="buy-shop-offer" data-offer-id="charter-farm" ${canBuyFarmCharter ? "" : "disabled"}>
            Farm (${renderResourceAmount(farmCharterCost.materials, "materials")})
          </button>
          <button class="action-button secondary" type="button" data-action="buy-shop-offer" data-offer-id="charter-workshop" ${canBuyWorkshopCharter ? "" : "disabled"}>
            Workshop (${renderResourceAmount(workshopCharterCost.materials, "materials")})
          </button>
          <button class="action-button secondary" type="button" data-action="buy-shop-offer" data-offer-id="field-repair" ${canFieldRepair ? "" : "disabled"}>
            Field Repair (${renderResourceAmount(fieldRepairCost.materials, "materials")})
          </button>
        </div>
      </details>

      ${renderTutorial(state)}

      ${
        state.message?.tone === "error"
          ? `<div class="focus-status attention">${symbolizeResourceText(state.message?.text ?? "")}</div>`
          : ""
      }
    </div>
  `;
}
