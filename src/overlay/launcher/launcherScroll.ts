export function scrollSelectedRowIntoRail(
  root: HTMLElement,
  railSelector: string,
  selectedSelector: string,
) {
  const rail = root.querySelector<HTMLElement>(railSelector);
  const selected = rail?.querySelector<HTMLElement>(selectedSelector);
  if (!rail || !selected) return;
  scrollRowIntoRail(rail, selected);
}

export function scrollRowIntoRail(rail: HTMLElement, row: HTMLElement) {
  const railHeight = rail.clientHeight;
  const rowTop = row.offsetTop;
  const rowBottom = rowTop + row.offsetHeight;
  const visibleTop = rail.scrollTop;
  const visibleBottom = visibleTop + railHeight;
  const margin = 6;

  if (
    railHeight > 0
    && Number.isFinite(rowTop)
    && Number.isFinite(rowBottom)
  ) {
    if (rowTop < visibleTop + margin) {
      rail.scrollTop = Math.max(0, rowTop - margin);
      return;
    }
    if (rowBottom > visibleBottom - margin) {
      rail.scrollTop = Math.max(0, rowBottom - railHeight + margin);
      return;
    }
    return;
  }

  row.scrollIntoView({ block: "nearest" });
}
