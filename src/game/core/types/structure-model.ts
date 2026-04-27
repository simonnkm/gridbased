import type { StructureId } from "../../state/types";
import type { Ideology } from "../../patterns/types";

export interface StructureModel {
  id: StructureId;
  title: string;
  raidDefense: number;
  ideologyWeights: Record<Ideology, number>;
  builtEffectText: string;
  salvageEffectText: string;
  builtRole: string;
  patternRole: string;
}
