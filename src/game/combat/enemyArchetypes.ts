import type { RaidEnemyArchetype } from "../raid/types";

export const enemyArchetypeStyleTags: Record<RaidEnemyArchetype, string[]> = {
  scrap: ["Aggressive", "Defensive", "Attrition"],
  tech: ["Disruption", "Setup", "Strip Block"],
  cult: ["Sustain", "Drain", "Pressure"]
};

