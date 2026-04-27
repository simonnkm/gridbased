export interface CollapseTrackerProps {
  outer: "intact" | "warned" | "collapsed";
  mid: "intact" | "warned" | "collapsed";
  inner: "intact" | "warned" | "collapsed";
}

export function renderCollapseTracker(props: CollapseTrackerProps): string {
  return `
    <div class="collapse-tracker">
      <span class="${props.outer}">Outer</span>
      <span class="${props.mid}">Mid</span>
      <span class="${props.inner}">Inner</span>
    </div>
  `;
}

