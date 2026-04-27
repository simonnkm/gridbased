Gridbased
Prototype strategy game about building, connecting, and defending a radial settlement around a central core.

Pattern View:
<img width="1909" height="933" alt="image" src="https://github.com/user-attachments/assets/840664a9-e92f-4901-bec0-778192f8c5a5" />
Build View:
<img width="1904" height="933" alt="image" src="https://github.com/user-attachments/assets/f33cae67-a2e9-47c4-823b-fad0ce98abcc" />
Raid View:
<img width="1883" height="930" alt="image" src="https://github.com/user-attachments/assets/2f32290d-5ba1-4b49-8bda-ce2935f8ff58" />


About
Gridbased is a prototype strategy game where you rebuild and defend a settlement after collapse.
The game is built around a central core. From there, you place structures, connect them, shape the board over time, and survive raids using combat tools generated from what you built. The goal is to make the settlement itself feel like the game, not just a background for menus or side panels.

The long-term direction is to make the board feel like a living canvas:
- structures give the settlement physical form
- connections shape how the network behaves
- density, support, and layout matter
- raids test the board you created

Current direction
The current prototype is focused on a few main ideas:
- a radial settlement board
- neutral base structures
- connections between structures
- ideology shaping the network over time
- upkeep, wear, and recovery
- raid combat tied directly to the board

The main structure set currently revolves around:
- Farm
- Mine
- Workshop
- Watchtower
- Well
- Muster Hall
These are meant to be the practical backbone of the settlement. The board becomes more expressive through how structures are placed, connected, stacked, and modified over time.

Core loop
The current loop is built around three phases:

Build
Place structures, connect them, manage wear and upkeep, and shape the settlement.

Pre-Raid
Prepare the combat pool for the next raid.

Raid
Fight a duel-style card battle where the settlement determines what tools you have available.

Ideologies
The game currently revolves around three broad identities:

Scrap  
The default physical presence of the settlement. It comes from density, occupation, clustering, and stacking.

Tech  
A more structured and deliberate layer that pushes the board toward cleaner, more angular connections.

Magic  
A more resonant and symbolic layer that pushes the board toward curves, circles, and stronger high-ceiling effects.

Current status
This is still an active prototype, not a finished game.

The current focus is on:
- improving the board-first feel
- making connections intuitive
- reducing UI clutter
- making raids more meaningful
- making settlement growth feel rewarding
- tying the board and combat together more tightly

How to run

Install dependencies:

```bash id="8e36wd"
npm install
