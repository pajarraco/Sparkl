import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BodyText } from "../../../components/BodyText";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import { SparklTextField } from "../../../components/SparklTextField";
import { sparklTrpc } from "../../../providers/app-providers";
import { getStrings } from "../../../providers/i18n";
import {
  type PostJobFieldErrors,
  validatePostJob,
} from "../../../providers/post-job";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../../../providers/theme";

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

export default function HostPostScreen() {
  const strings = getStrings();
  const createJob = sparklTrpc.jobs.create.useMutation();
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [sizeSqm, setSizeSqm] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
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

  function resetForm(): void {
    setAddress("");
    setDate("");
    setWindowStart("");
    setWindowEnd("");
    setSizeSqm("");
    setNotes("");
    setPrice("");
    setLatitude("");
    setLongitude("");
    setErrors({});
    setFormError(null);
    setPosted(false);
  }

  if (posted) {
    return (
      <Screen testID="host-post-screen" title={strings.postJob.title}>
        <View style={styles.success}>
          <BodyText testID="post-job-success">
            {strings.postJob.success}
          </BodyText>
          <SparklButton
            accessibilityLabel={strings.postJob.title}
            onPress={resetForm}
            testID="post-job-again"
            title={strings.postJob.title}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="host-post-screen" title={strings.postJob.title}>
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
    </Screen>
  );
}
