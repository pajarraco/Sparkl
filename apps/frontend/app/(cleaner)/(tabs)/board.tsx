import type { ListOpenJobsInput, RankedJob } from "@sparkl/shared";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { BodyText } from "../../../components/BodyText";
import { JobCard } from "../../../components/JobCard";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import { SparklTextField } from "../../../components/SparklTextField";
import { sparklTrpc } from "../../../providers/app-providers";
import { getStrings } from "../../../providers/i18n";
import { statusLabelFor } from "../../../providers/my-jobs";
import {
  type BoardFilterErrors,
  type BoardServiceCenter,
  boardMetaLine,
  validateBoardFilters,
} from "../../../providers/ranked-board";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../providers/theme";

// Cleaner Board (design.md Screen Inventory): ranked open jobs over one
// jobs.listRanked query, filters for date / minimum price / distance.
// Rows are memoized JobCards with stable keyExtractor pushing to the
// cleaner Job Detail route. Loading shows card-shaped skeletons, never
// a full-screen spinner; errors stay inline with a retry. Every
// interactive element is labelled.

const styles = StyleSheet.create({
  filters: {
    gap: THEME_SPACING.rowMin,
    marginBottom: THEME_SPACING.section,
  },
  filterActions: {
    flexDirection: "row",
    gap: THEME_SPACING.rowMin,
  },
  filterAction: {
    flex: 1,
  },
  list: {
    gap: THEME_SPACING.rowMax,
  },
  flatList: {
    flex: 1,
    minHeight: 240,
  },
  skeleton: {
    height: 132,
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
});

export default function CleanerBoardScreen() {
  const strings = getStrings();
  const router = useRouter();
  const [date, setDate] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<BoardFilterErrors>({});
  const [applied, setApplied] = useState<ListOpenJobsInput>(() => ({
    limit: 20,
    offset: 0,
  }));

  const profileQuery = sparklTrpc.users.getProfile.useQuery();
  const serviceLat = profileQuery.data?.serviceLat;
  const serviceLng = profileQuery.data?.serviceLng;
  const center: BoardServiceCenter | undefined =
    serviceLat === null ||
    serviceLat === undefined ||
    serviceLng === null ||
    serviceLng === undefined
      ? undefined
      : { latitude: serviceLat, longitude: serviceLng };

  const boardQuery = sparklTrpc.jobs.listRanked.useQuery(applied);

  function handleApply(): void {
    const result = validateBoardFilters(
      { date, minPrice, maxDistanceKm },
      center,
    );
    setFieldErrors(result.errors);
    if (result.data !== null) setApplied(result.data);
  }

  function handleClear(): void {
    setDate("");
    setMinPrice("");
    setMaxDistanceKm("");
    setFieldErrors({});
    setApplied({ limit: 20, offset: 0 });
  }

  const renderItem = useCallback(
    ({ item }: { item: RankedJob }) => (
      <JobCard
        address={item.job.address}
        metaLine={boardMetaLine(item.job, item.score)}
        onPress={() => {
          router.navigate(`/(cleaner)/job/${item.job.id}`);
        }}
        status={item.job.status}
        statusLabel={statusLabelFor(item.job.status)}
        testID={`cleaner-board-card-${item.job.id}`}
        title={strings.jobCard.title}
      />
    ),
    [strings, router],
  );

  const jobs = boardQuery.data?.jobs;

  return (
    <Screen
      scroll={false}
      subtitle={strings.board.subtitle}
      testID="cleaner-board-screen"
      title={strings.board.title}
    >
      <View style={styles.filters}>
        <SparklTextField
          accessibilityLabel={strings.filters.dateLabel}
          autoCapitalize="none"
          error={fieldErrors.date}
          label={strings.filters.dateLabel}
          onChangeText={setDate}
          placeholder={strings.postJob.datePlaceholder}
          testID="cleaner-board-date"
          value={date}
        />
        <SparklTextField
          accessibilityLabel={strings.filters.priceLabel}
          autoCapitalize="none"
          error={fieldErrors.minPrice}
          keyboardType="decimal-pad"
          label={strings.filters.priceLabel}
          onChangeText={setMinPrice}
          testID="cleaner-board-min-price"
          value={minPrice}
        />
        <SparklTextField
          accessibilityLabel={strings.filters.distanceLabel}
          autoCapitalize="none"
          error={fieldErrors.maxDistanceKm}
          keyboardType="decimal-pad"
          label={strings.filters.distanceLabel}
          onChangeText={setMaxDistanceKm}
          testID="cleaner-board-max-distance"
          value={maxDistanceKm}
        />
        <View style={styles.filterActions}>
          <View style={styles.filterAction}>
            <SparklButton
              accessibilityLabel={strings.filters.apply}
              onPress={handleApply}
              testID="cleaner-board-apply"
              title={strings.filters.apply}
              variant="primary"
            />
          </View>
          <View style={styles.filterAction}>
            <SparklButton
              accessibilityLabel={strings.filters.clear}
              onPress={handleClear}
              testID="cleaner-board-clear"
              title={strings.filters.clear}
              variant="secondary"
            />
          </View>
        </View>
      </View>
      {boardQuery.isPending ? (
        <View style={styles.list} testID="cleaner-board-loading">
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      ) : boardQuery.isError || jobs === undefined ? (
        <View style={styles.list}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {strings.errors.generic}
          </Text>
          <SparklButton
            accessibilityLabel={strings.errors.retry}
            onPress={() => {
              void boardQuery.refetch();
            }}
            testID="cleaner-board-retry"
            title={strings.errors.retry}
            variant="secondary"
          />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.list}>
          <BodyText>{strings.emptyStates.noOpenJobs}</BodyText>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={jobs}
          style={styles.flatList}
          keyExtractor={(item) => item.job.id}
          renderItem={renderItem}
          testID="cleaner-board-list"
        />
      )}
    </Screen>
  );
}
