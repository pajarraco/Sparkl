import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { THEME_COLORS } from "../providers/theme";
import { OSM_TILE_URL, type PinMapProps } from "./pin-map-config";

// Web twin of PinMap.tsx on Leaflet (react-native-maps has no web
// support). A divIcon pin in brand indigo avoids Leaflet's default marker
// images, which bundlers break. Leaflet draws its own attribution too.

const pin = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:9px;background:${THEME_COLORS.indigo};border:3px solid ${THEME_COLORS.paper};box-shadow:0 0 0 1px ${THEME_COLORS.indigo}"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function zoomFor(radiusKm: number | undefined): number {
  if (radiusKm === undefined) return 16;
  if (radiusKm <= 2) return 13;
  if (radiusKm <= 5) return 12;
  if (radiusKm <= 12) return 11;
  if (radiusKm <= 25) return 10;
  return 9;
}

function Follow(props: { latitude: number; longitude: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([props.latitude, props.longitude], props.zoom);
  }, [map, props.latitude, props.longitude, props.zoom]);
  return null;
}

function ClickToMove(props: { onMove: PinMapProps["onMove"] }) {
  useMapEvents({ click: (e) => props.onMove(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function PinMap(props: PinMapProps) {
  const zoom = zoomFor(props.radiusKm);
  return (
    <div
      aria-label={props.accessibilityLabel}
      data-testid={props.testID}
      role="application"
      style={{ height: 240, width: "100%" }}
    >
      <MapContainer
        center={[props.latitude, props.longitude]}
        style={{ height: "100%", width: "100%" }}
        zoom={zoom}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={OSM_TILE_URL}
        />
        <Marker
          draggable
          eventHandlers={{
            dragend: (e) => {
              const point = (e.target as L.Marker).getLatLng();
              props.onMove(point.lat, point.lng);
            },
          }}
          icon={pin}
          position={[props.latitude, props.longitude]}
        />
        {props.radiusKm === undefined ? null : (
          <Circle
            center={[props.latitude, props.longitude]}
            pathOptions={{ color: THEME_COLORS.indigo, fillOpacity: 0.12 }}
            radius={props.radiusKm * 1000}
          />
        )}
        <ClickToMove onMove={props.onMove} />
        <Follow
          latitude={props.latitude}
          longitude={props.longitude}
          zoom={zoom}
        />
      </MapContainer>
    </div>
  );
}
