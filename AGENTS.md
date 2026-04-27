# AGENTS

This project follows the Game Studio workflow for a Phaser browser strategy prototype with a data-first rules layer.

## Workflow Priority
1. `game-studio` for milestone framing and scope control.
2. `web-game-foundations` whenever board model, state boundaries, or phase transitions change.
3. `phaser-2d-game` for runtime scene/input implementation.
4. `game-ui-frontend` for readability-first UI and playfield protection.
5. `game-playtest` after each milestone for loop clarity and regression checks.

## Active Product Direction
- Stable combat remains duel raids (Settlement Integrity vs Raid Strength).
- Stable flow remains Build -> Pre-Raid -> Raid -> Post-Raid.
- Pre-Raid remains canonical unique card type selection.
- Raid deck remains concrete and assembled once per raid (max 2 copies/template).
- Current migration focus is:
  - neutral base structures
  - stackable upgrades
  - ideology overlays (`tech` / `magic`)
  - Scrap derived from settlement mass/density
  - cleaner radial Pattern View

## Guardrails
- Keep simulation/rules logic outside Phaser scene mutation.
- Keep core loop continuity while refactoring settlement expression model.
- Do not reintroduce square-grid coordinate clutter in default player UI.
- Do not add major new combat systems during this refactor.
- Keep default view concise; deeper diagnostics belong behind collapsible debug surfaces.

## Ownership Map
- `State + Rules`
  - `src/game/state`, `src/game/rules`
  - Run lifecycle, transitions, build/pre-raid/raid coordination
- `Settlement Model`
  - `src/game/board`, `src/game/maintenance`
  - Neutral structure model, stack level, condition/degradation, support context
- `Ideology Overlay + Patterns`
  - `src/game/patterns`, pattern visualization adapters
  - Scrap mass derivation, Tech route overlays, Magic resonance overlays
- `Combat Systems`
  - `src/game/combat`, `src/game/raid`, `src/game/preRaid`
  - Preserve duel model and pre-raid/copy-cap behavior while settlement signals change
- `Data + Balance`
  - `src/data`, `src/data/cards`
  - Neutral structure definitions, overlay cards, progression thresholds, raid tuning
- `UI`
  - `src/ui`, `src/styles.css`, Phaser scene rendering
  - Build/Pattern readability, condition clarity, maintenance explanation, recovery clarity

## Collaboration Rules
- Prefer registry/data definitions over one-off logic branches.
- Keep state serializable and derivations explicit.
- If model assumptions change, update docs first (`PLAN.md`, design notes), then code.
- For each substantial pass, log concise verification notes in `.logs/<YYYY-MM-DD>/`.

## Immediate Migration Focus
1. Remove intrinsic ideology tags from base structures.
2. Introduce explicit overlay attachment model (`none | tech | magic`).
3. Shift Scrap identity to derived density/stacking mass.
4. Rebuild Pattern View to sparse strongest-shape overlays.
5. Rebalance progression/combat signals from structure + stack + overlay + topology.
