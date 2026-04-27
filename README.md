Gridbased
Gridbased is a prototype strategy game about rebuilding and defending a settlement after collapse.
You build outward from a central core, place structures, connect them, shape the board over time, and then survive raids using a combat deck generated from what you built. The goal is for the settlement itself to feel like the game, not just a background for menus and side panels.

Right now the project is focused on a few main ideas:
- a radial settlement board
- neutral base structures
- connections between structures
- ideology shaping the network over time
- raid combat tied directly to the board
- upkeep, damage, and recovery between raids

The current structure set is built around a few simple practical buildings:
Farm, Mine, Workshop, Watchtower, Well, and Muster Hall.

These are meant to be the backbone of the settlement. The long-term direction is that the board becomes more expressive through how structures are placed, connected, stacked, and shaped, rather than through lots of separate special-case buildings.

The game currently revolves around three phases.

Build:
Place structures, connect them, manage wear and upkeep, and shape the settlement.

Pre-Raid:
Prepare the combat pool for the next raid.

Raid:
Fight a duel-style card battle where your settlement determines what tools you have available.
The three broad identities in the game are Scrap, Tech, and Magic.
Scrap is the default physical presence of the settlement. It comes from density, occupation, and stacking.
Tech is about structure, routing, and cleaner angular connections.
Magic is about resonance, curves, circles, and more symbolic board shapes.
The game is still a prototype and is actively changing. The current focus is on making the board easier to read, improving connections and ideology application, making raids more meaningful, and getting the overall feel of the settlement right.

Tech stack:
TypeScript, Vite, HTML/CSS, and SVG-based board rendering/interactions.

How to run:

1. Install dependencies
npm install

2. Start the development server
npm run dev

3. Build the project
npm run build

Project notes:
There are also internal project files like PLAN.md, AGENTS.md, and NEW_DESIGN.md. Those are mainly for development and iteration. This README is just the public-facing overview.

Current status:
This is not a finished game. It is an active prototype. The main goal right now is to make the settlement board feel good to build on, easy to understand, and tightly connected to combat.
