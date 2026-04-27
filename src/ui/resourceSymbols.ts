export type ResourceKey = "food" | "materials" | "core" | "progress" | "intel";

const RESOURCE_NAMES: Record<ResourceKey, string> = {
  food: "Food",
  materials: "Materials",
  core: "Core",
  progress: "Progress",
  intel: "Intel"
};

const RESOURCE_SYMBOLS: Record<ResourceKey, string> = {
  food: "◍",
  materials: "▣",
  core: "◆",
  progress: "⬢",
  intel: "◉"
};

export function renderResourceToken(
  resource: ResourceKey,
  options: { withName?: boolean } = {}
): string {
  const withName = options.withName ?? true;

  return `<span class="resource-token ${resource}" title="${RESOURCE_NAMES[resource]}">${RESOURCE_SYMBOLS[resource]}${
    withName ? ` ${RESOURCE_NAMES[resource]}` : ""
  }</span>`;
}

export function renderResourceAmount(
  amount: number,
  resource: ResourceKey,
  options: { showPlus?: boolean } = {}
): string {
  const showPlus = options.showPlus ?? false;
  const prefix = showPlus && amount >= 0 ? `+${amount}` : `${amount}`;

  return `${prefix} ${renderResourceToken(resource, { withName: false })}`;
}

export function symbolizeResourceText(text: string): string {
  let next = text;

  const entries: Array<{ key: ResourceKey; name: string }> = [
    { key: "food", name: "Food" },
    { key: "materials", name: "Materials" },
    { key: "core", name: "Core" },
    { key: "progress", name: "Progress" },
    { key: "intel", name: "Intel" }
  ];

  for (const { key, name } of entries) {
    const token = renderResourceToken(key, { withName: false });

    next = next.replace(
      new RegExp(`\\b${name}\\s*([+-]\\d+)\\b`, "gi"),
      (_match, amount: string) => `${amount} ${token}`
    );
    next = next.replace(
      new RegExp(`([+-]?\\d+)\\s+${name}\\b`, "gi"),
      (_match, amount: string) => `${amount} ${token}`
    );
  }

  return next;
}
