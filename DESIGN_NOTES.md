# Design Notes

## 1) Stable Phase Flow (Preserve)
The run loop remains:
- Build
- Pre-Raid selection
- Raid duel combat
- Post-Raid recovery/reward

Pre-Raid is still the deck configuration step. Raid is still execution-only.

## 2) Settlement Expression Refactor (Active)
We are moving to:
- neutral practical base structures
- stack levels as physical growth
- ideology overlays on structures (`tech` / `magic`)
- Scrap as derived mass from occupancy/density/stacking

This replaces intrinsic ideology-tagged base structure traits as default expression.

## 3) Modifier Rules (V1)
- A structure can hold only one ideology modifier:
  - `none`
  - `tech`
  - `magic`
- No hybrid mark on one structure in first pass.
- Modifier is applied to an existing structure site, not a separate tile.

## 4) Pattern View Direction
Pattern View remains radial and minimal:
- Scrap: yellow cluster mass/intensity (no heavy route spaghetti)
- Tech: blue angular links/routes
- Magic: red arcs/rings/resonance forms

Default should show strongest meaningful pattern signals, not every possible candidate.

## 5) Progression Direction
Keep visible ideology bars:
- Scrap
- Tech
- Magic

Bar inputs now shift to:
- Scrap: mass/density/stacking/contiguity
- Tech: marked-structure route quality/junction quality
- Magic: marked-structure resonance loop/arc quality

## 6) Combat Baseline To Preserve
- Duel raid remains chosen combat model.
- Pre-Raid remains canonical unique card-type selection.
- Concrete raid deck remains one-time assembly per raid with max 2 copies/template.
- Hand model remains opening 5, retained hand, +1 draw per round.

Settlement-derived combat signals should adapt to structure + stack + overlay state, not revert to trait-heavy structure taxonomy.

## 7) UI Language Direction
Default player view should emphasize:
- structure identity
- stack/condition/modifier readability
- sparse pattern topology

Avoid default coordinate-heavy or diagnostics-heavy presentation.
