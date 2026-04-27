import type { StructureId } from "../game/state/types";
import type { RaidCardIdeology } from "../game/raid/types";

export const rewardBuildCardByIdeology: Record<RaidCardIdeology, StructureId> = {
  scrap: "barricade-yard",
  tech: "relay-pylon",
  magic: "ward-sigil",
  neutral: "workshop"
};

export const rewardRaidCardIdByIdeology: Record<RaidCardIdeology, string> = {
  scrap: "reward-scrap-jury-rigged-salvo",
  tech: "reward-tech-ghost-circuit",
  magic: "reward-magic-sanctum-pulse",
  neutral: "reward-neutral-reserve-cache"
};
