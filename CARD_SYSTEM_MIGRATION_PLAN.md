# Card System Migration Plan

## Goals
- Move the project toward a registry-based, data-first card model.
- Keep the live flow as `Build -> Pre-Raid -> Raid`.
- Preserve current gameplay while reducing card/data logic duplication.
- Make future `Rewards` and `Shop / conversion` work fit naturally into the file layout.

## Current File Map
- `src/data/structures.ts`
  - Keep as the canonical structure/building data source.
  - Also derive build card definitions from it.
- `src/data/progression.ts`
  - Keep as unlock/progression rule data.
  - Feed ideology bars and unlocked raid/build card access.
- `src/data/raids.ts`
  - Keep as raid encounter/archetype data.
  - Refactor to reference enemy raid card definitions from a registry.
- `src/game/raid/resolveRaid.ts`
  - Split card creation, weighted sampling, enemy tactic selection, and combat setup out into the new `game/cards`, `game/preRaid`, and `game/combat` folders.
- `src/game/maintenance.ts`
  - Keep the support/degradation logic, but move board-facing helpers under `game/board`.
- `src/game/patterns/*`
  - Keep the pattern system and expose it through `game/board/patternDetection.ts` and `patternVisualization.ts`.
- `src/game/selectors.ts`
  - Split into `game/selectors/boardSelectors.ts`, `combatSelectors.ts`, and `progressionSelectors.ts`, then keep a compatibility barrel.
- `src/ui/render*.ts`
  - Move raid/pre-raid/reward rendering into `ui/screens`, `ui/components`, and `ui/render`.
  - Keep thin wrappers where the old imports are still convenient.
- `src/styles.css`
  - Keep temporarily as the legacy aggregator.
  - Start moving tokens/layout/cards/raid/pre-raid rules into `src/styles/*.css`.

## What Can Stay
- Current structure data, pattern logic, progression unlock data, and most board simulation rules.
- Current store and main event wiring, with thinner routing into the new modules.
- Current raid outcome propagation back to the board.

## What Should Move
- Card template definitions into `src/data/cards/`.
- Shared card typing into `src/game/core/types/card-model.ts`.
- Weighted raid pool creation into `src/game/cards/` and `src/game/preRaid/`.
- Enemy tactic data into `src/data/cards/enemyRaidCards.ts` and combat-side selection helpers.
- UI assembly into `ui/screens`, `ui/components`, and `ui/render`.

## First Migration Pass
1. Introduce the reusable card model and registries.
2. Move build / player raid / enemy raid card definitions into separate files.
3. Route the current weighted pre-raid pool through the new registry-based model.
4. Add the requested folder layout with real modules where behavior moved, and thin re-export wrappers where a deeper migration can wait.

## Later Migration Work
- Fully replace legacy raid-specific runtime card interfaces with the shared card model.
- Move remaining build-hand and salvage rules onto registry-driven effect resolution.
- Migrate more of `styles.css` into the new segmented style files.
- Move the remaining monolithic `gameFlow.ts` responsibilities into `endTurn.ts` and `transitions.ts`.
