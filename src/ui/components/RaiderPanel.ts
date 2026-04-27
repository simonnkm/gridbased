export interface RaiderPanelProps {
  title: string;
  summary: string;
  tags: string[];
}

export function renderRaiderPanel(props: RaiderPanelProps): string {
  return `
    <section class="raider-panel">
      <h3>${props.title}</h3>
      <p>${props.summary}</p>
      <div class="raider-tags">${props.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
    </section>
  `;
}

