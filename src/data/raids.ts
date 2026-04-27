import type { RaidEnemyArchetype } from "../game/raid/types";

export interface RaidCardDefinition {
  id: string;
  title: string;
  summary: string;
  enemyArchetype: RaidEnemyArchetype;
  enemyArchetypeTitle: string;
  enemyArchetypeSummary: string;
  baseStrength: number;
  enemyHandSize: number;
  survivalReward: {
    materials: number;
    progress: number;
    intel: number;
    core: number;
  };
  enemyDeckIds: string[];
}

export const raidCards: RaidCardDefinition[] = [
  {
    id: "scrapper-push",
    title: "Scrapper Push",
    summary:
      "A heavy scavenger mob crashes forward in waves, bracing with scrap and looking for the fastest crack in the settlement.",
    enemyArchetype: "scrap",
    enemyArchetypeTitle: "Scrap Raiders",
    enemyArchetypeSummary: "Brute pressure, welded guard, and attrition pushes.",
    baseStrength: 24,
    enemyHandSize: 3,
    survivalReward: {
      materials: 2,
      progress: 1,
      intel: 0,
      core: 0
    },
    enemyDeckIds: [
      "enemy-scrap-ram-charge",
      "enemy-scrap-hook-chains",
      "enemy-scrap-plate-wall",
      "enemy-scrap-salvage-rush",
      "enemy-scrap-breach-crew"
    ]
  },
  {
    id: "signal-leechers",
    title: "Signal Leechers",
    summary:
      "Wire-hungry raiders cut, drain, and reroute the settlement's own rhythms against it.",
    enemyArchetype: "tech",
    enemyArchetypeTitle: "Tech Raiders",
    enemyArchetypeSummary: "Disruption, block stripping, and sharper follow-up hits.",
    baseStrength: 22,
    enemyHandSize: 3,
    survivalReward: {
      materials: 1,
      progress: 1,
      intel: 1,
      core: 0
    },
    enemyDeckIds: [
      "enemy-tech-probe-line",
      "enemy-tech-drain-splice",
      "enemy-tech-crossfeed-loop",
      "enemy-tech-noise-screen",
      "enemy-tech-voltage-cut",
      "enemy-tech-jammer-lattice"
    ]
  },
  {
    id: "ash-sworn-cult",
    title: "Ash-Sworn Cult",
    summary:
      "A ritual warband alternates disciplined violence with strange recovery rites that keep the pressure alive.",
    enemyArchetype: "cult",
    enemyArchetypeTitle: "Ash-Sworn Cult",
    enemyArchetypeSummary: "Ritual healing, integrity drain, and cursed pressure.",
    baseStrength: 26,
    enemyHandSize: 3,
    survivalReward: {
      materials: 1,
      progress: 0,
      intel: 0,
      core: 1
    },
    enemyDeckIds: [
      "enemy-cult-ash-knives",
      "enemy-cult-black-omen",
      "enemy-cult-smoke-ward",
      "enemy-cult-blood-rite",
      "enemy-cult-hex-pressure",
      "enemy-cult-cinder-curse"
    ]
  }
];
