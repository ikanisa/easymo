export function point(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}
