# Raider Opposing Deck Design

## Mirror the player card grammar
- Raiders use the same broad card categories as the settlement side:
  - `attack`
  - `block`
  - `support`
  - `special`
- They also use a real draw pile, hand, and discard pile.
- The player still chooses cards manually, while the raiders auto-pick a card from their current hand.
- This keeps the duel readable as `our deck vs their deck` without making the enemy hidden state too opaque.

## Archetype identity
- `Scrap raiders`
  - brute pressure
  - guard plates
  - attrition pushes
  - best learned as the straightforward heavy deck
- `Tech raiders`
  - strip block
  - disrupt cover
  - set up sharper follow-up hits
  - best learned as the control / disruption deck
- `Cult raiders`
  - ritual healing
  - integrity drain
  - strange pressure that does not always look like a normal attack
  - best learned as the curse / sustain deck

## Enemy hand visibility
- Keep the enemy partially visible, not fully open.
- Show:
  - the current enemy play prominently
  - up to 2 additional held cards from the actual enemy hand
  - small enemy deck / discard / hand counts
- Do not expose full future order or every hidden card.
- This preserves readability and opponent identity while keeping some uncertainty.

## Simplest implementation
- Add enemy `category` and `archetype` to raid cards.
- Add one cult-flavored direct `integrity-drain` effect for special pressure.
- Keep existing auto-selection logic, but let archetype and category slightly bias the enemy card choice.
- Update the raid UI so the enemy side reads as an opposing deck with a clear current play and a small held-hand view.
