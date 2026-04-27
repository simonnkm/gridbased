# Neutral Structure + Ideology Overlay Refactor

## Goal
Simplify the settlement system by removing intrinsic ideology traits from base structures.

The board should represent:
- neutral physical structures as the settlement backbone
- Scrap as the default physical density/mass of the settlement
- Tech as an overlay that creates angular links/routes
- Magic as an overlay that creates circular resonance/effigy patterns

This should reduce clutter, improve readability, and make Pattern View feel more intentional.

## Core Direction

### Base structures
Only a small set of neutral base structures exists on the board. These are practical settlement pieces, not ideology-tagged pieces.

Examples:
- Farm
- Mine
- Workshop
- Watchtower
- Well
- Muster Hall

These structures still differ in practical role:
- economy
- repair
- scouting
- combat contribution
- support/upkeep behavior

But they do **not** inherently belong to Scrap, Tech, or Magic.

### Scrap
Scrap is the default ideological presence of the settlement.

Scrap does not require separate special cards in the first version.
Instead, Scrap emerges automatically from:
- occupied structures
- density
- clustering
- stacking/upgrades

Scrap is represented visually as a **yellow** field/glow.
More density means stronger yellow intensity.

Scrap should not rely on explicit connection lines.
It should feel like settlement mass, pressure, and clustered physical presence.

### Tech
Tech is applied by a simple Tech ideology card.

Applying Tech to a structure:
- marks that structure as Tech
- colors it blue
- allows it to participate in Tech routes/links
- contributes to the Tech progression bar
- changes its raid/build contribution toward control/draw/precision

Tech should generate **angular blue links** in Pattern View.
The game should show only the strongest/most meaningful route(s), not every possible link.

### Magic
Magic is applied by a simple Magic ideology card.

Applying Magic to a structure:
- marks that structure as Magic
- colors it red
- allows it to participate in Magic resonance/effigy patterns
- contributes to the Magic progression bar
- changes its raid/build contribution toward sustain/restore/warding/high-ceiling effects

Magic should generate **red circular / arc / effigy-style patterns** in Pattern View.
It should feel symbolic and resonant rather than infrastructural.

## Board Data Model

Each structure/site should support at least:

- structureType
- stackLevel
- condition
- modifier = none | tech | magic
- scrapPresence (derived)
- techLinks (derived)
- magicResonance (derived)

Suggested interpretation:
- structureType = Farm, Mine, Workshop, etc.
- stackLevel = 1/2/3 for upgraded basics
- condition = healthy / worn / damaged / ruined
- modifier = no ideology, Tech, or Magic

## Stacking / Upgrading

Base structures should be stackable/upgradable.
This solves the “board fills too fast” problem.

Suggested rule:
- placing the same basic structure onto itself upgrades it
- basics can scale by tier/stack level
- ideology modifiers remain attached to the structure

Example:
- Farm
- Farm II
- Farm III
- Farm II + Magic
- Mine I + Tech

Stacking increases:
- utility/output
- durability/support value
- scrap density contribution
- combat deck contribution

Do not create many separate specialized named buildings just to represent upgrades.

## Ideology Application Rules

### First version
A structure may hold at most one ideology modifier:
- none
- tech
- magic

No hybrid marks on a single structure for now.

### Application
Tech and Magic cards are attached to existing base structures.

Do not create a separate board tile for these ideology effects.
They should live on the same node/structure.

## Pattern View

Pattern View should be reworked around this simpler ideology language.

### Scrap
- yellow intensity / mass
- stronger with density, clustering, and stacking
- no explicit network lines required

### Tech
- blue angular lines/routes
- sparse and readable
- only strongest route(s) shown by default

### Magic
- red circular / arc / effigy patterns
- sparse and readable
- only strongest resonance/circle shown by default

Pattern View should:
- stay radial
- reduce clutter
- emphasize planning
- avoid showing every possible connection

## Progression Bars

Keep three ideology bars:
- Scrap
- Tech
- Magic

### Scrap bar increases from:
- occupied structures
- structure density
- stacking
- contiguous clustered settlement mass

### Tech bar increases from:
- number of Tech-marked structures
- valid Tech routes
- strong junctions / route efficiency

### Magic bar increases from:
- number of Magic-marked structures
- valid resonance loops/arcs
- circular/effigy formations

These bars drive:
- card access
- stronger effects
- progression thresholds
- raid/build payoffs

## Combat Integration

Base structures keep their practical role in combat generation.
Ideology modifier changes the flavor/output of that role.

Examples:

### Watchtower
Base role:
- scouting / control / reveal

With Tech:
- stronger draw/control/precision cards

With Magic:
- warding / foresight / protective resonance cards

### Farm
Base role:
- sustain / restore

With Tech:
- efficient cycling / conversion

With Magic:
- healing / integrity / ritual sustain

### Mine
Base role:
- materials / fortification

With Tech:
- reinforced defense / sharper utility

With Magic:
- anchored ward / geomantic defense

### Muster Hall
Base role:
- attack / militia

With Tech:
- disciplined attack/control

With Magic:
- zeal / warded offense

Scrap influence is already present through density/stacking, so Scrap-themed outputs should emerge from physical settlement mass rather than an extra modifier card.

## Maintenance / Decay

Maintenance should continue to depend on:
- baseline wear
- support context
- density
- exposure
- stack level / burden

Support can reduce wear, but should not remove it entirely.

Marked structures may become stronger, but isolation should still carry risk.

## UI Changes

### Build View
Show:
- structure identity
- condition
- stack level
- ideology marker if present
- readable upkeep/support information

Do not clutter the tile/node with large labels.

### Pattern View
Show:
- yellow scrap density
- blue tech links
- red magic circles/arcs
- strongest patterns only

### Sidebars / progression
Keep ideology bars visible.
Remove large unlock clutter from default view where possible.

## What this refactor replaces

This refactor replaces:
- trait-based basic structures
- many ideology-tagged specialized structures as the default expression model

The new default expression model is:
- neutral structures
- stacking
- ideology overlays
- derived radial topology

## Implementation Guidance

Do this in phases.

### Phase 1
Remove intrinsic ideology scoring from base structures.
Keep their practical structure roles.

### Phase 2
Add ideology modifier system:
- tech
- magic

### Phase 3
Refactor Scrap to be density-based instead of explicit trait tagging.

### Phase 4
Rebuild Pattern View around:
- scrap density
- tech routes
- magic resonance

### Phase 5
Rebalance progression/combat generation from:
- structure type
- stack level
- ideology modifier
- density/connectivity

## Success Criteria

This refactor is successful if:
- the board becomes easier to read
- ideology expression feels authored by the player
- Pattern View becomes cleaner and more useful
- the settlement feels like a canvas
- there is less structure-name clutter
- combat/build progression still makes sense after the topology shift