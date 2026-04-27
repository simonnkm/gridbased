export function filterDeckSelections(
  availableTemplateIds: Set<string>,
  activeTemplateIds: string[],
  focusedTemplateIds: string[]
): {
  activeTemplateIds: string[];
  focusedTemplateIds: string[];
} {
  const nextActive = activeTemplateIds.filter((templateId) => availableTemplateIds.has(templateId));
  const nextFocused = focusedTemplateIds.filter(
    (templateId) => availableTemplateIds.has(templateId) && nextActive.includes(templateId)
  );

  return {
    activeTemplateIds: nextActive,
    focusedTemplateIds: nextFocused
  };
}

