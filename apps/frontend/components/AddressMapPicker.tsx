import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AUTOCOMPLETE_DEBOUNCE_MS,
  AUTOCOMPLETE_LIMIT,
  type AddressValue,
  coordsOf,
  pinToValue,
  placeToValue,
  shouldAutocomplete,
  typedAddress,
} from "../providers/address-picker";
import { sparklTrpc } from "../providers/app-providers";
import { getStrings } from "../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";
import { BodyText } from "./BodyText";
import { PinMap } from "./PinMap";
import { SparklTextField } from "./SparklTextField";

// Address entry for Post Job (02 plan): OSM autocomplete through the API
// (debounced; the server caches and rate-limits), then a map pin the host
// can drag to the exact entrance. Coordinates only come from a picked
// suggestion or the pin; typing clears them. Reverse geocoding after a
// pin move refreshes the label. The OSM attribution is always visible.

const styles = StyleSheet.create({
  root: {
    gap: THEME_SPACING.rowMin,
  },
  option: {
    minHeight: THEME_SPACING.touchTarget,
    justifyContent: "center",
    paddingHorizontal: THEME_SPACING.rowMax,
    paddingVertical: THEME_SPACING.rowMin,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.control,
    backgroundColor: THEME_COLORS.paper,
  },
  optionPressed: {
    backgroundColor: THEME_COLORS.paper2,
  },
  optionText: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.ink,
  },
  mapFrame: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
  },
  meta: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    color: THEME_COLORS.inkSoft,
  },
  error: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
});

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export interface AddressMapPickerProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  addressError?: string | undefined;
  coordsError?: string | undefined;
  // Defaults fit Post Job; the cleaner service area overrides them.
  label?: string | undefined;
  mapHint?: string | undefined;
  radiusKm?: number | undefined;
  testIDPrefix?: string | undefined;
}

export function AddressMapPicker(props: AddressMapPickerProps) {
  const strings = getStrings();
  const utils = sparklTrpc.useUtils();
  const prefix = props.testIDPrefix ?? "post-job";
  const mapHint = props.mapHint ?? strings.postJob.mapHint;
  const coords = coordsOf(props.value);
  const picked = coords !== null;
  const query = useDebounced(
    props.value.address.trim(),
    AUTOCOMPLETE_DEBOUNCE_MS,
  );
  const searching = shouldAutocomplete(query, picked);

  const suggestions = sparklTrpc.geo.autocomplete.useQuery(
    { query, limit: AUTOCOMPLETE_LIMIT },
    { enabled: searching, staleTime: 60_000, retry: false },
  );

  // Only the latest pin move may update the label.
  const moveSeq = useRef(0);

  async function handlePinMove(latitude: number, longitude: number) {
    // Move first, then refine the label once the reverse lookup answers.
    const seq = ++moveSeq.current;
    props.onChange(pinToValue(props.value, latitude, longitude, null));
    try {
      const result = await utils.geo.reverse.fetch({ latitude, longitude });
      if (seq !== moveSeq.current) return;
      props.onChange(
        pinToValue(props.value, latitude, longitude, result.place),
      );
    } catch {
      // Keep the current label; the coordinates are already saved.
    }
  }

  const places = searching ? (suggestions.data?.places ?? []) : [];

  return (
    <View style={styles.root}>
      <SparklTextField
        error={props.addressError}
        label={props.label ?? strings.postJob.addressLabel}
        onChangeText={(text) => props.onChange(typedAddress(text))}
        placeholder={strings.postJob.addressHint}
        testID={`${prefix}-address`}
        value={props.value.address}
      />
      {searching && suggestions.isFetching ? (
        <Text style={styles.meta}>{strings.postJob.searching}</Text>
      ) : null}
      {searching && suggestions.isSuccess && places.length === 0 ? (
        <Text style={styles.meta} testID={`${prefix}-no-matches`}>
          {strings.postJob.noMatches}
        </Text>
      ) : null}
      {places.map((place, index) => (
        <Pressable
          accessibilityLabel={place.label}
          accessibilityRole="button"
          key={place.id}
          onPress={() => props.onChange(placeToValue(place))}
          style={({ pressed }) => [
            styles.option,
            pressed ? styles.optionPressed : null,
          ]}
          testID={`${prefix}-place-${index}`}
        >
          <Text style={styles.optionText}>{place.label}</Text>
        </Pressable>
      ))}
      {coords === null ? null : (
        <>
          <View style={styles.mapFrame}>
            <PinMap
              accessibilityLabel={mapHint}
              latitude={coords.latitude}
              longitude={coords.longitude}
              radiusKm={props.radiusKm}
              onMove={(latitude, longitude) => {
                void handlePinMove(latitude, longitude);
              }}
              testID={`${prefix}-map`}
            />
          </View>
          <BodyText soft>{mapHint}</BodyText>
          <Text style={styles.meta}>{strings.postJob.osmAttribution}</Text>
        </>
      )}
      {props.coordsError === undefined ? null : (
        <Text
          accessibilityLiveRegion="polite"
          style={styles.error}
          testID={`${prefix}-coords-error`}
        >
          {props.coordsError}
        </Text>
      )}
    </View>
  );
}
