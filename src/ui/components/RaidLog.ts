export function renderRaidLogEntries(lines: string[]): string {
  return `
    <ol class="raid-log-entries">
      ${lines.map((line) => `<li>${line}</li>`).join("")}
    </ol>
  `;
}

