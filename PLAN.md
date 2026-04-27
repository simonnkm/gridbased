# Post-Flare Pattern Defense

## Current Stable Baseline (Preserve)
- Combat remains **duel raid combat** (Settlement Integrity vs Raid Strength).
- Run flow remains **Build -> Pre-Raid -> Raid -> Post-Raid**.
- Pre-Raid selection remains **canonical unique card types**.
- Concrete raid deck remains assembled **once per raid**, with **max 2 copies per template**.
- Raid hand model remains:
  - opening hand 5
  - retained hand persists
  - +1 draw per round
- Radial topology remains the board foundation (Core + rings + sectors).

## Refactor Goal
Move settlement expression from intrinsic ideology-tagged base structures to:
- **neutral base structures** as physical backbone
- **Scrap as derived settlement mass** (density/stacking/cluster pressure)
- **Tech as a blue overlay modifier** that creates angular routes
- **Magic as a red overlay modifier** that creates resonance arcs/rings

This should reduce board clutter, make Pattern View more legible, and keep ideology expression player-authored.

## Core Model Shift

### Base Structures (Neutral)
- Farm
- Mine
- Workshop
- Watchtower
- Well
- Muster Hall

These keep practical gameplay roles (economy, support, scouting, combat contribution) but no longer carry intrinsic Scrap/Tech/Magic affiliation.

### Ideology Expression
- Scrap:
  - default/derived ideological pressure from occupied structures, density, cluster shape, and stack level
  - represented as yellow mass/intensity, not explicit network lines
- Tech:
  - applied by Tech ideology cards to existing structures
  - marked structures become eligible for angular route logic and Tech progression gain
- Magic:
  - applied by Magic ideology cards to existing structures
  - marked structures become eligible for arc/ring resonance logic and Magic progression gain

### Modifier Constraint (V1)
- A structure can hold at most one modifier:
  - `none | tech | magic`
- No hybrid mark on the same structure in first implementation.

## Settlement Data Direction
Each site should support at least:
- `structureType`
- `stackLevel` (1/2/3)
- `condition` (healthy/worn/damaged/ruined)
- `modifier` (`none | tech | magic`)
- derived fields for:
  - scrap presence
  - tech links
  - magic resonance

## Stacking / Upgrading Direction
- Placing the same base structure on itself upgrades stack level.
- Baseline target: stack levels I/II/III for basic structures.
- Stacking increases:
  - practical output
  - durability/support value
  - Scrap mass contribution
  - combat pool influence

Avoid replacing stacking with many separate specialized structure names.

## Pattern View Direction
Pattern View stays radial and low-text.

- Scrap: yellow density/mass visualization (cluster pressure)
- Tech: sparse blue angular route visualization
- Magic: sparse red arc/ring/effigy visualization

Default display rule:
- show strongest meaningful active shape per ideology
- optionally show one faint extension/projection
- do not render every possible route simultaneously

## Progression Bars
Keep three bars:
- Scrap
- Tech
- Magic

Bar drivers:
- Scrap: occupancy + density + stacking + contiguous mass
- Tech: number of Tech-marked structures + valid routes/junction quality
- Magic: number of Magic-marked structures + valid arcs/rings/resonance forms

Bars continue to gate:
- card access
- effect ceilings
- progression thresholds
- build/raid payoffs

## Combat Integration Direction
Combat deck generation should continue to derive from settlement state, with overlay modifiers changing flavor/output of base roles.

Examples:
- Watchtower:
  - base: scouting/control
  - +Tech: stronger draw/precision/control
  - +Magic: foresight/warding/protection
- Farm:
  - base: sustain
  - +Tech: efficient conversion/cycling
  - +Magic: restore/integrity sustain
- Mine:
  - base: materials/fortification
  - +Tech: sharpened defensive utility
  - +Magic: anchored ward-like defense
- Muster Hall:
  - base: offense/militia pressure
  - +Tech: disciplined control offense
  - +Magic: zeal/warded offense

Scrap combat identity should emerge from physical settlement mass, not a separate explicit Scrap modifier card in first pass.

## Maintenance Direction
Keep maintenance pressure active every turn:
- baseline wear always exists
- support/density reduce decay but do not eliminate it
- isolation/exposure increase decay risk
- stack level may improve resilience but should not remove upkeep pressure

## Scope Guard
- No major new combat-system rewrite in this phase.
- No node-system expansion as primary focus.
- No return to cluttered diagnostics-first default UI.
- Keep board readability and planning clarity first.

## Implementation Phases
1. Remove intrinsic ideology scoring from base structures while preserving practical roles.
2. Add structure modifier system (`tech` / `magic`) and attachment flow.
3. Rework Scrap to fully density/stacking-derived contribution.
4. Rebuild Pattern View around Scrap mass + Tech routes + Magic resonance.
5. Rebalance progression and combat generation using:
   - structure type
   - stack level
   - modifier
   - density/connectivity

## Success Criteria
- Board readability improves immediately in default play.
- Player ideology expression feels deliberate (overlay application + topology shaping).
- Pattern View becomes sparse, intelligible, and planning-useful.
- Structure-name clutter is reduced.
- Build, progression, and duel raid combat remain coherent through migration.
