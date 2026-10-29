import type { GeoPlace } from "@sparkl/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getStrings } from "../providers/i18n";
import {
  type AssistantState,
  draftSummary,
  validateAssistantMessage,
} from "../providers/job-assistant";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";
import { BodyText } from "./BodyText";
import { SparklButton } from "./SparklButton";

// Post-tab assistant chat (02 plan): bubbles reuse the chat-thread look
// (own = indigo, assistant = paper-2), a live draft card, address
// candidates as tappable rows, and the composer. "Review" and "Use the
// form instead" both open the pre-filled form; only the emphasis changes
// when the draft is ready. The transcript is short (capped turns), so it
// renders as plain views inside the screen's ScrollView.

const styles = StyleSheet.create({
  thread: {
    gap: THEME_SPACING.rowMin,
    marginTop: THEME_SPACING.section,
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
  thinking: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
  section: {
    gap: THEME_SPACING.rowMin,
    marginTop: THEME_SPACING.section,
  },
  heading: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.ink,
  },
  place: {
    minHeight: THEME_SPACING.touchTarget,
    justifyContent: "center",
    paddingHorizontal: THEME_SPACING.rowMax,
    paddingVertical: THEME_SPACING.rowMin,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.control,
    backgroundColor: THEME_COLORS.paper,
  },
  placePressed: {
    backgroundColor: THEME_COLORS.paper2,
  },
  placeText: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.ink,
  },
  card: {
    gap: THEME_SPACING.rowMin,
    padding: THEME_SPACING.rowMax,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
    backgroundColor: THEME_COLORS.paper2,
  },
  cardRow: {
    gap: 2,
  },
  cardLabel: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    color: THEME_COLORS.inkSoft,
  },
  cardValue: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.ink,
  },
  error: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
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

function Bubble(props: { own: boolean; text: string; testID: string }) {
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
          {props.text}
        </Text>
      </View>
    </View>
  );
}

export interface AssistantChatProps {
  state: AssistantState;
  pending: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onChoosePlace: (place: GeoPlace) => void;
  onReview: () => void;
  onStartOver: () => void;
}

export function AssistantChat(props: AssistantChatProps) {
  const strings = getStrings();
  const [text, setText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const rows = draftSummary(props.state.draft);
  const started = props.state.messages.length > 0;

  function handleSend(): void {
    if (props.pending) return;
    const error = validateAssistantMessage(text);
    setInputError(error);
    if (error !== null) return;
    props.onSend(text);
    setText("");
  }

  return (
    <View>
      <View style={styles.thread} testID="assistant-thread">
        <Bubble
          own={false}
          testID="assistant-intro"
          text={strings.assistant.intro}
        />
        {props.state.messages.map((message, index) => (
          <Bubble
            // Messages are append-only, so the index is a stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only transcript
            key={index}
            own={message.role === "user"}
            testID={`assistant-message-${index}`}
            text={message.content}
          />
        ))}
        {props.pending ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.thinking}
            testID="assistant-thinking"
          >
            {strings.assistant.thinking}
          </Text>
        ) : null}
        {props.error === null ? null : (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.error}
            testID="assistant-error"
          >
            {props.error}
          </Text>
        )}
      </View>

      {props.state.places.length > 0 && !props.pending ? (
        <View style={styles.section} testID="assistant-places">
          <Text style={styles.heading}>{strings.assistant.placesHeading}</Text>
          {props.state.places.map((place, index) => (
            <Pressable
              accessibilityLabel={`${strings.assistant.usePlace}: ${place.label}`}
              accessibilityRole="button"
              key={place.id}
              onPress={() => props.onChoosePlace(place)}
              style={({ pressed }) => [
                styles.place,
                pressed ? styles.placePressed : null,
              ]}
              testID={`assistant-place-${index}`}
            >
              <Text style={styles.placeText}>{place.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.heading}>{strings.assistant.draftHeading}</Text>
        <View style={styles.card} testID="assistant-draft-card">
          {rows.length === 0 ? (
            <BodyText soft>{strings.assistant.draftEmpty}</BodyText>
          ) : (
            rows.map((row) => (
              <View
                key={row.field}
                style={styles.cardRow}
                testID={`assistant-draft-${row.field}`}
              >
                <Text style={styles.cardLabel}>{row.label}</Text>
                <Text style={styles.cardValue}>{row.value}</Text>
              </View>
            ))
          )}
        </View>
        {props.state.readyForReview ? (
          <BodyText testID="assistant-ready">
            {strings.assistant.readyHint}
          </BodyText>
        ) : null}
      </View>

      <View style={styles.section}>
        <TextInput
          accessibilityLabel={strings.assistant.inputPlaceholder}
          multiline
          onChangeText={(value) => {
            setText(value);
            if (inputError !== null) setInputError(null);
          }}
          placeholder={strings.assistant.inputPlaceholder}
          placeholderTextColor={THEME_COLORS.inkMute}
          style={styles.input}
          testID="assistant-input"
          value={text}
        />
        {inputError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {inputError}
          </Text>
        )}
        <SparklButton
          accessibilityLabel={strings.assistant.send}
          disabled={props.pending}
          loading={props.pending}
          onPress={handleSend}
          testID="assistant-send"
          title={strings.assistant.send}
          // One primary action at a time: Review takes over when ready.
          variant={props.state.readyForReview ? "secondary" : "primary"}
        />
        <SparklButton
          accessibilityLabel={
            props.state.readyForReview
              ? strings.assistant.review
              : strings.assistant.useForm
          }
          onPress={props.onReview}
          testID="assistant-review"
          title={
            props.state.readyForReview
              ? strings.assistant.review
              : strings.assistant.useForm
          }
          variant={props.state.readyForReview ? "primary" : "secondary"}
        />
        {started ? (
          <SparklButton
            accessibilityLabel={strings.assistant.startOver}
            disabled={props.pending}
            onPress={props.onStartOver}
            testID="assistant-start-over"
            title={strings.assistant.startOver}
            variant="destructive"
          />
        ) : null}
      </View>
    </View>
  );
}
