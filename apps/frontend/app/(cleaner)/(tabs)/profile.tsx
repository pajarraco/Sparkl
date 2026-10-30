import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { AddressMapPicker } from "../../../components/AddressMapPicker";
import { ReviewsReceived } from "../../../components/ReviewsReceived";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import type { AddressValue } from "../../../providers/address-picker";
import { sparklTrpc } from "../../../providers/app-providers";
import { authClient } from "../../../providers/auth-instance";
import {
  type AvailabilityToggles,
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS_KM,
  areaValueFromProfile,
  initialsForName,
  planProfileSave,
  togglesForAvailability,
} from "../../../providers/cleaner-profile";
import { getStrings } from "../../../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../providers/theme";

// Cleaner Profile (design.md Screen Inventory): identity header (initials
// avatar, name, rating and completed-job count), service-area editor
// (base address or pin on an OSM map plus a radius chip; feeds the
// distance filter and ranking), availability editor (weekday / weekend
// toggles expanding to 09:00–17:00 slots), one Save button for both (02
// plan, from 03), and sign-out. Photo upload lands later — the avatar
// shows initials until then (design.md allows photo or initials).
// Availability reads back through the public profile query; saving
// refetches both queries so the header never goes stale.

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
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME_SPACING.rowMin,
  },
  chip: {
    minHeight: THEME_SPACING.touchTarget,
    minWidth: THEME_SPACING.touchTarget,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: THEME_SPACING.rowMax,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.control,
    backgroundColor: THEME_COLORS.paper,
  },
  chipSelected: {
    borderColor: THEME_COLORS.indigo,
    backgroundColor: THEME_COLORS.indigo,
  },
  chipText: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.ink,
  },
  chipTextSelected: {
    color: THEME_COLORS.paper,
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

  // null = not edited yet; the saved profile values show until then.
  const [toggles, setToggles] = useState<AvailabilityToggles | null>(null);
  const [area, setArea] = useState<AddressValue | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // No explicit navigation here: the tab layout redirects to welcome once
  // the session clears. Navigating too caused a visible double reload.
  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
  }

  function edited(): void {
    setSaved(false);
    setSaveError(null);
  }

  async function handleSave(): Promise<void> {
    const plan = planProfileSave({
      area: effectiveArea,
      radiusKm: effectiveRadius,
      toggles: effectiveToggles,
    });
    setSaved(false);
    setSaveError(plan.error);
    if (plan.error !== null) return;
    try {
      if (plan.serviceArea !== null) {
        await setServiceArea.mutateAsync(plan.serviceArea);
      }
      await setAvailability.mutateAsync({ slots: plan.slots });
      await Promise.all([profileQuery.refetch(), publicQuery.refetch()]);
      setSaved(true);
    } catch {
      setSaveError(strings.errors.generic);
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
  const effectiveArea = area ?? areaValueFromProfile(profile);
  const effectiveRadius =
    radiusKm ?? profile.serviceRadiusKm ?? DEFAULT_RADIUS_KM;
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
        <AddressMapPicker
          label={strings.profile.baseAddressLabel}
          mapHint={strings.profile.areaHint}
          onChange={(value) => {
            setArea(value);
            edited();
          }}
          radiusKm={effectiveRadius}
          testIDPrefix="cleaner-profile"
          value={effectiveArea}
        />
        <Text style={styles.hint}>{strings.profile.radiusLabel}</Text>
        <View style={styles.chips}>
          {RADIUS_OPTIONS_KM.map((km) => {
            const selected = km === effectiveRadius;
            const label = strings.profile.radiusOption.replace(
              "{km}",
              String(km),
            );
            return (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={km}
                onPress={() => {
                  setRadiusKm(km);
                  edited();
                }}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                testID={`cleaner-profile-radius-${km}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected ? styles.chipTextSelected : null,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>{strings.availability.title}</Text>
        <Text style={styles.hint}>{strings.availability.hint}</Text>
        <ToggleRow
          label={strings.availability.weekdaysLabel}
          onValueChange={(value) => {
            setToggles({ ...effectiveToggles, weekdays: value });
            edited();
          }}
          testID="cleaner-profile-weekdays"
          value={effectiveToggles.weekdays}
        />
        <ToggleRow
          label={strings.availability.weekendLabel}
          onValueChange={(value) => {
            setToggles({ ...effectiveToggles, weekend: value });
            edited();
          }}
          testID="cleaner-profile-weekend"
          value={effectiveToggles.weekend}
        />
      </View>
      <View style={styles.section}>
        {saveError === null ? null : (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.formError}
            testID="cleaner-profile-save-error"
          >
            {saveError}
          </Text>
        )}
        {saved ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.saved}
            testID="cleaner-profile-saved"
          >
            {strings.profile.saved}
          </Text>
        ) : null}
        <SparklButton
          accessibilityLabel={strings.profile.save}
          loading={setServiceArea.isPending || setAvailability.isPending}
          onPress={() => {
            void handleSave();
          }}
          testID="cleaner-profile-save"
          title={strings.profile.save}
        />
      </View>
      <ReviewsReceived subjectId={profile.id} />
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
