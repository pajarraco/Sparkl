import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
}

export function PostJobForm(props: PostJobFormProps) {
  const strings = getStrings();
  const createJob = sparklTrpc.jobs.create.useMutation();
  const initial = props.initialValues;
  const [address, setAddress] = useState(initial.address);
  const [date, setDate] = useState(initial.date);
  const [windowStart, setWindowStart] = useState(initial.windowStart);
  const [windowEnd, setWindowEnd] = useState(initial.windowEnd);
  const [sizeSqm, setSizeSqm] = useState(initial.sizeSqm);
  const [notes, setNotes] = useState(initial.notes);
  const [price, setPrice] = useState(initial.price);
  const [latitude, setLatitude] = useState(initial.latitude);
  const [longitude, setLongitude] = useState(initial.longitude);
  const [errors, setErrors] = useState<PostJobFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  async function handlePost(): Promise<void> {
    const result = validatePostJob({
      address,
      date,
      windowStart,
      windowEnd,
      sizeSqm,
      notes,
      price,
      latitude,
      longitude,
    });
    setErrors(result.errors);
    if (result.data === null) return;
    setFormError(null);
    try {
      await createJob.mutateAsync(result.data);
      setPosted(true);
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
      <SparklTextField
        error={errors.address}
        label={strings.postJob.addressLabel}
        onChangeText={setAddress}
        testID="post-job-address"
        value={address}
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
      <SparklTextField
        error={errors.latitude}
        keyboardType="numbers-and-punctuation"
        label={strings.postJob.latitudeLabel}
        onChangeText={setLatitude}
        testID="post-job-latitude"
        value={latitude}
      />
      <SparklTextField
        error={errors.longitude}
        keyboardType="numbers-and-punctuation"
        label={strings.postJob.longitudeLabel}
        onChangeText={setLongitude}
        testID="post-job-longitude"
        value={longitude}
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
