import type { Message } from "@sparkl/shared";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { BodyText } from "../../../components/BodyText";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import { sparklTrpc } from "../../../providers/app-providers";
import { authClient } from "../../../providers/auth-instance";
import {
  formatChatTime,
  isOwnMessage,
  mergeChatMessages,
  validateChatDraft,
} from "../../../providers/chat-thread";
import { getStrings } from "../../../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../providers/theme";

// Cleaner chat thread (design.md Screen Inventory): per-job history from
// chat.list, sending through chat.send, live messages over the
// chat.onMessage SSE subscription (httpSubscriptionLink on the same
// origin — no ws:// URL, see providers/trpc-client.ts). The
// subscription input stays fixed per job: the transport resumes SSE
// itself via tracked ids, and any gap is covered by refetching history
// on subscription error (architecture.md Realtime Chat). History and
// live overlap, so rows render from mergeChatMessages (dedupe by id,
// oldest first). Own bubbles are indigo (white-on-indigo is AAA);
// others are paper-2 with ink text. No entrance animation: press states
// are instant colour shifts and motion stays non-essential.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const styles = StyleSheet.create({
  list: {
    gap: THEME_SPACING.rowMin,
  },
  flatList: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  rowOwn: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: THEME_RADII.cardMax,
    paddingHorizontal: THEME_SPACING.rowMax,
    paddingVertical: THEME_SPACING.rowMin,
    gap: 2,
  },
  bubbleOwn: {
    backgroundColor: THEME_COLORS.indigo,
  },
  bubbleOther: {
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
  },
  bubbleText: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: THEME_COLORS.paper,
  },
  bubbleTextOther: {
    color: THEME_COLORS.ink,
  },
  time: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    color: THEME_COLORS.inkMute,
  },
  timeOwn: {
    color: THEME_COLORS.paper,
    opacity: 0.8,
  },
  skeleton: {
    height: 64,
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
  composer: {
    gap: THEME_SPACING.rowMin,
    marginTop: THEME_SPACING.section,
  },
  input: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.ink,
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.control,
    minHeight: THEME_SPACING.touchTarget,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

function MessageBubble(props: {
  message: Message;
  own: boolean;
  testID: string;
}) {
  return (
    <View style={[styles.row, props.own ? styles.rowOwn : null]}>
      <View
        style={[
          styles.bubble,
          props.own ? styles.bubbleOwn : styles.bubbleOther,
        ]}
        testID={props.testID}
      >
        <Text
          style={[
            styles.bubbleText,
            props.own ? styles.bubbleTextOwn : styles.bubbleTextOther,
          ]}
        >
          {props.message.body}
        </Text>
        <Text style={[styles.time, props.own ? styles.timeOwn : null]}>
          {formatChatTime(props.message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function CleanerChatThreadScreen() {
  const strings = getStrings();
  const params = useLocalSearchParams<{ jobId: string }>();
  const rawId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const jobId = rawId !== undefined && UUID_RE.test(rawId) ? rawId : null;

  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id ?? null;

  const historyQuery = sparklTrpc.chat.list.useQuery(
    { jobId: jobId ?? "" },
    { enabled: jobId !== null },
  );
  const sendMessage = sparklTrpc.chat.send.useMutation();
  const listRef = useRef<FlatList<Message> | null>(null);

  const [live, setLive] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );

  const subscriptionInput = useMemo(
    () => ({ jobId: jobId ?? "", lastEventId: null }),
    [jobId],
  );

  sparklTrpc.chat.onMessage.useSubscription(subscriptionInput, {
    enabled: jobId !== null,
    onData: (message) => {
      setLive((prev) => mergeChatMessages(prev, [message]));
    },
    onError: () => {
      setSubscriptionError(strings.errors.generic);
      void historyQuery.refetch();
    },
  });

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        own={isOwnMessage(item, currentUserId)}
        testID={`chat-message-${item.id}`}
      />
    ),
    [currentUserId],
  );

  async function handleSend(): Promise<void> {
    const error = validateChatDraft(draft);
    setDraftError(error);
    if (error !== null || jobId === null) return;
    setSendError(null);
    try {
      const sent = await sendMessage.mutateAsync({ jobId, body: draft });
      setLive((prev) => mergeChatMessages(prev, [sent]));
      setDraft("");
    } catch {
      setSendError(strings.errors.generic);
    }
  }

  if (jobId === null) {
    return (
      <Screen testID="cleaner-chat-thread-screen" title={strings.chat.title}>
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {strings.errors.generic}
        </Text>
      </Screen>
    );
  }

  const messages = mergeChatMessages(historyQuery.data?.messages ?? [], live);

  return (
    <Screen
      scroll={false}
      testID="cleaner-chat-thread-screen"
      title={strings.chat.title}
    >
      {historyQuery.isPending ? (
        <View style={styles.list} testID="chat-loading">
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      ) : historyQuery.isError ? (
        <View style={styles.list}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {strings.errors.generic}
          </Text>
          <SparklButton
            accessibilityLabel={strings.errors.retry}
            onPress={() => {
              void historyQuery.refetch();
            }}
            testID="chat-retry"
            title={strings.errors.retry}
            variant="secondary"
          />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.list}>
          <BodyText>{strings.emptyStates.noMessages}</BodyText>
          <BodyText soft>{strings.chat.confirmedHint}</BodyText>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: false });
          }}
          ref={listRef}
          renderItem={renderItem}
          style={styles.flatList}
          testID="chat-list"
        />
      )}
      {subscriptionError === null ? null : (
        <View style={styles.list}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {subscriptionError}
          </Text>
          <SparklButton
            accessibilityLabel={strings.errors.retry}
            onPress={() => {
              setSubscriptionError(null);
              void historyQuery.refetch();
            }}
            testID="chat-subscription-retry"
            title={strings.errors.retry}
            variant="secondary"
          />
        </View>
      )}
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={strings.chat.inputPlaceholder}
          multiline
          onChangeText={(value) => {
            setDraft(value);
            if (draftError !== null) setDraftError(null);
          }}
          placeholder={strings.chat.inputPlaceholder}
          placeholderTextColor={THEME_COLORS.inkMute}
          style={styles.input}
          testID="chat-input"
          value={draft}
        />
        {draftError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {draftError}
          </Text>
        )}
        {sendError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {sendError}
          </Text>
        )}
        <SparklButton
          accessibilityLabel={strings.chat.send}
          loading={sendMessage.isPending}
          onPress={() => {
            void handleSend();
          }}
          testID="chat-send"
          title={strings.chat.send}
        />
      </View>
    </Screen>
  );
}
