import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "../../../../../components/DetailScreen";
import { PropertyForm } from "../../../../../components/PropertyForm";
import { SparklButton } from "../../../../../components/SparklButton";
import { sparklTrpc } from "../../../../../providers/app-providers";
import { getStrings } from "../../../../../providers/i18n";
import { THEME_COLORS, THEME_RADII } from "../../../../../providers/theme";
import {
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../../../../../providers/theme";

// Edit an existing property (design.md Properties screens): the
// AddressMapPicker and fields pre-filled, plus Archive instead of delete
// once jobs may reference it.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const styles = StyleSheet.create({
  skeleton: {
    height: 96,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
  },
  formError: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
  archivedText: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
  archiveRow: {
    marginTop: THEME_SPACING.section,
  },
});

export default function EditPropertyScreen() {
  const strings = getStrings();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const propertyId = rawId !== undefined && UUID_RE.test(rawId) ? rawId : null;

  const query = sparklTrpc.properties.list.useQuery({
    includeArchived: true,
  });
  const update = sparklTrpc.properties.update.useMutation();
  const archive = sparklTrpc.properties.archive.useMutation();
  const property =
    propertyId === null || query.data === undefined
      ? undefined
      : query.data.find((candidate) => candidate.id === propertyId);

  if (property === undefined) {
    if (query.isPending) {
      return (
        <DetailScreen
          testID="property-edit-screen"
          title={strings.properties.title}
          userRole="host"
        >
          <View style={styles.skeleton} />
        </DetailScreen>
      );
    }
    return (
      <DetailScreen
        testID="property-edit-screen"
        title={strings.properties.title}
        userRole="host"
      >
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {strings.errors.generic}
        </Text>
        <SparklButton
          accessibilityLabel={strings.errors.retry}
          onPress={() => {
            void query.refetch();
          }}
          testID="property-edit-retry"
          title={strings.errors.retry}
          variant="secondary"
        />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      testID="property-edit-screen"
      title={property.name}
      userRole="host"
    >
      <PropertyForm
        initialValues={property}
        onSubmit={async (data) => {
          await update.mutateAsync({ propertyId: property.id, ...data });
          await query.refetch();
        }}
        submitting={update.isPending}
      />
      {property.archivedAt === null ? (
        <View style={styles.archiveRow}>
          <SparklButton
            accessibilityLabel={strings.properties.archive}
            loading={archive.isPending}
            onPress={() => {
              void (async () => {
                await archive.mutateAsync({ propertyId: property.id });
                await query.refetch();
              })();
            }}
            testID="property-archive"
            title={strings.properties.archive}
            variant="destructive"
          />
        </View>
      ) : (
        <View style={styles.archiveRow}>
          <Text
            accessibilityLiveRegion="polite"
            style={styles.archivedText}
            testID="property-archived"
          >
            {strings.properties.archived}
          </Text>
        </View>
      )}
    </DetailScreen>
  );
}
