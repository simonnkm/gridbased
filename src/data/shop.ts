export interface ShopHookDefinition {
  id: string;
  title: string;
  summary: string;
  available: boolean;
}

export const shopHookDefinitions: ShopHookDefinition[] = [
  {
    id: "exchange-bay",
    title: "Exchange Bay",
    summary: "Later: convert resources into targeted build cards and combat picks.",
    available: false
  },
  {
    id: "repair-yard",
    title: "Repair Yard",
    summary: "Later: buy direct repairs and structure upgrades between raids.",
    available: false
  },
  {
    id: "card-broker",
    title: "Card Broker",
    summary: "Later: target or buy specific building cards to reduce draw variance.",
    available: false
  }
];
