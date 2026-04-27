export interface CardPickerItem {
  id: string;
  label: string;
  selected: boolean;
}

export function renderCardPicker(items: CardPickerItem[]): string {
  return `
    <div class="card-picker">
      ${items
        .map(
          (item) =>
            `<button type="button" class="card-picker-item ${item.selected ? "selected" : ""}" data-card-id="${item.id}">${item.label}</button>`
        )
        .join("")}
    </div>
  `;
}

