import type { Property } from "@sparkl/shared";
import { useFocusEffect, useRouter, useSegments } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BodyText } from "../../../../components/BodyText";
import { Screen } from "../../../../components/Screen";
import { SparklButton } from "../../../../components/SparklButton";
import { sparklTrpc } from "../../../../providers/app-providers";
import { getStrings } from "../../../../providers/i18n";
import { propertyMetaLine } from "../../../../providers/properties";
import { stackHref } from "../../../../providers/tabs";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../../providers/theme";

// Host Properties tab (design.md Screen Inventory + Property row): list of
// active properties, newest first, each opening the edit form on press.
// "Add property" sits above the list; with none saved the empty state
// says so instead of a generic line.

const styles = StyleSheet.create({
  list: {
    gap: THEME_SPACING.rowMax,
  },
  flatList: {
    flex: 1,
  },
  skeleton: {
    height: 88,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
  },
  error: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
  row: {
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
    padding: THEME_SPACING.rowMax,
    gap: THEME_SPACING.rowMin,
  },
  rowName: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: THEME_COLORS.ink,
  },
  rowNamePressed: {
    color: THEME_COLORS.indigo,
  },
  rowAddress: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    color: THEME_COLORS.inkSoft,
  },
  rowMeta: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  addButton: {
    marginBottom: THEME_SPACING.rowMax,
  },
});

function PropertyRow(props: { property: Property; onPress: () => void }) {
  const { property } = props;
  const meta = propertyMetaLine(property.sizeSqm);
  return (
    <Pressable
      accessibilityLabel={property.name}
      accessibilityRole="button"
      onPress={props.onPress}
      style={styles.row}
      testID={`property-card-${property.id}`}
    >
      {({ pressed }) => (
        <>
          <Text
            style={[styles.rowName, pressed ? styles.rowNamePressed : null]}
          >
            {property.name}
          </Text>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={styles.rowAddress}
          >
            {property.address.toUpperCase()}
          </Text>
          {meta === undefined ? null : (
            <Text style={styles.rowMeta}>{meta}</Text>
          )}
        </>
      )}
    </Pressable>
  );
}

export default function PropertiesScreen() {
  const strings = getStrings();
  const router = useRouter();
  const segments = useSegments();
  const query = sparklTrpc.properties.list.useQuery({
    includeArchived: false,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const renderItem = useCallback(
    ({ item }: { item: Property }) => (
      <PropertyRow
        onPress={() => {
          router.push(stackHref("host", segments, `property/${item.id}`));
        }}
        property={item}
      />
    ),
    [router, segments],
  );

  return (
    <Screen
      scroll={false}
      testID="properties-screen"
      title={strings.properties.title}
    >
      <View style={styles.addButton}>
        <SparklButton
          accessibilityLabel={strings.properties.addProperty}
          onPress={() => {
            router.push(stackHref("host", segments, "property/new"));
          }}
          testID="properties-add"
          title={strings.properties.addProperty}
        />
      </View>
      {query.isPending ? (
        <View style={styles.list} testID="properties-loading">
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      ) : query.isError || query.data === undefined ? (
        <View style={styles.list}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {strings.errors.generic}
          </Text>
          <SparklButton
            accessibilityLabel={strings.errors.retry}
            onPress={() => {
              void query.refetch();
            }}
            testID="properties-retry"
            title={strings.errors.retry}
            variant="secondary"
          />
        </View>
      ) : query.data.length === 0 ? (
        <View style={styles.list} testID="properties-empty">
          <BodyText>{strings.properties.emptyTitle}</BodyText>
          <BodyText soft>{strings.properties.emptyHint}</BodyText>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.flatList}
          testID="properties-list"
        />
      )}
    </Screen>
  );
}
