export interface CardTileProps {
  title: string;
  subtitle?: string;
  meta?: string;
}

export function renderCardTile(props: CardTileProps): string {
  return `
    <article class="card-tile">
      <strong>${props.title}</strong>
      ${props.subtitle ? `<p>${props.subtitle}</p>` : ""}
      ${props.meta ? `<span>${props.meta}</span>` : ""}
    </article>
  `;
}

