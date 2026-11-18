// Physical location of a material, as the staff sees it. A material that came
// from Everything may have none (HU-134): the API sends null
export interface MaterialLocation {
  depot: string;
  shelf: string;
  box: string;
}

export function formatMaterialLocation(
  location: MaterialLocation | null,
): string {
  if (location === null) {
    return 'Ubicación: sin registrar';
  }
  return `Ubicación: ${location.depot} · ${location.shelf} · ${location.box}`;
}
