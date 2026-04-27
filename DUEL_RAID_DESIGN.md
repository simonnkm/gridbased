# Duel Raid Combat Design

## Goal
Replace the current layered pressure raid model with a direct duel-style card combat system where the settlement fights raiders as a whole.

## Core Bars
- `Settlement Integrity`
  - the settlement-wide health bar
  - if it reaches `0`, the run is lost
- `Raid Strength`
  - the enemy health bar
  - if it reaches `0`, the raid ends immediately in victory

## Core Turn Loop
1. Raid starts and translates the board into:
   - a player combat deck from built structures and unlocked raid cards
   - ring assignments for collapse consequences
   - passive ideology modifiers from active patterns
2. Player turn:
   - draw to a fixed combat hand size
   - play a limited number of cards
   - cards can attack, block, heal, draw, or modify the duel state
3. Raider turn:
   - raiders draw a small tactic hand
   - one tactic is chosen by a simple readable heuristic
   - the tactic deals damage, gains guard, heals, or strips block
4. Repeat until:
   - `Raid Strength <= 0`, or
   - `Settlement Integrity <= 0`

## Board To Combat
- The board no longer becomes a lane battle.
- Instead it feeds combat in three ways:
  - structure-derived player cards
  - passive ideology modifiers from active patterns
  - collapse targets when Settlement Integrity crosses thresholds

## Structure Roles
- `Muster Hall`
  - attack cards
- `Watchtower`
  - draw, reveal, retain-style support
- `Workshop`
  - combo, modify, upgrade support
- `Well`
  - heal, repair, stabilize
- `Farm`
  - sustain, recovery, support
- `Mine`
  - heavy block and blunt attack support

## Pattern Role
- `Scrap`
  - stubborn defense, blunt attack, attrition bonuses
- `Tech`
  - draw, reveal, precision, control bonuses
- `Magic`
  - warding, healing, inner protection, resonance bonuses

Patterns stay passive in the background. The battle itself remains a real card fight.

## Threshold Collapse
- Settlement Integrity thresholds map to physical settlement collapse:
  - `100% to 76%`: full base intact
  - `75% to 51%`: outer ring compromised
  - `50% to 26%`: mid ring compromised
  - `25% to 1%`: inner ring compromised
- When a threshold is crossed, the corresponding ring takes actual board damage:
  - healthy structures become damaged first
  - damaged structures can be destroyed
  - destroyed structures stop feeding future combat draws

## What Gets Retired
- Retire the current raid model’s main abstractions:
  - per-round layer pressure as the core fight
  - Fortification and layer Integrity as the main combat resources
  - inward pressure resolution as the primary raid loop
- Keep:
  - `Outer / Mid / Inner` ring assignment
  - structure damage / destruction tracking
  - board-derived raid content

## First Playable Scope
- player hand size `6`
- player may play up to `3` cards per turn
- raiders hold a small tactic hand and play one tactic per turn
- use simple effect types:
  - attack
  - block
  - heal Integrity
  - draw
  - enemy guard
  - enemy heal
  - block shred
- no energy system, status-stack maze, or node expansion in this pass
