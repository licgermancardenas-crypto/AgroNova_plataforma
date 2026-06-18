export const MAPBOX_TOKEN: string = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function isMapboxConfigured(): boolean {
  return MAPBOX_TOKEN.length > 0;
}

export function getMapboxTokenMasked(): string | null {
  if (!MAPBOX_TOKEN) return null;
  return `…${MAPBOX_TOKEN.slice(-4)}`;
}
