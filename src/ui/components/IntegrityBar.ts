export interface IntegrityBarProps {
  label: string;
  current: number;
  max: number;
}

export function renderIntegrityBar({ label, current, max }: IntegrityBarProps): string {
  const width = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return `
    <section class="integrity-bar">
      <span>${label}</span>
      <strong>${current}/${max}</strong>
      <div class="integrity-bar-track"><div class="integrity-bar-fill" style="width:${width}%"></div></div>
    </section>
  `;
}

