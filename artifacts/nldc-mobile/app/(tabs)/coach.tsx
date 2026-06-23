import { Feather } from "@expo/vector-icons";
import {
  getGetCoachFollowUpStatsQueryKey,
  getGetCoachFollowUpTimelineQueryKey,
  useCoachMessage,
  useCreateMessageCoachingSession,
  useExtractMessageScreenshot,
  useGetCoachFollowUpStats,
  useGetCoachFollowUpTimeline,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
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
import { ShareButton } from "@/components/echo/ShareButton";
import { useColors } from "@/hooks/useColors";
import { rememberAnonymousId } from "@/lib/anonymousIds";
import { useAuth } from "@/lib/auth";
import {
  buildCoachSnoozeLongOptions,
  buildCoachSnoozeShortOptions,
  cancelCoachReminder,
  clearCoachDraft,
  COACH_REMINDER_DELAY_OPTIONS,
  COACH_SNOOZE_CUSTOM_MAX_SECONDS,
  COACH_SNOOZE_CUSTOM_MIN_SECONDS,
  COACH_TOMORROW_MORNING_HOUR_MAX,
  COACH_TOMORROW_MORNING_HOUR_MIN,
  COACH_TONIGHT_HOUR_MAX,
  COACH_TONIGHT_HOUR_MIN,
  type CoachReminderPrefs,
  consumePendingCoachFollowUpPrompt,
  DEFAULT_COACH_REMINDER_PREFS,
  ensureCoachNotificationPermission,
  formatHourLabel,
  loadCoachDraft,
  loadCoachReminderPrefs,
  recordCoachFollowUp,
  saveCoachDraft,
  saveCoachReminderPrefs,
  scheduleCoachReminder,
  type SnoozeMode,
  type SnoozeOption,
  snoozeModesEqual,
  snoozeOptionToMode,
} from "@/lib/coachNotifications";
import { useFocusEffect } from "expo-router";

interface Reply {
  style: string;
  text: string;
  rationale: string;
}

interface TaggedLine {
  sender: "me" | "them" | null;
  content: string;
}

function parseTaggedLines(text: string): TaggedLine[] {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (/^me:\s*/i.test(trimmed)) {
        return { sender: "me" as const, content: trimmed.replace(/^me:\s*/i, "") };
      }
      if (/^them:\s*/i.test(trimmed)) {
        return { sender: "them" as const, content: trimmed.replace(/^them:\s*/i, "") };
      }
      return { sender: null, content: trimmed };
    })
    .filter((l) => l.content.length > 0);
}

function serializeTaggedLines(lines: TaggedLine[]): string {
  return lines
    .map((l) => {
      if (l.sender === "me") return `Me: ${l.content}`;
      if (l.sender === "them") return `Them: ${l.content}`;
      return l.content;
    })
    .join("\n");
}

const SOURCE_APPS = ["Hinge", "Bumble", "Tinder"] as const;
type SourceApp = (typeof SOURCE_APPS)[number];

function normalizeAppName(value: string | null | undefined): SourceApp | "" {
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower.includes("hinge")) return "Hinge";
  if (lower.includes("bumble")) return "Bumble";
  if (lower.includes("tinder")) return "Tinder";
  return "";
}

type SpeakerTurn = { speaker: "them" | "you"; text: string };

function speakerTurnsToContext(turns: SpeakerTurn[], name: string): string {
  const theirLabel = name.trim() || "Them";
  return turns
    .map((t) => `${t.speaker === "them" ? theirLabel : "Me"}: ${t.text}`)
    .join("\n");
}

function flipSpeakers(turns: SpeakerTurn[]): SpeakerTurn[] {
  return turns.map((t) => ({
    ...t,
    speaker: t.speaker === "them" ? "you" : "them",
  }));
}

const DEMO_REPLIES: Reply[] = [
  {
    style: "Playful",
    text: "Okay but you can't drop 'I just got back from Lisbon' and then not tell me your favorite spot, I'm taking notes.",
    rationale:
      "Picks up the specific detail they shared, signals interest, gives them an easy thing to respond to.",
  },
  {
    style: "Direct",
    text: "I'd actually love to hear more about that over a drink this week, Thursday or Friday work?",
    rationale:
      "You've had 4 exchanges of real rapport. The cost of asking is lower than the cost of letting it fade.",
  },
  {
    style: "Warm",
    text: "I really liked what you said about wanting work to feel meaningful, that landed. What kind of work would feel like that for you?",
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
  const [sourceApp, setSourceApp] = useState<SourceApp | "">("");
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [screenshotTurns, setScreenshotTurns] = useState<SpeakerTurn[] | null>(null);
  const [results, setResults] = useState<Reply[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLineTagger, setShowLineTagger] = useState(false);
  const [reminderPrefs, setReminderPrefs] = useState<CoachReminderPrefs>(
    DEFAULT_COACH_REMINDER_PREFS,
  );

  const createSession = useCreateMessageCoachingSession();
  const coach = useCoachMessage();
  const extractScreenshot = useExtractMessageScreenshot();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const followUpStatsQueryKey = useMemo(
    () => getGetCoachFollowUpStatsQueryKey(),
    [],
  );
  const followUpTimelineQueryKey = useMemo(
    () => getGetCoachFollowUpTimelineQueryKey(),
    [],
  );
  const { data: followUpStats } = useGetCoachFollowUpStats({
    query: { queryKey: followUpStatsQueryKey, enabled: isAuthenticated },
  });
  const { data: followUpTimeline } = useGetCoachFollowUpTimeline({
    query: { queryKey: followUpTimelineQueryKey, enabled: isAuthenticated },
  });

  const isPending = createSession.isPending || coach.isPending;
  const hasRequestedPermission = useRef(false);
  const hasRestoredDraft = useRef(false);
  const [followUpPrompt, setFollowUpPrompt] = useState(false);
  const [followUpAck, setFollowUpAck] = useState<null | "sent" | "not_sent">(
    null,
  );
  const [timelineActiveSeries, setTimelineActiveSeries] = useState<Set<string>>(
    () => new Set(["sent", "not_sent", "snoozed", "dismissed"]),
  );
  const [selectedTimelineWeek, setSelectedTimelineWeek] = useState<
    string | null
  >(null);

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
    queryClient.invalidateQueries({ queryKey: followUpStatsQueryKey });
    queryClient.invalidateQueries({ queryKey: followUpTimelineQueryKey });
    setResults(null);
    setMatchName("");
    setContext("");
    setLastMessage("");
    setSourceApp("");
    setScreenshotUri(null);
    setScreenshotError(null);
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

  async function onPickSnoozeShort(mode: SnoozeMode) {
    await updateReminderPrefs({
      ...reminderPrefs,
      snoozeShort: mode,
    });
  }

  async function onPickSnoozeLong(mode: SnoozeMode) {
    await updateReminderPrefs({
      ...reminderPrefs,
      snoozeLong: mode,
    });
  }

  async function onPickTonightHour(hour: number) {
    const clamped = Math.max(
      COACH_TONIGHT_HOUR_MIN,
      Math.min(COACH_TONIGHT_HOUR_MAX, hour),
    );
    if (clamped === reminderPrefs.tonightHour) return;
    await updateReminderPrefs({ ...reminderPrefs, tonightHour: clamped });
  }

  async function onPickTomorrowMorningHour(hour: number) {
    const clamped = Math.max(
      COACH_TOMORROW_MORNING_HOUR_MIN,
      Math.min(COACH_TOMORROW_MORNING_HOUR_MAX, hour),
    );
    if (clamped === reminderPrefs.tomorrowMorningHour) return;
    await updateReminderPrefs({
      ...reminderPrefs,
      tomorrowMorningHour: clamped,
    });
  }

  const snoozeShortOptions = useMemo(
    () => buildCoachSnoozeShortOptions(reminderPrefs.tonightHour),
    [reminderPrefs.tonightHour],
  );
  const snoozeLongOptions = useMemo(
    () => buildCoachSnoozeLongOptions(reminderPrefs.tomorrowMorningHour),
    [reminderPrefs.tomorrowMorningHour],
  );

  async function processScreenshot(uri: string, base64: string) {
    setScreenshotUri(uri);
    setScreenshotError(null);
    try {
      const res = await extractScreenshot.mutateAsync({
        data: { imageBase64: base64 },
      });
      if (res.speakerTurns && res.speakerTurns.length > 0) {
        const turns = res.speakerTurns as SpeakerTurn[];
        setScreenshotTurns(turns);
        const formatted = speakerTurnsToContext(turns, matchName);
        setContext((prev) =>
          prev.trim() ? `${prev}\n${formatted}` : formatted,
        );
      } else if (res.conversationText) {
        setContext((prev) =>
          prev.trim() ? `${prev}\n${res.conversationText}` : res.conversationText,
        );
      }
      const detected = normalizeAppName(res.sourceApp);
      if (detected) setSourceApp(detected);
    } catch {
      setScreenshotError("Couldn't read that screenshot. Try a clearer image.");
    }
  }

  function handleFlipSpeakers() {
    if (!screenshotTurns) return;
    const flipped = flipSpeakers(screenshotTurns);
    setScreenshotTurns(flipped);
    setContext(speakerTurnsToContext(flipped, matchName));
  }

  async function pickScreenshotFromLibrary() {
    setScreenshotError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setScreenshotError("We need photo access to read the screenshot.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      await processScreenshot(res.assets[0].uri, res.assets[0].base64);
    }
  }

  async function takeScreenshotPhoto() {
    setScreenshotError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setScreenshotError("We need camera access to take a snapshot.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      await processScreenshot(res.assets[0].uri, res.assets[0].base64);
    }
  }

  function clearScreenshot() {
    setScreenshotUri(null);
    setScreenshotError(null);
    setScreenshotTurns(null);
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

  function pullLastLine() {
    const nonEmpty = context.split("\n").filter((l) => l.trim().length > 0);
    if (nonEmpty.length < 1) return;
    const last = nonEmpty[nonEmpty.length - 1];
    const rest = nonEmpty.slice(0, nonEmpty.length - 1);
    const stripped = last.trim().replace(/^(me|them):\s*/i, "");
    setLastMessage(stripped);
    setContext(rest.join("\n"));
  }

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
          sourceApp: sourceApp || null,
        },
      });
      if (!isAuthenticated) {
        await rememberAnonymousId("messageSessions", session.id);
      }
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
          subtitle="Paste what you've got. Get three replies in different tones, copy the one that sounds like you."
        />

        {followUpPrompt ? (
          <View
            style={[
              styles.followUpCard,
              { backgroundColor: colors.card, borderColor: colors.violet },
            ]}
          >
            <Text style={[styles.followUpTitle, { color: colors.foreground }]}>
              Quick check, did you send that reply?
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
                  Sent it
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
                  Still thinking
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {followUpStats ? (
          <View
            style={[
              styles.statsCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-send-through-stats"
          >
            <View style={styles.statsHeader}>
              <Feather name="send" size={14} color={colors.teal} />
              <Text style={[styles.statsEyebrow, { color: colors.mutedForeground }]}>
                Send-through
              </Text>
            </View>
            {followUpStats.totalPrompts === 0 ? (
              <Text
                style={[styles.statsEmpty, { color: colors.mutedForeground }]}
                testID="stats-empty-state"
              >
                Tap “Sent it” or “Still thinking” on the prompts above and
                we'll track how often your coached replies actually go out.
              </Text>
            ) : (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statsCell}>
                    <Text
                      style={[styles.statsValue, { color: colors.foreground }]}
                      testID="stats-total-prompts"
                    >
                      {followUpStats.totalPrompts}
                    </Text>
                    <Text
                      style={[
                        styles.statsLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Prompts
                    </Text>
                  </View>
                  <View style={styles.statsCell}>
                    <Text
                      style={[styles.statsValue, { color: colors.teal }]}
                      testID="stats-sent-count"
                    >
                      {followUpStats.sentCount}
                    </Text>
                    <Text
                      style={[
                        styles.statsLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Sent
                    </Text>
                  </View>
                  <View style={styles.statsCell}>
                    <Text
                      style={[
                        styles.statsValue,
                        { color: colors.mutedForeground },
                      ]}
                      testID="stats-not-sent-count"
                    >
                      {followUpStats.notSentCount}
                    </Text>
                    <Text
                      style={[
                        styles.statsLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Skipped
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statsSecondaryRow,
                    { borderTopColor: colors.cardBorder },
                  ]}
                >
                  <View style={styles.statsCell}>
                    <Text
                      style={[
                        styles.statsValueSmall,
                        { color: "#7B93D4" },
                      ]}
                      testID="stats-snooze-count"
                    >
                      {followUpStats.snoozeCount ?? 0}
                    </Text>
                    <Text
                      style={[
                        styles.statsLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Snoozed
                    </Text>
                  </View>
                  <View style={styles.statsCell}>
                    <Text
                      style={[
                        styles.statsValueSmall,
                        { color: colors.rose },
                      ]}
                      testID="stats-dismiss-count"
                    >
                      {followUpStats.dismissCount ?? 0}
                    </Text>
                    <Text
                      style={[
                        styles.statsLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Dismissed
                    </Text>
                  </View>
                </View>
                {followUpStats.lastAnswer && followUpStats.lastAnsweredAt ? (
                  <View
                    style={[
                      styles.statsLastRow,
                      { borderTopColor: colors.cardBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statsLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Last answer
                    </Text>
                    <View style={styles.statsLastInner}>
                      <View
                        style={[
                          styles.statsBadge,
                          {
                            backgroundColor:
                              followUpStats.lastAnswer === "sent"
                                ? `${colors.teal}26`
                                : `${colors.mutedForeground}26`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statsBadgeText,
                            {
                              color:
                                followUpStats.lastAnswer === "sent"
                                  ? colors.teal
                                  : colors.foreground,
                            },
                          ]}
                          testID="stats-last-answer"
                        >
                          {followUpStats.lastAnswer === "sent"
                            ? "Sent"
                            : "Not sent"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.statsLastDate,
                          { color: colors.mutedForeground },
                        ]}
                        testID="stats-last-answered-at"
                      >
                        {new Date(
                          followUpStats.lastAnsweredAt,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            )}
            {followUpTimeline ? (
              <View
                style={[
                  styles.timelineBlock,
                  { borderTopColor: colors.cardBorder },
                ]}
                testID="card-send-through-timeline"
              >
                <Text
                  style={[
                    styles.statsLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Weekly trend
                </Text>
                {followUpTimeline.buckets.filter((b) => b.total > 0).length <
                2 ? (
                  <Text
                    style={[
                      styles.statsEmpty,
                      { color: colors.mutedForeground },
                    ]}
                    testID="timeline-empty-state"
                  >
                    A couple more weeks of follow-ups and your trend will show
                    up here.
                  </Text>
                ) : (
                  <>
                    <View
                      style={styles.timelineChips}
                      testID="timeline-series-chips"
                    >
                      {[
                        { key: "sent", label: "Sent", color: colors.teal },
                        { key: "not_sent", label: "Not sent", color: colors.gold },
                        { key: "snoozed", label: "Snoozed", color: "#7B93D4" },
                        { key: "dismissed", label: "Dismissed", color: colors.rose },
                      ].map((s) => {
                        const active = timelineActiveSeries.has(s.key);
                        return (
                          <Pressable
                            key={s.key}
                            style={[
                              styles.timelineChip,
                              {
                                backgroundColor: active
                                  ? `${s.color}26`
                                  : "transparent",
                                borderColor: active
                                  ? s.color
                                  : colors.cardBorder,
                              },
                            ]}
                            onPress={() => {
                              setTimelineActiveSeries((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.key)) {
                                  if (next.size > 1) next.delete(s.key);
                                } else {
                                  next.add(s.key);
                                }
                                return next;
                              });
                            }}
                            testID={`timeline-chip-${s.key}`}
                          >
                            <Text
                              style={[
                                styles.timelineChipText,
                                {
                                  color: active
                                    ? s.color
                                    : colors.mutedForeground,
                                },
                              ]}
                            >
                              {s.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.timelineBars} testID="timeline-bars">
                      {(() => {
                        const seriesDefs = [
                          { key: "sent", color: colors.teal },
                          { key: "not_sent", color: colors.gold },
                          { key: "snoozed", color: "#7B93D4" as string },
                          { key: "dismissed", color: colors.rose },
                        ];
                        const activeDefs = seriesDefs.filter((s) =>
                          timelineActiveSeries.has(s.key),
                        );
                        const getCount = (
                          b: (typeof followUpTimeline.buckets)[number],
                          key: string,
                        ) => {
                          if (key === "sent") return b.sentCount;
                          if (key === "not_sent") return b.notSentCount;
                          if (key === "snoozed") return b.snoozeCount;
                          return b.dismissCount;
                        };
                        const maxCount = Math.max(
                          1,
                          ...followUpTimeline.buckets.flatMap((b) =>
                            activeDefs.map((s) => getCount(b, s.key)),
                          ),
                        );
                        return followUpTimeline.buckets.map((b) => (
                          <Pressable
                            key={b.weekStart}
                            style={styles.timelineCol}
                            onPress={() => setSelectedTimelineWeek(b.weekStart)}
                            accessibilityLabel={`See breakdown for week of ${new Date(b.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                            testID={`timeline-bar-${b.weekStart}`}
                          >
                            <View style={styles.timelineBarGroup}>
                              {activeDefs.map((s) => {
                                const count = getCount(b, s.key);
                                const heightPct = Math.round(
                                  (count / maxCount) * 100,
                                );
                                return (
                                  <View
                                    key={s.key}
                                    style={[
                                      styles.timelineTrack,
                                      {
                                        backgroundColor: `${s.color}1F`,
                                      },
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.timelineFill,
                                        {
                                          height: `${count > 0 ? Math.max(8, heightPct) : 0}%`,
                                          backgroundColor:
                                            count > 0
                                              ? s.color
                                              : "transparent",
                                        },
                                      ]}
                                    />
                                  </View>
                                );
                              })}
                            </View>
                            <Text
                              style={[
                                styles.timelineTick,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              {new Date(b.weekStart).toLocaleDateString(
                                "en-US",
                                { month: "numeric", day: "numeric" },
                              )}
                            </Text>
                          </Pressable>
                        ));
                      })()}
                    </View>
                    <Text
                      style={[
                        styles.timelineCaption,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Weekly counts by outcome · last 8 weeks
                    </Text>
                  </>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {followUpTimeline ? (
          <Modal
            transparent
            visible={selectedTimelineWeek !== null}
            animationType="fade"
            onRequestClose={() => setSelectedTimelineWeek(null)}
          >
            <Pressable
              style={styles.timelineSheetBackdrop}
              onPress={() => setSelectedTimelineWeek(null)}
              testID="timeline-week-sheet-backdrop"
            >
              {(() => {
                const bucket = followUpTimeline.buckets.find(
                  (b) => b.weekStart === selectedTimelineWeek,
                );
                if (!bucket) return null;
                const rows = [
                  {
                    key: "sent",
                    label: "Sent",
                    color: colors.teal,
                    value: bucket.sentCount,
                    testID: "timeline-week-sheet-sent",
                  },
                  {
                    key: "not_sent",
                    label: "Not sent",
                    color: colors.gold,
                    value: bucket.notSentCount,
                    testID: "timeline-week-sheet-not_sent",
                  },
                  {
                    key: "snoozed",
                    label: "Snoozed",
                    color: "#7B93D4",
                    value: bucket.snoozeCount,
                    testID: "timeline-week-sheet-snoozed",
                  },
                  {
                    key: "dismissed",
                    label: "Dismissed",
                    color: colors.rose,
                    value: bucket.dismissCount,
                    testID: "timeline-week-sheet-dismissed",
                  },
                ];
                const weekDate = new Date(bucket.weekStart);
                const weekLabel = weekDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <Pressable
                    onPress={() => {}}
                    style={[
                      styles.timelineSheet,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                    testID="timeline-week-sheet"
                  >
                    <View style={styles.timelineSheetHandle} />
                    <Text
                      style={[
                        styles.timelineSheetEyebrow,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Week of
                    </Text>
                    <Text
                      style={[
                        styles.timelineSheetTitle,
                        { color: colors.foreground },
                      ]}
                      testID="timeline-week-sheet-title"
                    >
                      {weekLabel}
                    </Text>
                    <View style={styles.timelineSheetRows}>
                      {rows.map((r) => (
                        <View
                          key={r.key}
                          style={[
                            styles.timelineSheetRow,
                            { borderColor: colors.cardBorder },
                          ]}
                        >
                          <View style={styles.timelineSheetRowLeft}>
                            <View
                              style={[
                                styles.timelineSheetSwatch,
                                { backgroundColor: r.color },
                              ]}
                            />
                            <Text
                              style={[
                                styles.timelineSheetLabel,
                                { color: colors.foreground },
                              ]}
                            >
                              {r.label}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.timelineSheetValue,
                              { color: colors.foreground },
                            ]}
                            testID={r.testID}
                          >
                            {r.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={() => setSelectedTimelineWeek(null)}
                      style={({ pressed }) => [
                        styles.timelineSheetClose,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.input,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                      testID="timeline-week-sheet-close"
                      accessibilityLabel="Close week breakdown"
                    >
                      <Text
                        style={[
                          styles.timelineSheetCloseLabel,
                          { color: colors.foreground },
                        ]}
                      >
                        Close
                      </Text>
                    </Pressable>
                  </Pressable>
                );
              })()}
            </Pressable>
          </Modal>
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
                ? "Logged, nice work. We'll factor this into your send-through rate."
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
          <View style={styles.screenshotBlock}>
            <Text
              style={[styles.fieldLabel, { color: colors.mutedForeground }]}
            >
              Chat screenshot (optional)
            </Text>
            {screenshotUri ? (
              <View style={styles.screenshotPreviewRow}>
                <Image
                  source={{ uri: screenshotUri }}
                  style={styles.screenshotPreview}
                  testID="img-coach-screenshot-preview"
                />
                <View style={styles.screenshotInfo}>
                  <Text
                    style={[
                      styles.screenshotStatus,
                      { color: colors.foreground },
                    ]}
                    testID="text-coach-screenshot-status"
                  >
                    {extractScreenshot.isPending
                      ? "Reading screenshot…"
                      : "Conversation auto-filled below"}
                  </Text>
                  <Text
                    style={[
                      styles.screenshotHint,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {extractScreenshot.isPending
                      ? "Pulling text and detecting the app."
                      : "Tidy anything that looks off, then run the coach."}
                  </Text>
                  <Pressable
                    onPress={clearScreenshot}
                    style={[
                      styles.screenshotClear,
                      { borderColor: colors.border },
                    ]}
                    testID="button-coach-screenshot-clear"
                  >
                    <Feather name="x" size={12} color={colors.foreground} />
                    <Text
                      style={[
                        styles.screenshotClearText,
                        { color: colors.foreground },
                      ]}
                    >
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.screenshotPickerRow}>
                <Pressable
                  onPress={takeScreenshotPhoto}
                  disabled={extractScreenshot.isPending}
                  style={[
                    styles.screenshotPickBtn,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                      opacity: extractScreenshot.isPending ? 0.55 : 1,
                    },
                  ]}
                  testID="button-coach-screenshot-camera"
                >
                  <Feather name="camera" size={18} color={colors.violet} />
                  <Text
                    style={[
                      styles.screenshotPickLabel,
                      { color: colors.foreground },
                    ]}
                  >
                    Take photo
                  </Text>
                </Pressable>
                <Pressable
                  onPress={pickScreenshotFromLibrary}
                  disabled={extractScreenshot.isPending}
                  style={[
                    styles.screenshotPickBtn,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                      opacity: extractScreenshot.isPending ? 0.55 : 1,
                    },
                  ]}
                  testID="button-coach-screenshot-library"
                >
                  <Feather name="image" size={18} color={colors.gold} />
                  <Text
                    style={[
                      styles.screenshotPickLabel,
                      { color: colors.foreground },
                    ]}
                  >
                    {extractScreenshot.isPending ? "Reading…" : "From library"}
                  </Text>
                </Pressable>
              </View>
            )}
            {screenshotError ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: `${colors.destructive}22`,
                    borderColor: colors.destructive,
                  },
                ]}
                testID="text-coach-screenshot-error"
              >
                <Feather
                  name="alert-circle"
                  size={14}
                  color={colors.destructive}
                />
                <Text
                  style={[styles.errorText, { color: colors.destructive }]}
                >
                  {screenshotError}
                </Text>
              </View>
            ) : null}
          </View>

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

          <View style={styles.sourceAppBlock}>
            <Text
              style={[styles.fieldLabel, { color: colors.mutedForeground }]}
            >
              Source app
            </Text>
            <View style={styles.sourceAppRow}>
              {SOURCE_APPS.map((app) => {
                const selected = sourceApp === app;
                return (
                  <Pressable
                    key={app}
                    onPress={() =>
                      setSourceApp((prev) => (prev === app ? "" : app))
                    }
                    style={[
                      styles.sourceAppChip,
                      {
                        borderColor: selected ? colors.violet : colors.border,
                        backgroundColor: selected
                          ? `${colors.violet}22`
                          : colors.input,
                      },
                    ]}
                    testID={`button-coach-source-app-${app.toLowerCase()}`}
                    accessibilityState={{ selected }}
                    aria-pressed={selected}
                  >
                    <Text
                      style={[
                        styles.sourceAppChipText,
                        {
                          color: selected ? colors.violet : colors.foreground,
                        },
                      ]}
                    >
                      {app}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.conversationFieldWrapper}>
            <View style={styles.conversationFieldHeader}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                The conversation so far
              </Text>
              {screenshotTurns && screenshotTurns.length > 0 && (
                <Pressable
                  onPress={handleFlipSpeakers}
                  testID="button-flip-speakers"
                  style={[
                    styles.flipBtn,
                    { borderColor: colors.border },
                  ]}
                >
                  <Feather name="repeat" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.flipBtnText, { color: colors.mutedForeground }]}>
                    Flip speaker order
                  </Text>
                </Pressable>
              )}
            </View>
            <TextInput
              value={context}
              onChangeText={(t) => {
                setContext(t);
                if (showLineTagger) setShowLineTagger(false);
              }}
              placeholder="Paste the last few messages, what was said, who said what."
              placeholderTextColor={colors.mutedForeground}
              multiline
              testID="input-coach-context"
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
            {context.trim().length > 0 ? (
              <View style={styles.ocrActions}>
                {!showLineTagger ? (
                  <Pressable
                    onPress={pullLastLine}
                    style={[
                      styles.ocrActionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.input,
                      },
                    ]}
                    testID="button-coach-pull-last-line"
                  >
                    <Feather name="corner-right-down" size={13} color={colors.teal} />
                    <Text
                      style={[styles.ocrActionText, { color: colors.foreground }]}
                    >
                      Pull last line → Their message
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setShowLineTagger((v) => !v)}
                  style={[
                    styles.ocrActionBtn,
                    {
                      borderColor: showLineTagger ? colors.violet : colors.border,
                      backgroundColor: showLineTagger
                        ? `${colors.violet}18`
                        : colors.input,
                    },
                  ]}
                  testID="button-coach-label-speakers"
                >
                  <Feather
                    name="users"
                    size={13}
                    color={showLineTagger ? colors.violet : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.ocrActionText,
                      {
                        color: showLineTagger
                          ? colors.violet
                          : colors.foreground,
                      },
                    ]}
                  >
                    Label who said what
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {showLineTagger && context.trim().length > 0 ? (
              <LineTaggerPanel
                context={context}
                onApply={(updated) => {
                  setContext(updated);
                  setShowLineTagger(false);
                }}
                onClose={() => setShowLineTagger(false)}
              />
            ) : null}
            {screenshotTurns && screenshotTurns.length > 0 && (
              <Text style={[styles.flipHint, { color: colors.mutedForeground }]}>
                Speaker order auto-detected, tap "Flip" if the first message is yours.
              </Text>
            )}
          </View>

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
                  : "Off, we won't remind you about drafted replies."}
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
            options={snoozeShortOptions}
            value={reminderPrefs.snoozeShort}
            onChange={onPickSnoozeShort}
            disabled={!reminderPrefs.enabled}
          />
          <HourPicker
            label={`"Tonight" target`}
            hour={reminderPrefs.tonightHour}
            min={COACH_TONIGHT_HOUR_MIN}
            max={COACH_TONIGHT_HOUR_MAX}
            onChange={onPickTonightHour}
            disabled={!reminderPrefs.enabled}
            testID="picker-tonight-hour"
          />
          <SnoozeDurationPicker
            label="Long snooze"
            options={snoozeLongOptions}
            value={reminderPrefs.snoozeLong}
            onChange={onPickSnoozeLong}
            disabled={!reminderPrefs.enabled}
          />
          <HourPicker
            label={`"Tomorrow morning" target`}
            hour={reminderPrefs.tomorrowMorningHour}
            min={COACH_TOMORROW_MORNING_HOUR_MIN}
            max={COACH_TOMORROW_MORNING_HOUR_MAX}
            onChange={onPickTomorrowMorningHour}
            disabled={!reminderPrefs.enabled}
            testID="picker-tomorrow-morning-hour"
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

        {!showingDemo && display.length > 0 ? (
          <View style={styles.shareRow}>
            <ShareButton
              surface="message-coach"
              title="Three replies, three tones"
              text="Pasted a tricky message into the coach and got three replies in different tones. Way better than overthinking on my own."
              path="/coach"
              ref="mobile-coach"
              variant="pill"
              label="Share the coach"
              testId="button-share-coach-mobile"
            />
          </View>
        ) : null}
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

function LineTaggerPanel({
  context,
  onApply,
  onClose,
}: {
  context: string;
  onApply: (updated: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [lines, setLines] = useState<TaggedLine[]>(() =>
    parseTaggedLines(context),
  );

  const toggleSender = useCallback(
    (index: number, next: "me" | "them") => {
      setLines((prev) =>
        prev.map((l, i) =>
          i === index
            ? { ...l, sender: l.sender === next ? null : next }
            : l,
        ),
      );
    },
    [],
  );

  return (
    <View
      style={[
        styles.taggerPanel,
        { borderColor: colors.violet, backgroundColor: colors.card },
      ]}
      testID="panel-line-tagger"
    >
      <View style={styles.taggerHeader}>
        <Feather name="users" size={13} color={colors.violet} />
        <Text style={[styles.taggerTitle, { color: colors.violet }]}>
          Label who said what
        </Text>
        <Text
          style={[styles.taggerHint, { color: colors.mutedForeground }]}
        >
          Tap Me / Them to tag each line
        </Text>
      </View>

      <View style={styles.taggerLines}>
        {lines.map((line, i) => (
          <View
            key={i}
            style={[
              styles.taggerRow,
              {
                backgroundColor:
                  line.sender === "me"
                    ? `${colors.violet}14`
                    : line.sender === "them"
                      ? `${colors.teal}14`
                      : colors.input,
                borderColor:
                  line.sender === "me"
                    ? `${colors.violet}40`
                    : line.sender === "them"
                      ? `${colors.teal}40`
                      : colors.border,
              },
            ]}
          >
            <View style={styles.taggerChips}>
              <Pressable
                onPress={() => toggleSender(i, "me")}
                style={[
                  styles.taggerChip,
                  {
                    backgroundColor:
                      line.sender === "me"
                        ? colors.violet
                        : "transparent",
                    borderColor:
                      line.sender === "me" ? colors.violet : colors.border,
                  },
                ]}
                testID={`button-tagger-me-${i}`}
              >
                <Text
                  style={[
                    styles.taggerChipText,
                    {
                      color:
                        line.sender === "me"
                          ? "#fff"
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  Me
                </Text>
              </Pressable>
              <Pressable
                onPress={() => toggleSender(i, "them")}
                style={[
                  styles.taggerChip,
                  {
                    backgroundColor:
                      line.sender === "them"
                        ? colors.teal
                        : "transparent",
                    borderColor:
                      line.sender === "them" ? colors.teal : colors.border,
                  },
                ]}
                testID={`button-tagger-them-${i}`}
              >
                <Text
                  style={[
                    styles.taggerChipText,
                    {
                      color:
                        line.sender === "them"
                          ? "#fff"
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  Them
                </Text>
              </Pressable>
            </View>
            <Text
              style={[styles.taggerLineText, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {line.content}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.taggerFooter}>
        <Pressable
          onPress={onClose}
          style={[
            styles.taggerBtn,
            { borderColor: colors.border, backgroundColor: "transparent" },
          ]}
          testID="button-tagger-cancel"
        >
          <Text style={[styles.taggerBtnText, { color: colors.foreground }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onApply(serializeTaggedLines(lines))}
          style={[
            styles.taggerBtn,
            { borderColor: colors.violet, backgroundColor: colors.violet },
          ]}
          testID="button-tagger-apply"
        >
          <Feather name="check" size={13} color="#fff" />
          <Text style={[styles.taggerBtnText, { color: "#fff" }]}>
            Apply labels
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function HourPicker({
  label,
  hour,
  min,
  max,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  hour: number;
  min: number;
  max: number;
  onChange: (hour: number) => void;
  disabled: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const canDecrement = !disabled && hour > min;
  const canIncrement = !disabled && hour < max;
  return (
    <View style={styles.pickerBlock} testID={testID}>
      <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.hourRow}>
        <Pressable
          onPress={() => canDecrement && onChange(hour - 1)}
          disabled={!canDecrement}
          accessibilityLabel="Earlier hour"
          testID={testID ? `${testID}-decrement` : undefined}
          style={[
            styles.hourStep,
            {
              borderColor: colors.border,
              backgroundColor: colors.input,
              opacity: canDecrement ? 1 : 0.45,
            },
          ]}
        >
          <Feather name="minus" size={16} color={colors.foreground} />
        </Pressable>
        <View
          style={[
            styles.hourValue,
            {
              borderColor: colors.primary,
              backgroundColor: `${colors.primary}22`,
              opacity: disabled ? 0.45 : 1,
            },
          ]}
        >
          <Text
            style={[styles.hourValueText, { color: colors.primary }]}
            testID={testID ? `${testID}-value` : undefined}
          >
            {formatHourLabel(hour)}
          </Text>
        </View>
        <Pressable
          onPress={() => canIncrement && onChange(hour + 1)}
          disabled={!canIncrement}
          accessibilityLabel="Later hour"
          testID={testID ? `${testID}-increment` : undefined}
          style={[
            styles.hourStep,
            {
              borderColor: colors.border,
              backgroundColor: colors.input,
              opacity: canIncrement ? 1 : 0.45,
            },
          ]}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
        </Pressable>
        <Text
          style={[styles.hourRange, { color: colors.mutedForeground }]}
        >
          {formatHourLabel(min)}–{formatHourLabel(max)}
        </Text>
      </View>
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
  options: SnoozeOption[];
  value: SnoozeMode;
  onChange: (mode: SnoozeMode) => void;
  disabled: boolean;
}) {
  const colors = useColors();
  const matchesPreset = options.some((o) => snoozeModesEqual(value, o));
  const isCustomDuration = value.kind === "duration" && !matchesPreset;
  const [customOpen, setCustomOpen] = useState(isCustomDuration);
  const [customText, setCustomText] = useState(
    isCustomDuration ? String(Math.max(1, Math.round(value.seconds / 60))) : "",
  );

  useEffect(() => {
    if (!isCustomDuration) {
      setCustomOpen(false);
      setCustomText("");
    } else {
      setCustomOpen(true);
      setCustomText((prev) =>
        prev ? prev : String(Math.max(1, Math.round(value.seconds / 60))),
      );
    }
  }, [value, isCustomDuration]);

  function commitCustom(text: string) {
    const minutes = parseInt(text, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    let seconds = minutes * 60;
    if (seconds < COACH_SNOOZE_CUSTOM_MIN_SECONDS)
      seconds = COACH_SNOOZE_CUSTOM_MIN_SECONDS;
    if (seconds > COACH_SNOOZE_CUSTOM_MAX_SECONDS)
      seconds = COACH_SNOOZE_CUSTOM_MAX_SECONDS;
    if (value.kind === "duration" && seconds === value.seconds) return;
    onChange({ kind: "duration", seconds });
  }

  const customSelected = customOpen && isCustomDuration;

  return (
    <View style={styles.pickerBlock}>
      <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.delayRow}>
        {options.map((opt) => {
          const selected = !customOpen && snoozeModesEqual(value, opt);
          const key =
            opt.kind === "duration" ? `dur-${opt.seconds}` : opt.kind;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setCustomOpen(false);
                setCustomText("");
                onChange(snoozeOptionToMode(opt));
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
                const fallbackMinutes =
                  value.kind === "duration"
                    ? Math.max(1, Math.round(value.seconds / 60))
                    : 30;
                setCustomText(String(fallbackMinutes));
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
  screenshotBlock: { gap: 8 },
  screenshotPickerRow: { flexDirection: "row", gap: 10 },
  screenshotPickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  screenshotPickLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  screenshotPreviewRow: { flexDirection: "row", gap: 12 },
  screenshotPreview: {
    width: 96,
    height: 128,
    borderRadius: 12,
    backgroundColor: "#0006",
  },
  screenshotInfo: { flex: 1, gap: 6 },
  screenshotStatus: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  screenshotHint: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 17,
  },
  screenshotClear: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 2,
  },
  screenshotClearText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  conversationFieldWrapper: { gap: 6 },
  conversationFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  flipBtnText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  flipHint: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 14,
  },
  sourceAppBlock: { gap: 8 },
  sourceAppRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  sourceAppChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sourceAppChipText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
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
  shareRow: {
    marginTop: 16,
    alignItems: "center",
  },
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
  statsCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsEyebrow: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  statsEmpty: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statsCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statsValue: {
    fontSize: 22,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  statsLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statsSecondaryRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  statsValueSmall: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  statsLastRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  statsLastInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statsBadgeText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  statsLastDate: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  timelineBlock: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  timelineChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  timelineChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  timelineChipText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  timelineBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 72,
  },
  timelineCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  timelineBarGroup: {
    width: "100%",
    height: 56,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  timelineTrack: {
    flex: 1,
    height: "100%",
    borderRadius: 3,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  timelineFill: {
    width: "100%",
    borderRadius: 3,
  },
  timelineTick: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  timelineCaption: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  timelineSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  timelineSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  timelineSheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 6,
  },
  timelineSheetEyebrow: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  timelineSheetTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_600SemiBold",
  },
  timelineSheetRows: {
    gap: 0,
  },
  timelineSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timelineSheetRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timelineSheetSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  timelineSheetLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  timelineSheetValue: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
    fontVariant: ["tabular-nums"],
  },
  timelineSheetClose: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  timelineSheetCloseLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
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
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hourStep: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hourValue: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: "center",
  },
  hourValueText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  hourRange: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    marginLeft: "auto",
  },
  ocrActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 6,
  },
  ocrActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ocrActionText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  taggerPanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginTop: 6,
  },
  taggerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  taggerTitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
  },
  taggerHint: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    marginLeft: 2,
  },
  taggerLines: {
    gap: 6,
  },
  taggerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  taggerChips: {
    flexDirection: "column",
    gap: 4,
  },
  taggerChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: "center",
  },
  taggerChipText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.6,
  },
  taggerLineText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 18,
  },
  taggerFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  taggerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
  },
  taggerBtnText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
