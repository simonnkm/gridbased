# Radial Migration Note (Overlay Model)

## Topology Baseline
- Core plus three rings.
- Ring sizes:
  - Ring 1: 8 sectors
  - Ring 2: 16 sectors
  - Ring 3: 24 sectors
- Total spaces: 49 (1 + 8 + 16 + 24).

## Adjacency Baseline
- Lateral adjacency within same ring (`s-1`, `s+1`, wrapped).
- Radial adjacency to nearest mapped sectors on neighboring rings.
- Support/maintenance checks use combined lateral + radial neighbors.

## Settlement Model Direction
Radial migration now assumes:
- neutral base structures as settlement backbone
- stack levels on base structures
- per-structure modifier state (`none | tech | magic`)
- Scrap derived from mass/density/stacking, not explicit trait tags

## Placement / Upgrade Direction
- Place base structures on empty non-core sectors.
- Place same structure onto itself to increase stack level.
- Apply Tech/Magic modifier cards onto existing structures.
- Core remains fixed non-buildable.

## Maintenance + Support Mapping
Still driven by:
- baseline wear
- support context
- density
- exposure/isolation
- condition (and eventually stack resilience effects)

Support slows decay but should not eliminate decay.

## Pattern View Direction (Radial)
- Scrap:
  - yellow intensity/mass fields from density + stacking
- Tech:
  - sparse blue angular route overlays between Tech-marked structures
- Magic:
  - sparse red arc/ring resonance overlays between Magic-marked structures

Default rendering should prioritize strongest meaningful active shapes plus limited projection hints.

## UI Label Direction
Default player view should avoid:
- row/column labels
- square-grid phrasing
- per-tile spatial spam

Coordinates remain debug-only.

## Compatibility Constraint
This migration/refactor does **not** replace:
- duel raid model
- Build -> Pre-Raid -> Raid -> Post-Raid flow
- canonical pre-raid selection
- one-time deck assembly with copy cap

It changes settlement expression and pattern language while preserving combat-loop backbone.
