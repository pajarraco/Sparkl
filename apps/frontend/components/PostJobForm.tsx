import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  success: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
});

export interface PostJobFormProps {
  initialValues: PostJobFormValues;
  onPostAgain: () => void;
  // Called once the job exists, with the values the host posted (04 step 8).
  onPosted?: (jobId: string, values: PostJobFormValues) => void;
}

export function PostJobForm(props: PostJobFormProps) {
  const strings = getStrings();
  const createJob = sparklTrpc.jobs.create.useMutation();
  const initial = props.initialValues;
  const [place, setPlace] = useState<AddressValue>({
    address: initial.address,
    latitude: initial.latitude,
    longitude: initial.longitude,
  });
  const [date, setDate] = useState(initial.date);
  const [windowStart, setWindowStart] = useState(initial.windowStart);
  const [windowEnd, setWindowEnd] = useState(initial.windowEnd);
  const [sizeSqm, setSizeSqm] = useState(initial.sizeSqm);
  const [notes, setNotes] = useState(initial.notes);
  const [price, setPrice] = useState(initial.price);
  const [errors, setErrors] = useState<PostJobFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

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
      setPosted(true);
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

  if (posted) {
    return (
      <View style={styles.success}>
        <BodyText testID="post-job-success">{strings.postJob.success}</BodyText>
        <SparklButton
          accessibilityLabel={strings.postJob.title}
          onPress={props.onPostAgain}
          testID="post-job-again"
          title={strings.postJob.title}
          variant="secondary"
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
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
