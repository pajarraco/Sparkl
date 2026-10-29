import type { ChatThread } from "@sparkl/shared";
import { useFocusEffect, useRouter, useSegments } from "expo-router";
import { useCallback } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { sparklTrpc } from "../providers/app-providers";
import type { AppRole } from "../providers/auth";
import { authClient } from "../providers/auth-instance";
import { formatThreadTime, threadPreviewLine } from "../providers/chat-threads";
import { initialsForName } from "../providers/cleaner-profile";
import { getStrings } from "../providers/i18n";
import { stackHref } from "../providers/tabs";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";
import { BodyText } from "./BodyText";
import { Screen } from "./Screen";
import { SparklButton } from "./SparklButton";
import { ThreadRow } from "./ThreadRow";

// Messages tab for both roles (design.md Navigation, 03 B): the caller's
// conversations from chat.listThreads, newest first. A row opens the chat
// inside the Messages tab stack. Refetches whenever the tab gains focus,
// so a message sent from a job's chat shows here on return. Skeleton rows
// while loading, inline error with retry, one quiet line when empty.

export interface ThreadsScreenProps {
  userRole: AppRole;
}

const styles = StyleSheet.create({
  list: {
    gap: THEME_SPACING.rowMax,
  },
  flatList: {
    flex: 1,
  },
  skeleton: {
    height: 76,
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

export function ThreadsScreen(props: ThreadsScreenProps) {
  const strings = getStrings();
  const router = useRouter();
  const segments = useSegments();
  const session = authClient.useSession();
  const viewerId = session.data?.user.id ?? "";
  const query = sparklTrpc.chat.listThreads.useQuery();
  const { refetch } = query;
  const prefix = `${props.userRole}-messages`;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatThread }) => (
      <ThreadRow
        address={item.address}
        initials={initialsForName(item.otherParty.name)}
        name={item.otherParty.name}
        onPress={() => {
          router.push(
            stackHref(props.userRole, segments, `chat/${item.jobId}`),
          );
        }}
        preview={threadPreviewLine(item, viewerId)}
        testID={`${prefix}-thread-${item.jobId}`}
        time={formatThreadTime(item.lastActivityAt, new Date().toISOString())}
      />
    ),
    [router, segments, props.userRole, viewerId, prefix],
  );

  const threads = query.data?.threads;

  return (
    <Screen
      scroll={false}
      testID={`${prefix}-screen`}
      title={strings.messages.title}
    >
      {query.isPending ? (
        <View style={styles.list} testID={`${prefix}-loading`}>
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      ) : query.isError || threads === undefined ? (
        <View style={styles.list}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {strings.errors.generic}
          </Text>
          <SparklButton
            accessibilityLabel={strings.errors.retry}
            onPress={() => {
              void refetch();
            }}
            testID={`${prefix}-retry`}
            title={strings.errors.retry}
            variant="secondary"
          />
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.list}>
          <BodyText>{strings.emptyStates.noMessages}</BodyText>
          <BodyText soft>{strings.emptyStates.messagesHint}</BodyText>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={threads}
          keyExtractor={(item) => item.jobId}
          renderItem={renderItem}
          style={styles.flatList}
          testID={`${prefix}-list`}
        />
      )}
    </Screen>
  );
}
