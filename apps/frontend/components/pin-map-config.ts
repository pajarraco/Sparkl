// Shared by PinMap.tsx and PinMap.web.tsx. Kept in its own file: on web,
// importing "./PinMap" from PinMap.web.tsx resolves to itself.

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export interface PinMapProps {
  latitude: number;
  longitude: number;
  radiusKm?: number | undefined;
  onMove: (latitude: number, longitude: number) => void;
  accessibilityLabel: string;
  testID?: string | undefined;
}
