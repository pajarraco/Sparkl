import type { ListOpenJobsInput, RankedJob } from "@sparkl/shared";
import { useRouter, useSegments } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { BodyText } from "../../../../components/BodyText";
import { BottomSheet } from "../../../../components/BottomSheet";
import {
  FilterChip,
  type FilterChipIcon,
} from "../../../../components/FilterChip";
import { JobCard } from "../../../../components/JobCard";
import { Screen } from "../../../../components/Screen";
import { SparklButton } from "../../../../components/SparklButton";
import { SparklTextField } from "../../../../components/SparklTextField";
import { sparklTrpc } from "../../../../providers/app-providers";
import { getStrings } from "../../../../providers/i18n";
import { statusLabelFor } from "../../../../providers/my-jobs";
import {
  type BoardFilterField,
  type BoardFilterValues,
  type BoardServiceCenter,
  EMPTY_BOARD_FILTERS,
  anyBoardFilterActive,
  boardFilterChipLabel,
  boardMetaLine,
  isBoardFilterActive,
  validateBoardFilters,
  withBoardFilter,
} from "../../../../providers/ranked-board";
import { stackHref } from "../../../../providers/tabs";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../../providers/theme";

// Cleaner Board (design.md Screen Inventory): ranked open jobs over one
// jobs.listRanked query, filters for date / minimum price / distance as a
// row of chips; each chip opens a bottom sheet with its one field (03 C).
// Rows are memoized JobCards with stable keyExtractor pushing to the
// cleaner Job Detail route. Loading shows card-shaped skeletons, never
// a full-screen spinner; errors stay inline with a retry. Every
// interactive element is labelled.

const styles = StyleSheet.create({
  // Wraps instead of scrolling sideways, so "Clear all" is never hidden
  // off-screen on a phone.
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME_SPACING.rowMin,
    marginBottom: THEME_SPACING.rowMax,
  },
  sheetActions: {
    flexDirection: "row",
    gap: THEME_SPACING.rowMin,
  },
  sheetAction: {
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

const FILTER_CHIPS: {
  field: BoardFilterField;
  icon: FilterChipIcon;
  testID: string;
  name: () => string;
}[] = [
  {
    field: "date",
    icon: "calendar",
    testID: "date",
    name: () => getStrings().filters.dateLabel,
  },
  {
    field: "maxDistanceKm",
    icon: "navigation",
    testID: "distance",
    name: () => getStrings().filters.distanceLabel,
  },
  {
    field: "minPrice",
    icon: "dollar-sign",
    testID: "price",
    name: () => getStrings().filters.price,
  },
];

// The sheet's one field per filter; testIDs match the old inline fields so
// the e2e suites keep their selectors.
const FILTER_FIELDS: Record<
  BoardFilterField,
  {
    label: () => string;
    placeholder: () => string | undefined;
    keyboard: "default" | "decimal-pad";
    testID: string;
  }
> = {
  date: {
    label: () => getStrings().filters.dateLabel,
    placeholder: () => getStrings().postJob.datePlaceholder,
    keyboard: "default",
    testID: "cleaner-board-date",
  },
  maxDistanceKm: {
    label: () => getStrings().filters.distanceLabel,
    placeholder: () => undefined,
    keyboard: "decimal-pad",
    testID: "cleaner-board-max-distance",
  },
  minPrice: {
    label: () => getStrings().filters.priceLabel,
    placeholder: () => undefined,
    keyboard: "decimal-pad",
    testID: "cleaner-board-min-price",
  },
};

export default function CleanerBoardScreen() {
  const strings = getStrings();
  const router = useRouter();
  const segments = useSegments();
  // Applied raw values (what the chips show), the field whose sheet is
  // open, and that sheet's draft text.
  const [values, setValues] = useState<BoardFilterValues>(EMPTY_BOARD_FILTERS);
  const [editing, setEditing] = useState<BoardFilterField | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | undefined>(undefined);
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

  function openSheet(field: BoardFilterField): void {
    setEditing(field);
    setDraft(values[field]);
    setDraftError(undefined);
  }

  function closeSheet(): void {
    setEditing(null);
    setDraftError(undefined);
  }

  // The edited field plus the other applied values go back through
  // validateBoardFilters, so the board filters exactly as before.
  function applyValues(next: BoardFilterValues): boolean {
    const result = validateBoardFilters(next, center);
    if (result.data === null) {
      setDraftError(editing === null ? undefined : result.errors[editing]);
      return false;
    }
    setValues(next);
    setApplied(result.data);
    return true;
  }

  function handleApply(): void {
    if (editing === null) return;
    if (applyValues(withBoardFilter(values, editing, draft))) closeSheet();
  }

  function handleClearOne(): void {
    if (editing === null) return;
    if (applyValues(withBoardFilter(values, editing, ""))) closeSheet();
  }

  function handleClearAll(): void {
    setValues(EMPTY_BOARD_FILTERS);
    setApplied({ limit: 20, offset: 0 });
  }

  const renderItem = useCallback(
    ({ item }: { item: RankedJob }) => (
      <JobCard
        address={item.job.address}
        metaLine={boardMetaLine(item.job, item.score)}
        onPress={() => {
          // push (not navigate): the detail is a stack screen, and push
          // unconditionally pushes it. navigate stayed on /board in E2E.
          router.push(stackHref("cleaner", segments, `job/${item.job.id}`));
        }}
        status={item.job.status}
        statusLabel={statusLabelFor(item.job.status)}
        testID={`cleaner-board-card-${item.job.id}`}
        title={strings.jobCard.title}
      />
    ),
    [strings, router, segments],
  );

  const jobs = boardQuery.data?.jobs;

  return (
    <Screen
      scroll={false}
      subtitle={strings.board.subtitle}
      testID="cleaner-board-screen"
      title={strings.board.title}
    >
      <View style={styles.chips}>
        {FILTER_CHIPS.map((chip) => {
          const label = boardFilterChipLabel(chip.field, values);
          return (
            <FilterChip
              key={chip.field}
              accessibilityLabel={`${chip.name()}: ${label}`}
              active={isBoardFilterActive(values, chip.field)}
              icon={chip.icon}
              label={label}
              onPress={() => openSheet(chip.field)}
              testID={`cleaner-board-chip-${chip.testID}`}
            />
          );
        })}
        {anyBoardFilterActive(values) ? (
          <FilterChip
            accessibilityLabel={strings.filters.clear}
            active={false}
            label={strings.filters.clear}
            onPress={handleClearAll}
            testID="cleaner-board-clear"
          />
        ) : null}
      </View>
      <BottomSheet
        closeLabel={strings.filters.close}
        onClose={closeSheet}
        testID="cleaner-board-sheet"
        title={
          FILTER_CHIPS.find((chip) => chip.field === editing)?.name() ??
          strings.filters.title
        }
        visible={editing !== null}
      >
        {editing === "maxDistanceKm" && center === undefined ? (
          <BodyText soft>{strings.filters.noLocation}</BodyText>
        ) : editing === null ? null : (
          <SparklTextField
            accessibilityLabel={FILTER_FIELDS[editing].label()}
            autoCapitalize="none"
            error={draftError}
            keyboardType={FILTER_FIELDS[editing].keyboard}
            label={FILTER_FIELDS[editing].label()}
            onChangeText={setDraft}
            placeholder={FILTER_FIELDS[editing].placeholder()}
            testID={FILTER_FIELDS[editing].testID}
            value={draft}
          />
        )}
        <View style={styles.sheetActions}>
          <View style={styles.sheetAction}>
            <SparklButton
              accessibilityLabel={strings.filters.clearOne}
              onPress={handleClearOne}
              testID="cleaner-board-sheet-clear"
              title={strings.filters.clearOne}
              variant="secondary"
            />
          </View>
          <View style={styles.sheetAction}>
            <SparklButton
              accessibilityLabel={strings.filters.apply}
              onPress={handleApply}
              testID="cleaner-board-apply"
              title={strings.filters.apply}
              variant="primary"
            />
          </View>
        </View>
      </BottomSheet>
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
