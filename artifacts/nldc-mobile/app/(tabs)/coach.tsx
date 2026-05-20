import { Feather } from "@expo/vector-icons";
import {
  useCoachMessage,
  useCreateMessageCoachingSession,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { ReplyCard } from "@/components/ReplyCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import {
  cancelCoachReminder,
  clearCoachDraft,
  COACH_REMINDER_DELAY_OPTIONS,
  COACH_SNOOZE_CUSTOM_MAX_SECONDS,
  COACH_SNOOZE_CUSTOM_MIN_SECONDS,
  COACH_SNOOZE_LONG_OPTIONS,
  COACH_SNOOZE_SHORT_OPTIONS,
  type CoachReminderPrefs,
  consumePendingCoachFollowUpPrompt,
  DEFAULT_COACH_REMINDER_PREFS,
  ensureCoachNotificationPermission,
  loadCoachDraft,
  loadCoachReminderPrefs,
  recordCoachFollowUp,
  saveCoachDraft,
  saveCoachReminderPrefs,
  scheduleCoachReminder,
} from "@/lib/coachNotifications";
import { useFocusEffect } from "expo-router";

interface Reply {
  style: string;
  text: string;
  rationale: string;
}

const DEMO_REPLIES: Reply[] = [
  {
    style: "Playful",
    text: "Okay but you can't drop 'I just got back from Lisbon' and then not tell me your favorite spot — I'm taking notes.",
    rationale:
      "Picks up the specific detail they shared, signals interest, gives them an easy thing to respond to.",
  },
  {
    style: "Direct",
    text: "I'd actually love to hear more about that over a drink this week — Thursday or Friday work?",
    rationale:
      "You've had 4 exchanges of real rapport. The cost of asking is lower than the cost of letting it fade.",
  },
  {
    style: "Warm",
    text: "I really liked what you said about wanting work to feel meaningful — that landed. What kind of work would feel like that for you?",
    rationale:
      "Mirrors their vulnerability with curiosity, not a one-up. Keeps the conversation going somewhere real.",
  },
];

const STYLE_COLORS: Record<string, "violet" | "gold" | "rose" | "teal"> = {
  playful: "gold",
  warm: "rose",
  direct: "violet",
  bold: "violet",
  curious: "teal",
};

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [matchName, setMatchName] = useState("");
  const [context, setContext] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [results, setResults] = useState<Reply[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reminderPrefs, setReminderPrefs] = useState<CoachReminderPrefs>(
    DEFAULT_COACH_REMINDER_PREFS,
  );

  const createSession = useCreateMessageCoachingSession();
  const coach = useCoachMessage();

  const isPending = createSession.isPending || coach.isPending;
  const hasRequestedPermission = useRef(false);
  const hasRestoredDraft = useRef(false);
  const [followUpPrompt, setFollowUpPrompt] = useState(false);
  const [followUpAck, setFollowUpAck] = useState<null | "sent" | "not_sent">(
    null,
  );

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      consumePendingCoachFollowUpPrompt().then((pending) => {
        if (!cancelled && pending) {
          setFollowUpAck(null);
          setFollowUpPrompt(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleFollowUp(answer: "sent" | "not_sent") {
    setFollowUpPrompt(false);
    setFollowUpAck(answer);
    await recordCoachFollowUp(answer);
    setResults(null);
    setMatchName("");
    setContext("");
    setLastMessage("");
  }

  useEffect(() => {
    if (hasRestoredDraft.current) return;
    hasRestoredDraft.current = true;
    let cancelled = false;
    loadCoachDraft().then((draft) => {
      if (cancelled || !draft) return;
      setMatchName(draft.matchName);
      setContext(draft.context);
      setLastMessage(draft.lastMessage);
      setResults(draft.replies);
    });
    loadCoachReminderPrefs().then((prefs) => {
      if (cancelled) return;
      setReminderPrefs(prefs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateReminderPrefs(next: CoachReminderPrefs) {
    setReminderPrefs(next);
    await saveCoachReminderPrefs(next);
    if (!next.enabled) {
      await cancelCoachReminder();
    }
  }

  async function onToggleReminder(value: boolean) {
    await updateReminderPrefs({ ...reminderPrefs, enabled: value });
  }

  async function onPickDelay(seconds: number) {
    await updateReminderPrefs({ ...reminderPrefs, delaySeconds: seconds });
  }

  async function onPickSnoozeShort(seconds: number) {
    await updateReminderPrefs({
      ...reminderPrefs,
      snoozeShortSeconds: seconds,
    });
  }

  async function onPickSnoozeLong(seconds: number) {
    await updateReminderPrefs({
      ...reminderPrefs,
      snoozeLongSeconds: seconds,
    });
  }

  async function handleReplyCopied() {
    await cancelCoachReminder();
    await clearCoachDraft();
  }

  const accentFor = (style: string) => {
    const key = style.toLowerCase();
    const tint =
      STYLE_COLORS[key] ??
      (Object.keys(STYLE_COLORS).find((k) => key.includes(k)) as
        | keyof typeof STYLE_COLORS
        | undefined);
    return tint ? colors[tint] : colors.violet;
  };

  async function onSubmit() {
    setErrorMsg(null);
    if (!context.trim() || !lastMessage.trim()) {
      setErrorMsg("Paste both the conversation context and the last message you got.");
      return;
    }
    try {
      const session = await createSession.mutateAsync({
        data: {
          matchName: matchName.trim() || "Match",
          conversationContext: context.trim(),
          yourLastMessage: lastMessage.trim(),
          goal: "Keep the conversation alive",
        },
      });
      const coached = await coach.mutateAsync({ id: session.id });
      setResults(coached.suggestedReplies);

      if (!hasRequestedPermission.current) {
        hasRequestedPermission.current = true;
        await ensureCoachNotificationPermission();
      }
      await saveCoachDraft({
        matchName,
        context,
        lastMessage,
        replies: coached.suggestedReplies,
        savedAt: Date.now(),
      });
      await scheduleCoachReminder({ matchName });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setErrorMsg(message);
    }
  }

  const display = useMemo(() => results ?? DEMO_REPLIES, [results]);
  const showingDemo = results === null;

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
      >
        <ScreenHeader
          eyebrow="Message Coach"
          title="Reply that lands"
          subtitle="Paste what you've got. Get three replies in different tones — copy the one that sounds like you."
        />

        {followUpPrompt ? (
          <View
            style={[
              styles.followUpCard,
              { backgroundColor: colors.card, borderColor: colors.violet },
            ]}
          >
            <Text style={[styles.followUpTitle, { color: colors.foreground }]}>
              Quick check — did you send that reply?
            </Text>
            <Text
              style={[styles.followUpBody, { color: colors.mutedForeground }]}
            >
              Tap to let us know. We use this to track which coached replies
              actually make it out the door.
            </Text>
            <View style={styles.followUpRow}>
              <Pressable
                onPress={() => handleFollowUp("sent")}
                style={[
                  styles.followUpBtn,
                  {
                    backgroundColor: colors.violet,
                    borderColor: colors.violet,
                  },
                ]}
              >
                <Text style={[styles.followUpBtnText, { color: "#0B0F1D" }]}>
                  Sent it ✅
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleFollowUp("not_sent")}
                style={[
                  styles.followUpBtn,
                  {
                    backgroundColor: "transparent",
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.followUpBtnText, { color: colors.foreground }]}
                >
                  Still thinking 💭
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {followUpAck ? (
          <View
            style={[
              styles.followUpAck,
              { backgroundColor: `${colors.violet}1A`, borderColor: colors.violet },
            ]}
          >
            <Feather
              name={followUpAck === "sent" ? "check-circle" : "clock"}
              size={14}
              color={colors.violet}
            />
            <Text
              style={[styles.followUpAckText, { color: colors.foreground }]}
            >
              {followUpAck === "sent"
                ? "Logged — nice work. We'll factor this into your send-through rate."
                : "No pressure. We'll remember this and won't nag again on this draft."}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Field label="Their name (optional)">
            <TextInput
              value={matchName}
              onChangeText={setMatchName}
              placeholder="e.g. Maya"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>

          <Field label="The conversation so far">
            <TextInput
              value={context}
              onChangeText={setContext}
              placeholder="Paste the last few messages — what was said, who said what."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                styles.multiline,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>

          <Field label="Their last message to you">
            <TextInput
              value={lastMessage}
              onChangeText={setLastMessage}
              placeholder="The thing you're trying to respond to."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                styles.multilineShort,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>

          {errorMsg ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: `${colors.destructive}22`, borderColor: colors.destructive },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={isPending ? "Coaching…" : "Get coached replies"}
            onPress={onSubmit}
            loading={isPending}
            icon="zap"
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.settingsHeader}>
            <View style={styles.settingsHeaderText}>
              <Text style={[styles.settingsTitle, { color: colors.foreground }]}>
                Unsent-reply nudge
              </Text>
              <Text
                style={[
                  styles.settingsSubtitle,
                  { color: colors.mutedForeground },
                ]}
              >
                {reminderPrefs.enabled
                  ? "We'll check back in if you haven't sent a reply yet."
                  : "Off — we won't remind you about drafted replies."}
              </Text>
            </View>
            <Switch
              value={reminderPrefs.enabled}
              onValueChange={onToggleReminder}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? colors.background : undefined}
            />
          </View>

          <View style={styles.pickerBlock}>
            <Text
              style={[
                styles.pickerLabel,
                { color: colors.mutedForeground },
              ]}
            >
              First nudge after
            </Text>
            <View style={styles.delayRow}>
              {COACH_REMINDER_DELAY_OPTIONS.map((opt) => {
                const selected = reminderPrefs.delaySeconds === opt.seconds;
                const disabled = !reminderPrefs.enabled;
                return (
                  <Pressable
                    key={opt.seconds}
                    onPress={() => onPickDelay(opt.seconds)}
                    disabled={disabled}
                    style={[
                      styles.delayChip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? `${colors.primary}22`
                          : colors.input,
                        opacity: disabled ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.delayChipText,
                        {
                          color: selected ? colors.primary : colors.foreground,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <SnoozeDurationPicker
            label="Short snooze"
            options={COACH_SNOOZE_SHORT_OPTIONS}
            value={reminderPrefs.snoozeShortSeconds}
            onChange={onPickSnoozeShort}
            disabled={!reminderPrefs.enabled}
          />
          <SnoozeDurationPicker
            label="Long snooze"
            options={COACH_SNOOZE_LONG_OPTIONS}
            value={reminderPrefs.snoozeLongSeconds}
            onChange={onPickSnoozeLong}
            disabled={!reminderPrefs.enabled}
          />
        </View>

        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
            {showingDemo ? "Sample replies" : "Your replies"}
          </Text>
          {showingDemo ? (
            <View
              style={[
                styles.demoChip,
                { backgroundColor: `${colors.gold}22`, borderColor: colors.gold },
              ]}
            >
              <Text style={[styles.demoChipText, { color: colors.gold }]}>Demo</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.repliesList}>
          {display.map((r, i) => (
            <ReplyCard
              key={`reply-${i}`}
              style={r.style}
              text={r.text}
              rationale={r.rationale}
              accent={accentFor(r.style)}
              onCopy={showingDemo ? undefined : handleReplyCopied}
            />
          ))}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

function SnoozeDurationPicker({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: Array<{ label: string; seconds: number }>;
  value: number;
  onChange: (seconds: number) => void;
  disabled: boolean;
}) {
  const colors = useColors();
  const isPreset = options.some((o) => o.seconds === value);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const [customText, setCustomText] = useState(
    !isPreset ? String(Math.max(1, Math.round(value / 60))) : "",
  );

  useEffect(() => {
    if (isPreset) {
      setCustomOpen(false);
      setCustomText("");
    } else {
      setCustomOpen(true);
      setCustomText((prev) =>
        prev ? prev : String(Math.max(1, Math.round(value / 60))),
      );
    }
  }, [value, isPreset]);

  function commitCustom(text: string) {
    const minutes = parseInt(text, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    let seconds = minutes * 60;
    if (seconds < COACH_SNOOZE_CUSTOM_MIN_SECONDS)
      seconds = COACH_SNOOZE_CUSTOM_MIN_SECONDS;
    if (seconds > COACH_SNOOZE_CUSTOM_MAX_SECONDS)
      seconds = COACH_SNOOZE_CUSTOM_MAX_SECONDS;
    if (seconds === value) return;
    onChange(seconds);
  }

  const customSelected = customOpen && !isPreset;

  return (
    <View style={styles.pickerBlock}>
      <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.delayRow}>
        {options.map((opt) => {
          const selected = !customOpen && value === opt.seconds;
          return (
            <Pressable
              key={opt.seconds}
              onPress={() => {
                setCustomOpen(false);
                setCustomText("");
                onChange(opt.seconds);
              }}
              disabled={disabled}
              style={[
                styles.delayChip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? `${colors.primary}22`
                    : colors.input,
                  opacity: disabled ? 0.45 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.delayChipText,
                  { color: selected ? colors.primary : colors.foreground },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            if (!customOpen) {
              setCustomOpen(true);
              if (!customText) {
                setCustomText(String(Math.max(1, Math.round(value / 60))));
              }
            }
          }}
          disabled={disabled}
          style={[
            styles.delayChip,
            {
              borderColor: customSelected ? colors.primary : colors.border,
              backgroundColor: customSelected
                ? `${colors.primary}22`
                : colors.input,
              opacity: disabled ? 0.45 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.delayChipText,
              { color: customSelected ? colors.primary : colors.foreground },
            ]}
          >
            Custom
          </Text>
        </Pressable>
      </View>
      {customOpen ? (
        <View style={styles.customRow}>
          <TextInput
            value={customText}
            onChangeText={setCustomText}
            onEndEditing={(e) => commitCustom(e.nativeEvent.text)}
            onBlur={() => commitCustom(customText)}
            keyboardType="number-pad"
            editable={!disabled}
            placeholder="e.g. 45"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.customInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.input,
                color: colors.foreground,
                opacity: disabled ? 0.45 : 1,
              },
            ]}
          />
          <Text
            style={[styles.customSuffix, { color: colors.mutedForeground }]}
          >
            minutes (5–1440)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
    minHeight: 46,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  multilineShort: { minHeight: 80, textAlignVertical: "top" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  resultsTitle: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  demoChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  demoChipText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  repliesList: { gap: 12 },
  followUpCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  followUpTitle: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  followUpBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
  },
  followUpRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  followUpBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  followUpBtnText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  followUpAck: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  followUpAckText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 18,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsHeaderText: { flex: 1, gap: 2 },
  settingsTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  settingsSubtitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  delayRow: {
    flexDirection: "row",
    gap: 8,
  },
  delayChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  delayChipText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  pickerBlock: { gap: 8 },
  pickerLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  customSuffix: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
