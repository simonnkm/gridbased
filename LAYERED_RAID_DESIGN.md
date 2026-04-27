## Layered Raid Combat Design

### Goal
Refactor raids into a compact siege card combat system derived directly from the settlement around the Core.

### New Model
- The settlement is translated into four defensive layers:
  - `Outer Ring`
  - `Mid Ring`
  - `Inner Ring`
  - `Core`
- Structures are assigned to a layer by distance from the Core.
- Raids resolve as inward pressure instead of lateral front combat.
- Each raid becomes a short sequence of enemy intents. Each combat round:
  - show the current incoming intent
  - draw a small hand from a structure-derived raid deck
  - play a limited number of cards
  - apply `Block`, `Fortification`, `Layer Integrity`, structure damage/destruction, then inward overflow

### Defensive Terms
- `Block`
  - temporary defense for the current round only
- `Fortification`
  - persistent layer defense that survives across rounds until broken
- `Layer Integrity`
  - the layer's deeper durability before structures begin to fail
- `Core Health`
  - final health pool after the rings collapse

### Damage Resolution
For the currently pressured layer, damage resolves in this order:
1. `Block`
2. `Fortification`
3. `Layer Integrity`
4. healthy structures become damaged, then damaged structures are destroyed
5. overflow carries inward to the next layer, eventually reaching the Core

### Board-to-Combat Translation
At raid start the board generates:
- layer assignments for all built structures
- initial `Fortification` and `Layer Integrity` by layer
- a raid deck from healthy built structures plus already-unlocked raid cards
- ideology bonuses from active Scrap / Tech / Magic patterns
- a visible enemy intent queue for the raid

### Card Identity
- `Muster Hall`
  - attack / militia pressure cards
- `Watchtower`
  - intel / preview / pressure-control cards
- `Workshop`
  - retrofit / combo / support cards
- `Well`
  - repair / restore / stabilize cards
- `Farm`
  - sustain / morale / recovery cards
- `Mine`
  - fortification / armor / heavy defense cards

### Ideology Combat Identity
- `Scrap`
  - fortification, attrition, stubborn ring defense
- `Tech`
  - intent reading, pressure reduction, routing, precision
- `Magic`
  - wards, inner protection, resonance, inward stabilization

### Retire or Adapt
- Retire:
  - `left / center / right` targeting
  - sector strength as the main combat abstraction
  - preferred sector raid targeting
  - sector-only structure bonuses
- Adapt:
  - existing progression raid cards become layered combat cards
  - existing structure `raidDefense` becomes initial layer fortification / integrity contribution
  - active patterns still matter, but now reinforce layers and raid-card effects instead of fronts
  - raid resolution remains deterministic and readable, but is now multi-round instead of one exchange

### First Implementation Scope
- keep a small enemy intent queue
- keep a small combat hand
- keep structure-derived card effects data-driven
- keep the number of effect types low:
  - add block
  - add fortification
  - restore integrity
  - reduce pressure
  - repair or save structures
- avoid deeper deckbuilder systems like exhaust, upgrade trees, or node expansion for now
