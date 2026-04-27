import type { Ideology } from "../game/patterns/types";

export interface IdeologyDefinition {
  id: Ideology;
  title: string;
  shortTitle: string;
  accentHex: string;
  buildPatternSummary: string;
  combatSummary: string;
  thresholds: {
    small: number;
    medium: number;
    large: number;
  };
}

export const ideologyDefinitions: Record<Ideology, IdeologyDefinition> = {
  scrap: {
    id: "scrap",
    title: "Scrap",
    shortTitle: "Scrap",
    accentHex: "#bf6e42",
    buildPatternSummary: "Clusters, dense pockets, and stubborn practical mass.",
    combatSummary: "Fortification, attrition, and blunt counter-pressure.",
    thresholds: {
      small: 6,
      medium: 14,
      large: 24
    }
  },
  tech: {
    id: "tech",
    title: "Tech",
    shortTitle: "Tech",
    accentHex: "#4b8ac0",
    buildPatternSummary: "Lines, junctions, routed chains, and clean signal structure.",
    combatSummary: "Precision, disruption, draw control, and sharper timing.",
    thresholds: {
      small: 6,
      medium: 14,
      large: 24
    }
  },
  magic: {
    id: "magic",
    title: "Magic",
    shortTitle: "Magic",
    accentHex: "#6fa56c",
    buildPatternSummary: "Arcs, triangles, loops, and resonance shapes.",
    combatSummary: "Wards, healing, redirection, and inner protection.",
    thresholds: {
      small: 6,
      medium: 14,
      large: 24
    }
  }
};

export function getIdeologyDefinition(ideology: Ideology): IdeologyDefinition {
  return ideologyDefinitions[ideology];
}
