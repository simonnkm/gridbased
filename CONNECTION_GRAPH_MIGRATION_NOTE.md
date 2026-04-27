# Connection Graph Migration Note

## Goal
Shift ideology expression to a neutral node graph where links are plain and ideology is attached to structures after placement, while moving board interaction from Phaser scene objects to a dedicated SVG surface.

## New Board-Side Model
- Structures are neutral base nodes.
- Each occupied site tracks:
  - `structureId` (neutral structure type)
  - `stackLevel`
  - `condition`
  - `appliedIdeology` (`tech | magic | null`)
  - `connections[]` (plain links, max 3 per structure)
- Ideology now comes from topology plus node alignment:
  - Scrap: occupancy + stacking density (no explicit link required)
  - Tech: plain links between two Tech-tagged structures
  - Magic: plain links between two Magic-tagged structures

## Interaction Shift
- Build hand remains neutral structures only.
- Add neutral connect authoring flow with no ideology choice during line creation:
  - click one built structure
  - drag to another built structure
  - release to create/toggle a plain connection
  - enforce max 3 links per structure
- Add ideology card application flow:
  - play `Tech Card` or `Magic Card` from the hand row
  - click built structure to apply ideology
  - click again with the same card to return the structure to neutral

## What Overlay Behavior Is Removed
- No typed link authoring (`Tech Link` / `Magic Link`) at connection creation time.
- No ideology choice while drawing a link.
- No hand-level connect/ideology mode controls above the hand toolbar.
- No build-card intrinsic ideology labels driving topology by themselves.

## SVG Board Migration
- Board and pattern rendering now live on a single SVG interaction surface.
- UI chrome (brief, HUD, hand, raid panels) stays DOM-based.
- Benefits of this split:
  - stable radial hit-testing and pointer mapping
  - reliable drag preview for connection authoring
  - clear layering for topology lines, pattern overlays, and node feedback
- Pointer model:
  - click without drag selects tiles/structures
  - drag from built structure authors neutral links
  - invalid release targets report explicit feedback through state messages

## Compatibility Intent
- Keep existing duel raid + pre-raid deck loop intact.
- Keep Scrap progression active via density/stacking.
- Derive Tech and Magic patterns from neutral links + per-structure ideology cards.
- Preserve current radial board and condition/degradation loops during this migration.
