import type { CreatePropertyInput } from "@sparkl/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AddressValue } from "../providers/address-picker";
import { getStrings } from "../providers/i18n";
import {
  type PropertyFieldErrors,
  validateProperty,
} from "../providers/properties";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../providers/theme";
import { AddressMapPicker } from "./AddressMapPicker";
import { SparklButton } from "./SparklButton";
import { SparklTextField } from "./SparklTextField";

// Add/edit property form (design.md Properties screens): the same
// AddressMapPicker as Post Job, name, size, default checklist. The
// caller (new.tsx / [id].tsx) owns what happens on a successful submit —
// navigate back, or refetch the list — so this stays a plain form.

export interface PropertyFormValues {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sizeSqm: number | null;
  defaultNotes: string | null;
}

export interface PropertyFormProps {
  initialValues?: Partial<PropertyFormValues> | undefined;
  onSubmit: (data: CreatePropertyInput) => Promise<void>;
  submitting: boolean;
}

const styles = StyleSheet.create({
  form: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
  formError: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
});

export function PropertyForm(props: PropertyFormProps) {
  const strings = getStrings();
  const initial = props.initialValues;
  const [name, setName] = useState(initial?.name ?? "");
  const [place, setPlace] = useState<AddressValue>({
    address: initial?.address ?? "",
    latitude: initial?.latitude !== undefined ? String(initial.latitude) : "",
    longitude:
      initial?.longitude !== undefined ? String(initial.longitude) : "",
  });
  const [sizeSqm, setSizeSqm] = useState(
    initial?.sizeSqm !== undefined && initial.sizeSqm !== null
      ? String(initial.sizeSqm)
      : "",
  );
  const [notes, setNotes] = useState(initial?.defaultNotes ?? "");
  const [errors, setErrors] = useState<PropertyFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    const result = validateProperty({
      name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      sizeSqm,
      notes,
    });
    setErrors(result.errors);
    if (result.data === null) return;
    setFormError(null);
    try {
      await props.onSubmit(result.data);
    } catch {
      setFormError(strings.errors.generic);
    }
  }

  return (
    <View style={styles.form}>
      <SparklTextField
        error={errors.name}
        label={strings.properties.nameLabel}
        onChangeText={setName}
        placeholder={strings.properties.namePlaceholder}
        testID="property-name"
        value={name}
      />
      <AddressMapPicker
        addressError={errors.address}
        onChange={setPlace}
        testIDPrefix="property"
        value={place}
      />
      <SparklTextField
        error={errors.sizeSqm}
        keyboardType="decimal-pad"
        label={strings.properties.sizeLabel}
        onChangeText={setSizeSqm}
        placeholder={strings.properties.sizePlaceholder}
        testID="property-size"
        value={sizeSqm}
      />
      <SparklTextField
        error={errors.notes}
        label={strings.properties.notesLabel}
        onChangeText={setNotes}
        placeholder={strings.properties.notesPlaceholder}
        testID="property-notes"
        value={notes}
      />
      {formError === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {formError}
        </Text>
      )}
      <SparklButton
        accessibilityLabel={strings.properties.save}
        loading={props.submitting}
        onPress={() => {
          void handleSubmit();
        }}
        testID="property-save"
        title={strings.properties.save}
      />
    </View>
  );
}
