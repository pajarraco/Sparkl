import type { Property } from "@sparkl/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AddressValue } from "../providers/address-picker";
import { sparklTrpc } from "../providers/app-providers";
import { getStrings } from "../providers/i18n";
import type { PostJobFormValues } from "../providers/job-assistant";
import {
  type PostJobFieldErrors,
  validatePostJob,
} from "../providers/post-job";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";
import { AddressMapPicker } from "./AddressMapPicker";
import { BodyText } from "./BodyText";
import { SparklButton } from "./SparklButton";
import { SparklTextField } from "./SparklTextField";

// The Post Job form, pre-filled from the assistant draft when the host
// opens Review (or "Use the form instead"). The host always submits here;
// the model never posts. Validation stays in validatePostJob.

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
  propertyPicker: {
    gap: THEME_SPACING.rowMin,
  },
  propertyChip: {
    minHeight: THEME_SPACING.touchTarget,
    justifyContent: "center",
    paddingHorizontal: THEME_SPACING.rowMax,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.control,
    backgroundColor: THEME_COLORS.paper,
  },
  propertyChipSelected: {
    borderColor: THEME_COLORS.indigo,
    backgroundColor: THEME_COLORS.paper2,
  },
  propertyChipLabel: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.ink,
  },
  propertyLink: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.indigo,
  },
  propertyChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME_SPACING.rowMin,
  },
});

export interface PostJobFormProps {
  initialValues: PostJobFormValues;
  // Called once the job exists, with the values the host posted (04 step 8).
  // The caller is responsible for navigating away (redirect to My Jobs).
  onPosted?: (jobId: string, values: PostJobFormValues) => void;
}

export function PostJobForm(props: PostJobFormProps) {
  const strings = getStrings();
  const router = useRouter();
  const createJob = sparklTrpc.jobs.create.useMutation();
  const propertiesQuery = sparklTrpc.properties.list.useQuery({
    includeArchived: false,
  });
  const initial = props.initialValues;
  const [place, setPlace] = useState<AddressValue>({
    address: initial.address,
    latitude: initial.latitude,
    longitude: initial.longitude,
  });
  // 03 E: picking a saved property fills place from it and skips the
  // manual AddressMapPicker; it stays available for a one-off address.
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [date, setDate] = useState(initial.date);
  const [windowStart, setWindowStart] = useState(initial.windowStart);
  const [windowEnd, setWindowEnd] = useState(initial.windowEnd);
  const [sizeSqm, setSizeSqm] = useState(initial.sizeSqm);
  const [notes, setNotes] = useState(initial.notes);
  const [price, setPrice] = useState(initial.price);
  const [errors, setErrors] = useState<PostJobFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function selectProperty(property: Property): void {
    setSelectedPropertyId(property.id);
    setPlace({
      address: property.address,
      latitude: String(property.latitude),
      longitude: String(property.longitude),
    });
    if (notes.trim() === "" && property.defaultNotes !== null) {
      setNotes(property.defaultNotes);
    }
  }

  function clearProperty(): void {
    setSelectedPropertyId(null);
    setPlace({ address: "", latitude: "", longitude: "" });
  }

  async function handlePost(): Promise<void> {
    const result = validatePostJob({
      address: place.address,
      date,
      windowStart,
      windowEnd,
      sizeSqm,
      notes,
      price,
      latitude: place.latitude,
      longitude: place.longitude,
      propertyId: selectedPropertyId ?? "",
    });
    setErrors(result.errors);
    if (result.data === null) return;
    setFormError(null);
    try {
      // The pin came from the assistant's memory; the server re-checks it.
      const job = await createJob.mutateAsync(
        initial.preferredCleanerId === ""
          ? result.data
          : { ...result.data, preferredCleanerId: initial.preferredCleanerId },
      );
      props.onPosted?.(job.id, {
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        date,
        windowStart,
        windowEnd,
        sizeSqm,
        notes,
        price,
        preferredCleanerId: initial.preferredCleanerId,
      });
    } catch {
      setFormError(strings.errors.generic);
    }
  }

  const properties = propertiesQuery.data ?? [];

  return (
    <View style={styles.form}>
      {propertiesQuery.isPending ? null : properties.length === 0 ? (
        <View style={styles.propertyPicker}>
          <Text style={styles.propertyLink}>
            {strings.postJobProperty.noneSaved}
          </Text>
          <Pressable
            accessibilityLabel={strings.postJobProperty.addFirst}
            accessibilityRole="link"
            onPress={() => router.push("/host/properties")}
            testID="post-job-add-property"
          >
            <Text style={styles.propertyLink}>
              {strings.postJobProperty.addFirst}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.propertyPicker} testID="post-job-property-picker">
          <Text style={styles.propertyChipLabel}>
            {strings.postJobProperty.label}
          </Text>
          <View style={styles.propertyChipRow}>
            {properties.map((property) => (
              <Pressable
                key={property.id}
                accessibilityLabel={property.name}
                accessibilityRole="button"
                onPress={() => selectProperty(property)}
                style={[
                  styles.propertyChip,
                  selectedPropertyId === property.id
                    ? styles.propertyChipSelected
                    : null,
                ]}
                testID={`post-job-property-${property.id}`}
              >
                <Text style={styles.propertyChipLabel}>{property.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {selectedPropertyId === null ? (
        <AddressMapPicker
          addressError={errors.address}
          coordsError={
            errors.latitude !== undefined || errors.longitude !== undefined
              ? strings.postJob.pickAddress
              : undefined
          }
          onChange={setPlace}
          value={place}
        />
      ) : (
        <View style={styles.propertyPicker}>
          <BodyText testID="post-job-selected-address">
            {place.address}
          </BodyText>
          <Pressable
            accessibilityLabel={strings.postJobProperty.placeholder}
            accessibilityRole="button"
            onPress={clearProperty}
            testID="post-job-clear-property"
          >
            <Text style={styles.propertyLink}>
              {strings.postJobProperty.placeholder}
            </Text>
          </Pressable>
        </View>
      )}
      <SparklTextField
        error={errors.date}
        label={strings.postJob.dateLabel}
        onChangeText={setDate}
        placeholder={strings.postJob.datePlaceholder}
        testID="post-job-date"
        value={date}
      />
      <SparklTextField
        error={errors.windowStart}
        label={strings.postJob.windowStartLabel}
        onChangeText={setWindowStart}
        placeholder={strings.postJob.timePlaceholder}
        testID="post-job-window-start"
        value={windowStart}
      />
      <SparklTextField
        error={errors.windowEnd}
        label={strings.postJob.windowEndLabel}
        onChangeText={setWindowEnd}
        placeholder={strings.postJob.timePlaceholder}
        testID="post-job-window-end"
        value={windowEnd}
      />
      <SparklTextField
        error={errors.sizeSqm}
        keyboardType="decimal-pad"
        label={strings.postJob.sizeLabel}
        onChangeText={setSizeSqm}
        placeholder={strings.postJob.sizePlaceholder}
        testID="post-job-size"
        value={sizeSqm}
      />
      <SparklTextField
        error={errors.notes}
        label={strings.postJob.notesLabel}
        onChangeText={setNotes}
        placeholder={strings.postJob.notesPlaceholder}
        testID="post-job-notes"
        value={notes}
      />
      <SparklTextField
        error={errors.price}
        keyboardType="decimal-pad"
        label={strings.postJob.priceLabel}
        onChangeText={setPrice}
        testID="post-job-price"
        value={price}
      />
      {formError === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {formError}
        </Text>
      )}
      <SparklButton
        accessibilityLabel={strings.postJob.submit}
        loading={createJob.isPending}
        onPress={() => {
          void handlePost();
        }}
        testID="post-job-submit"
        title={strings.postJob.submit}
      />
    </View>
  );
}
