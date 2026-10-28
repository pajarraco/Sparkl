import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { SparklButton } from "../../components/SparklButton";
import { SparklTextField } from "../../components/SparklTextField";
import { sparklTrpc } from "../../providers/app-providers";
import { authClient } from "../../providers/auth-instance";
import {
  type AvailabilityToggles,
  availabilitySlotsForToggles,
  initialsForName,
  togglesForAvailability,
  validateServiceArea,
} from "../../providers/cleaner-profile";
import { getStrings } from "../../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../providers/theme";

// Cleaner Profile (design.md Screen Inventory): identity header (initials
// avatar, name, rating and completed-job count), service-area editor
// (feeds the distance filter and ranking), availability editor (weekday /
// weekend toggles expanding to 09:00–17:00 slots), and sign-out. Photo
// upload lands later — the avatar shows initials until then (design.md
// allows photo or initials). Availability reads back through the public
// profile query; both saves refetch so the header never goes stale.

const styles = StyleSheet.create({
  section: {
    gap: THEME_SPACING.rowMin,
    marginBottom: THEME_SPACING.section,
  },
  heading: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.ink,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME_SPACING.rowMax,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: THEME_RADII.avatar,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: THEME_COLORS.inkSoft,
  },
  name: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: THEME_COLORS.ink,
  },
  trust: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
  trustStars: {
    color: THEME_COLORS.orangeDeep,
    fontWeight: "500",
  },
  hint: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: THEME_SPACING.touchTarget,
  },
  toggleLabel: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.ink,
  },
  formError: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
  saved: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.indigo,
  },
  skeleton: {
    height: 96,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
  },
});

function ToggleRow(props: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{props.label}</Text>
      <Switch
        accessibilityLabel={props.label}
        accessibilityRole="switch"
        onValueChange={props.onValueChange}
        testID={props.testID}
        value={props.value}
      />
    </View>
  );
}

export default function CleanerProfileScreen() {
  const strings = getStrings();

  const profileQuery = sparklTrpc.users.getProfile.useQuery();
  const session = authClient.useSession();
  const cleanerId = session.data?.user?.id ?? null;
  const publicQuery = sparklTrpc.users.getPublicCleanerProfile.useQuery(
    { cleanerId: cleanerId ?? "" },
    { enabled: cleanerId !== null },
  );

  const setServiceArea = sparklTrpc.users.setServiceArea.useMutation();
  const setAvailability = sparklTrpc.users.setAvailability.useMutation();

  const [toggles, setToggles] = useState<AvailabilityToggles | null>(null);
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [latitude, setLatitude] = useState<string | null>(null);
  const [longitude, setLongitude] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<string | null>(null);
  const [areaErrors, setAreaErrors] = useState<{
    latitude?: string | undefined;
    longitude?: string | undefined;
    radiusKm?: string | undefined;
  }>({});
  const [areaError, setAreaError] = useState<string | null>(null);

  // No explicit navigation here: the tab layout redirects to welcome once
  // the session clears. Navigating too caused a visible double reload.
  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
  }

  async function handleSaveArea(): Promise<void> {
    const profile = profileQuery.data;
    const result = validateServiceArea({
      latitude:
        latitude ??
        (profile?.serviceLat === null || profile?.serviceLat === undefined
          ? ""
          : String(profile.serviceLat)),
      longitude:
        longitude ??
        (profile?.serviceLng === null || profile?.serviceLng === undefined
          ? ""
          : String(profile.serviceLng)),
      radiusKm:
        radiusKm ??
        (profile?.serviceRadiusKm === null ||
        profile?.serviceRadiusKm === undefined
          ? ""
          : String(profile.serviceRadiusKm)),
    });
    setAreaErrors(result.errors);
    if (result.data === null) return;
    setAreaError(null);
    try {
      await setServiceArea.mutateAsync({
        serviceLat: result.data.latitude,
        serviceLng: result.data.longitude,
        serviceRadiusKm: result.data.radiusKm,
      });
      await profileQuery.refetch();
    } catch {
      setAreaError(strings.errors.generic);
    }
  }

  function handleToggle(next: AvailabilityToggles): void {
    setToggles(next);
    setAvailabilitySaved(false);
    setAvailabilityError(null);
  }

  async function handleSaveAvailability(): Promise<void> {
    setAvailabilityError(null);
    try {
      await setAvailability.mutateAsync({
        slots: availabilitySlotsForToggles(effectiveToggles),
      });
      await publicQuery.refetch();
      setAvailabilitySaved(true);
    } catch {
      setAvailabilityError(strings.errors.generic);
    }
  }

  if (profileQuery.isPending) {
    return (
      <Screen testID="cleaner-profile-screen" title={strings.profile.title}>
        <View style={styles.skeleton} />
        <View style={styles.skeleton} />
      </Screen>
    );
  }

  if (profileQuery.isError || profileQuery.data === undefined) {
    return (
      <Screen testID="cleaner-profile-screen" title={strings.profile.title}>
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {strings.errors.generic}
        </Text>
        <SparklButton
          accessibilityLabel={strings.errors.retry}
          onPress={() => {
            void profileQuery.refetch();
          }}
          testID="cleaner-profile-retry"
          title={strings.errors.retry}
          variant="secondary"
        />
      </Screen>
    );
  }

  const profile = profileQuery.data;
  const effectiveToggles =
    toggles ?? togglesForAvailability(publicQuery.data?.availability ?? []);
  const trustLine =
    profile.avgRating === null
      ? `${profile.completedJobCount} ${strings.jobCard.jobsDone}`
      : `${profile.avgRating.toFixed(1)} · ${profile.completedJobCount} ${strings.jobCard.jobsDone}`;

  return (
    <Screen testID="cleaner-profile-screen" title={strings.profile.title}>
      <View style={styles.section}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initialsForName(profile.name)}
            </Text>
          </View>
          <View>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.trust}>
              <Text style={styles.trustStars}>{"★ "}</Text>
              {trustLine}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>{strings.profile.areaLabel}</Text>
        <SparklTextField
          accessibilityLabel={strings.postJob.latitudeLabel}
          error={areaErrors.latitude}
          keyboardType="numbers-and-punctuation"
          label={strings.postJob.latitudeLabel}
          onChangeText={setLatitude}
          testID="cleaner-profile-latitude"
          value={
            latitude ??
            (profile.serviceLat === null ? "" : String(profile.serviceLat))
          }
        />
        <SparklTextField
          accessibilityLabel={strings.postJob.longitudeLabel}
          error={areaErrors.longitude}
          keyboardType="numbers-and-punctuation"
          label={strings.postJob.longitudeLabel}
          onChangeText={setLongitude}
          testID="cleaner-profile-longitude"
          value={
            longitude ??
            (profile.serviceLng === null ? "" : String(profile.serviceLng))
          }
        />
        <SparklTextField
          accessibilityLabel={strings.profile.radiusLabel}
          error={areaErrors.radiusKm}
          keyboardType="decimal-pad"
          label={strings.profile.radiusLabel}
          onChangeText={setRadiusKm}
          testID="cleaner-profile-radius"
          value={
            radiusKm ??
            (profile.serviceRadiusKm === null
              ? ""
              : String(profile.serviceRadiusKm))
          }
        />
        {areaError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.formError}>
            {areaError}
          </Text>
        )}
        <SparklButton
          accessibilityLabel={strings.profile.saveArea}
          loading={setServiceArea.isPending}
          onPress={() => {
            void handleSaveArea();
          }}
          testID="cleaner-profile-save-area"
          title={strings.profile.saveArea}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>{strings.availability.title}</Text>
        <Text style={styles.hint}>{strings.availability.hint}</Text>
        <ToggleRow
          label={strings.availability.weekdaysLabel}
          onValueChange={(value) => {
            handleToggle({ ...effectiveToggles, weekdays: value });
          }}
          testID="cleaner-profile-weekdays"
          value={effectiveToggles.weekdays}
        />
        <ToggleRow
          label={strings.availability.weekendLabel}
          onValueChange={(value) => {
            handleToggle({ ...effectiveToggles, weekend: value });
          }}
          testID="cleaner-profile-weekend"
          value={effectiveToggles.weekend}
        />
        {availabilityError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.formError}>
            {availabilityError}
          </Text>
        )}
        {availabilitySaved ? (
          <Text accessibilityLiveRegion="polite" style={styles.saved}>
            {strings.availability.saved}
          </Text>
        ) : null}
        <SparklButton
          accessibilityLabel={strings.availability.save}
          loading={setAvailability.isPending}
          onPress={() => {
            void handleSaveAvailability();
          }}
          testID="cleaner-profile-save-availability"
          title={strings.availability.save}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>{strings.profile.settingsHeading}</Text>
        <SparklButton
          accessibilityLabel={strings.profile.signOut}
          onPress={() => {
            void handleSignOut();
          }}
          testID="cleaner-profile-sign-out"
          title={strings.profile.signOut}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
