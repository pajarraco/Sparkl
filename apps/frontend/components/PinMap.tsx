import { useEffect, useRef } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, { Circle, Marker, UrlTile } from "react-native-maps";
import { THEME_COLORS } from "../providers/theme";
import { OSM_TILE_URL, type PinMapProps } from "./pin-map-config";

export type { PinMapProps } from "./pin-map-config";

// OSM map with one draggable pin and an optional radius circle (02 plan;
// spike passed in Expo Go on iPhone). Android hides the Google base map
// (mapType "none") so only OSM tiles show. Tapping the map or dragging
// the pin reports the new point; the parent owns the coordinates. The
// "© OpenStreetMap contributors" line is rendered by the parent so it is
// always visible. Web uses PinMap.web.tsx (Leaflet).

const styles = StyleSheet.create({
  map: { height: 240, width: "100%" },
});

function delta(radiusKm: number | undefined): number {
  // ~111 km per degree; frame the circle with some margin.
  return radiusKm === undefined ? 0.01 : Math.min(2, (radiusKm * 2.6) / 111);
}

export function PinMap(props: PinMapProps) {
  const ref = useRef<MapView | null>(null);
  const span = delta(props.radiusKm);

  useEffect(() => {
    ref.current?.animateToRegion(
      {
        latitude: props.latitude,
        longitude: props.longitude,
        latitudeDelta: span,
        longitudeDelta: span,
      },
      250,
    );
  }, [props.latitude, props.longitude, span]);

  return (
    <MapView
      accessibilityLabel={props.accessibilityLabel}
      initialRegion={{
        latitude: props.latitude,
        longitude: props.longitude,
        latitudeDelta: span,
        longitudeDelta: span,
      }}
      mapType={Platform.OS === "android" ? "none" : "standard"}
      onPress={(e) =>
        props.onMove(
          e.nativeEvent.coordinate.latitude,
          e.nativeEvent.coordinate.longitude,
        )
      }
      ref={ref}
      style={styles.map}
      testID={props.testID}
    >
      <UrlTile
        maximumZ={19}
        shouldReplaceMapContent
        urlTemplate={OSM_TILE_URL}
      />
      <Marker
        coordinate={{ latitude: props.latitude, longitude: props.longitude }}
        draggable
        onDragEnd={(e) =>
          props.onMove(
            e.nativeEvent.coordinate.latitude,
            e.nativeEvent.coordinate.longitude,
          )
        }
        pinColor={THEME_COLORS.indigo}
      />
      {props.radiusKm === undefined ? null : (
        <Circle
          center={{ latitude: props.latitude, longitude: props.longitude }}
          fillColor="rgba(34, 5, 164, 0.12)"
          radius={props.radiusKm * 1000}
          strokeColor={THEME_COLORS.indigo}
        />
      )}
    </MapView>
  );
}
