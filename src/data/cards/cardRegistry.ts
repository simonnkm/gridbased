import type { StructureId } from "../../game/state/types";
import type { RaidCardIdeology } from "../../game/raid/types";
import { buildCardDefinitionByStructureId, buildCardDefinitionMap, buildCardDefinitions } from "./buildCards";
import {
  raidCardDefinitionMap,
  raidCardDefinitions,
  rewardRaidCardDefinitionByIdeology,
  structureRaidCardDefinitionByStructureId,
  unlockRaidCardDefinitionByUnlockId
} from "./raidCards";
import { enemyRaidCardDefinitionMap, enemyRaidCardDefinitions } from "./enemyRaidCards";

export { buildCardDefinitions, raidCardDefinitions, enemyRaidCardDefinitions };

export function getBuildCardDefinitionById(definitionId: string) {
  const definition = buildCardDefinitionMap.get(definitionId);

  if (!definition) {
    throw new Error(`Unknown build card definition: ${definitionId}`);
  }

  return definition;
}

export function getBuildCardDefinitionForStructure(structureId: StructureId) {
  const definition = buildCardDefinitionByStructureId.get(structureId);

  if (!definition) {
    throw new Error(`Unknown build card structure source: ${structureId}`);
  }

  return definition;
}

export function getRaidCardDefinitionById(definitionId: string) {
  const definition = raidCardDefinitionMap.get(definitionId);

  if (!definition) {
    throw new Error(`Unknown raid card definition: ${definitionId}`);
  }

  return definition;
}

export function getRaidCardDefinitionForStructure(structureId: StructureId) {
  const definition = structureRaidCardDefinitionByStructureId.get(structureId);

  if (!definition) {
    throw new Error(`Unknown structure raid card source: ${structureId}`);
  }

  return definition;
}

export function getRaidCardDefinitionForUnlock(unlockId: string) {
  const definition = unlockRaidCardDefinitionByUnlockId.get(unlockId);

  if (!definition) {
    throw new Error(`Unknown unlock raid card source: ${unlockId}`);
  }

  return definition;
}

export function getRewardRaidCardDefinition(ideology: RaidCardIdeology) {
  const definition = rewardRaidCardDefinitionByIdeology.get(ideology);

  if (!definition) {
    throw new Error(`Unknown reward raid card ideology: ${ideology}`);
  }

  return definition;
}

export function getEnemyRaidCardDefinition(cardId: string) {
  const definition = enemyRaidCardDefinitionMap.get(cardId);

  if (!definition) {
    throw new Error(`Unknown enemy raid card definition: ${cardId}`);
  }

  return definition;
}

