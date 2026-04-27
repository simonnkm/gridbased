import Phaser from "phaser";

import { GameStore } from "../game/state/gameStore";
import { SettlementScene } from "./scenes/SettlementScene";

export function createPhaserGame(
  parent: HTMLElement,
  store: GameStore
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 960,
    backgroundColor: "#120f0a",
    scene: [new SettlementScene(store)],
    render: {
      antialias: true,
      pixelArt: false
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 960
    }
  });
}
