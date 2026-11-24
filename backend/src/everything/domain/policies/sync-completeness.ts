// Page numbers shown in the reason; the rest are only counted
const LISTED_PAGES = 10;

/** «falta la página 2», «faltan las páginas 2, 5 y 3 más»… */
const describePages = (
  [singular, plural]: [string, string],
  pages: number[],
): string => {
  const shown = pages.slice(0, LISTED_PAGES).join(', ');
  const hidden = pages.length - LISTED_PAGES;
  const list = hidden > 0 ? `${shown} y ${hidden} más` : shown;
  return pages.length === 1
    ? `${singular} la página ${list}`
    : `${plural} las páginas ${list}`;
};

/**
 * Why a run the agent closes as complete is not complete (HU-137): pages
 * from 1 to pageCount that never arrived, or pages above pageCount. null
 * when exactly pages 1..pageCount arrived. Only a complete run may mark the
 * copies it did not see as not found, so a lost or rejected page stops it.
 */
export function incompleteRunReason(
  pageCount: number,
  receivedPages: readonly number[],
): string | null {
  const received = new Set(receivedPages);
  const missing: number[] = [];
  for (let page = 1; page <= pageCount; page++) {
    if (!received.has(page)) {
      missing.push(page);
    }
  }
  const extra = [...received]
    .filter((page) => page > pageCount)
    .sort((a, b) => a - b);
  if (missing.length === 0 && extra.length === 0) {
    return null;
  }
  const problems = [
    ...(missing.length > 0
      ? [describePages(['falta', 'faltan'], missing)]
      : []),
    ...(extra.length > 0 ? [describePages(['sobra', 'sobran'], extra)] : []),
  ];
  return (
    `El agente cerró la corrida como completa con ${pageCount} páginas, ` +
    `pero ${problems.join(' y ')}`
  );
}
