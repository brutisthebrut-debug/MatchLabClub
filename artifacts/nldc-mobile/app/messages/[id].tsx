import { Feather } from "@expo/vector-icons";
import {
  getGetConnectionMessagesQueryKey,
  getGetConnectionQueryKey,
  getGetConnectionStartersQueryKey,
  getGetConnectionsQueryKey,
  useGetConnection,
  useGetConnectionMessages,
  useGetConnectionProfile,
  useGetConnectionStarters,
  useMarkConnectionRead,
  useReportConnection,
  useSendConnectionMessage,
  useSuggestConnectionDateIdeas,
  useUnmatchConnection,
  type ConnectionMessage,
  type ConnectionStarter,
  type DateIdea,
  type ReportConnectionInputReason,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

const REPORT_REASONS: { value: ReportConnectionInputReason; label: string }[] = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "scam", label: "Scam or spam" },
  { value: "safety", label: "Safety concern" },
  { value: "underage", label: "Looks underage" },
  { value: "other", label: "Something else" },
];

const DEMO_MESSAGES: ConnectionMessage[] = [
  {
    id: "d1",
    connectionId: "demo",
    senderUserId: "them",
    body: "Hey, glad we matched. Your readiness profile is impressive.",
    mine: false,
    createdAt: new Date(Date.now() - 5_400_000).toISOString(),
    readAt: new Date().toISOString(),
  },
  {
    id: "d2",
    connectionId: "demo",
    senderUserId: "me",
    body: "Thank you. Yours too. What is your ideal weekend?",
    mine: true,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    readAt: new Date().toISOString(),
  },
];

// Demo compatibility + openers so signed-out visitors never see an empty
// screen. The real values come from the API once you sign in.
const DEMO_COMPATIBILITY = {
  score: 82,
  summary: "Strong overall fit, and you are about 8 miles apart.",
};

const DEMO_STARTERS: ConnectionStarter[] = [
  {
    text: "Hey there. Glad we matched. What is something you are genuinely into right now that you could talk about for an hour?",
    rationale: "Opens with warmth and an easy, open question.",
  },
  {
    text: "Real question to kick us off: are you more of a plan-the-weekend person or a see-where-the-day-goes person?",
    rationale: "A light either-or is simple to answer.",
  },
  {
    text: "Quick one to break the ice: give me your most defensible hot take. Could be food, could be movies.",
    rationale: "Playful and low stakes, it sparks a real reply.",
  },
];

const DEMO_DATE_IDEAS: DateIdea[] = [
  {
    title: "Coffee and a walk",
    description:
      "Meet for coffee near both of you and take a slow walk after. Low pressure, easy to leave early or keep going.",
    category: "coffee",
  },
  {
    title: "Shared plates dinner",
    description:
      "Pick a spot with small plates so you can try a few things and compare notes. Ordering together is its own little icebreaker.",
    category: "food",
  },
  {
    title: "Something outdoors",
    description:
      "Find a park or an easy trail and spend an hour outside. Walking side by side takes the pressure off.",
    category: "outdoors",
  },
];

// 70+ reads as a strong fit, 40-69 as forming, below that as early days.
function scoreLabel(score: number): string {
  if (score >= 70) return "looks strong";
  if (score >= 40) return "is forming";
  return "is early";
}

function photoUri(url: string): string {
  if (url.startsWith("http")) return url;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  const path = url.startsWith("/") ? url : `/api/${url}`;
  return `${base}${path}`;
}

export default function ChatThreadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = rawId ?? "";
  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const isDemo = !isAuthenticated;

  const [draft, setDraft] = useState("");
  const [showReveal, setShowReveal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const connectionQuery = useGetConnection(id, {
    query: {
      queryKey: getGetConnectionQueryKey(id),
      enabled: isAuthenticated && id.length > 0,
      retry: false,
    },
  });
  const messagesQuery = useGetConnectionMessages(id, {
    query: {
      queryKey: getGetConnectionMessagesQueryKey(id),
      enabled: isAuthenticated && id.length > 0,
      retry: false,
      refetchInterval: 15_000,
    },
  });
  // Profile loads eagerly (not gated on the reveal toggle) so the compatibility
  // score shows up front. The server still withholds name and photos until the
  // counterpart turns reveal consent on; only the symmetric score and aggregate
  // summary come through pre-reveal.
  const profileQuery = useGetConnectionProfile(id, {
    query: {
      queryKey: ["connectionProfile", id],
      enabled: isAuthenticated && id.length > 0,
      retry: false,
    },
  });
  // Starters only render on an active thread with no messages yet (see the
  // StartersCard gate below), so we fetch them under that exact condition.
  // Firing eagerly would burn a Claude daily-cap token for consent-on users on
  // a card that never shows (closed threads, ongoing chats).
  const startersQuery = useGetConnectionStarters(id, {
    query: {
      queryKey: getGetConnectionStartersQueryKey(id),
      enabled:
        isAuthenticated &&
        id.length > 0 &&
        connectionQuery.isSuccess &&
        connectionQuery.data?.status !== "closed" &&
        messagesQuery.isSuccess &&
        (messagesQuery.data?.length ?? 0) === 0,
      retry: false,
    },
  });

  const sendMessage = useSendConnectionMessage();
  const markRead = useMarkConnectionRead();
  const unmatch = useUnmatchConnection();
  const report = useReportConnection();

  const connection = connectionQuery.data ?? null;
  const messages = isDemo ? DEMO_MESSAGES : (messagesQuery.data ?? []);
  const closed = connection?.status === "closed";
  const starters = isDemo ? DEMO_STARTERS : (startersQuery.data?.starters ?? []);

  const invalidateThread = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetConnectionMessagesQueryKey(id),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetConnectionQueryKey(id),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetConnectionsQueryKey(),
    });
  };

  useEffect(() => {
    if (isDemo || !id || !connection) return;
    if (messages.some((m) => !m.mine && m.readAt === null)) {
      markRead.mutate(
        { id },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: getGetConnectionsQueryKey(),
            });
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, id, connection, messages.length]);

  useEffect(() => {
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(t);
  }, [messages.length]);

  const handleSend = () => {
    const body = draft.trim();
    if (isDemo || !body || sendMessage.isPending || closed) return;
    sendMessage.mutate(
      { id, data: { body } },
      {
        onSuccess: () => {
          setDraft("");
          invalidateThread();
        },
        onError: () => {
          if (Platform.OS !== "web") {
            Alert.alert("Couldn't send", "Something went wrong. Try again.");
          }
        },
      },
    );
  };

  const confirmUnmatch = () => {
    if (isDemo) return;
    const run = () =>
      unmatch.mutate(
        { id },
        {
          onSuccess: () => {
            invalidateThread();
            router.back();
          },
        },
      );
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Unmatch and close this conversation?")) run();
      return;
    }
    Alert.alert("Unmatch?", "This closes the conversation for both of you.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unmatch", style: "destructive", onPress: run },
    ]);
  };

  const submitReport = (reason: ReportConnectionInputReason) => {
    if (isDemo) return;
    report.mutate(
      { id, data: { reason } },
      {
        onSuccess: () => {
          invalidateThread();
          if (Platform.OS !== "web") {
            Alert.alert(
              "Report sent",
              "We closed this conversation and our team will review it.",
            );
          }
          router.back();
        },
      },
    );
  };

  const openReport = () => {
    if (isDemo) return;
    if (Platform.OS === "web") {
      submitReport("harassment");
      return;
    }
    Alert.alert(
      "Report this match",
      "We close the conversation and review it. This never affects your Match Readiness.",
      [
        { text: "Cancel", style: "cancel" },
        ...REPORT_REASONS.slice(0, 4).map((r) => ({
          text: r.label,
          onPress: () => submitReport(r.value),
        })),
      ],
    );
  };

  const reveal = profileQuery.data;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View
        style={[
          styles.actionBar,
          { borderBottomColor: colors.cardBorder, paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowReveal((v) => !v)}
          style={styles.actionBtn}
        >
          <Feather name="user" size={15} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            {showReveal ? "Hide profile" : "Profile"}
          </Text>
        </Pressable>
        <View style={styles.actionRight}>
          {!closed ? (
            <Pressable
              accessibilityRole="button"
              onPress={confirmUnmatch}
              style={styles.actionBtn}
            >
              <Feather name="user-x" size={15} color={colors.mutedForeground} />
              <Text
                style={[styles.actionText, { color: colors.mutedForeground }]}
              >
                Unmatch
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={openReport}
            style={styles.actionBtn}
          >
            <Feather name="flag" size={15} color={colors.rose} />
            <Text style={[styles.actionText, { color: colors.rose }]}>
              Report
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
      >
        {isDemo ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => login()}
            style={[
              styles.banner,
              { borderColor: colors.cardBorder, backgroundColor: colors.card },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
              Sample conversation. Sign in to message your real matches.
            </Text>
          </Pressable>
        ) : null}

        {isDemo ? (
          <CompatibilityCard
            score={DEMO_COMPATIBILITY.score}
            summary={DEMO_COMPATIBILITY.summary}
          />
        ) : reveal?.compatibilityScore != null ? (
          <CompatibilityCard
            score={reveal.compatibilityScore}
            summary={reveal.matchSummary}
          />
        ) : null}

        {showReveal ? (
          <View
            style={[
              styles.revealCard,
              { borderColor: colors.cardBorder, backgroundColor: colors.card },
            ]}
          >
            {profileQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : reveal ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.revealName, { color: colors.foreground }]}>
                  {reveal.revealed && reveal.displayName
                    ? reveal.displayName
                    : "Your match"}
                </Text>
                {!reveal.revealed ? (
                  <Text
                    style={[
                      styles.revealHint,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Name and photos hidden until they opt in.
                  </Text>
                ) : null}
                {reveal.revealed && reveal.photos.length > 0 ? (
                  <View style={styles.revealPhotos}>
                    {reveal.photos.slice(0, 6).map((p, i) => (
                      <Image
                        key={i}
                        source={{ uri: photoUri(p) }}
                        style={styles.revealPhoto}
                      />
                    ))}
                  </View>
                ) : null}
                <Text
                  style={[styles.revealBody, { color: colors.mutedForeground }]}
                >
                  {reveal.readinessSummary}
                </Text>
                <Text
                  style={[styles.revealBody, { color: colors.mutedForeground }]}
                >
                  {reveal.valuesSummary}
                </Text>
              </View>
            ) : (
              <Text style={[styles.revealHint, { color: colors.mutedForeground }]}>
                Profile is not available yet.
              </Text>
            )}
          </View>
        ) : null}

        {closed ? (
          <View
            style={[
              styles.banner,
              { borderColor: colors.cardBorder, backgroundColor: colors.card },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
              This conversation is closed. You can no longer send messages here.
            </Text>
          </View>
        ) : null}

        {!closed && messages.length === 0 && starters.length > 0 ? (
          <StartersCard starters={starters} onPick={setDraft} />
        ) : null}

        {messagesQuery.isLoading && !isDemo ? (
          <View style={{ paddingVertical: 40 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="heart" size={26} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              You matched. Send the first message.
            </Text>
          </View>
        ) : (
          messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubbleRow,
                { justifyContent: m.mine ? "flex-end" : "flex-start" },
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  m.mine
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: m.mine ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {m.body}
                </Text>
              </View>
            </View>
          ))
        )}

        {!closed ? <DateIdeasCard id={id} isDemo={isDemo} /> : null}

        <View style={styles.safety}>
          <Feather name="shield" size={13} color={colors.mutedForeground} />
          <Text style={[styles.safetyText, { color: colors.mutedForeground }]}>
            Keep the conversation here until you trust each other. Never send
            money. You can unmatch or report at any time.
          </Text>
        </View>
      </ScrollView>

      {!closed ? (
        <View
          style={[
            styles.composer,
            {
              borderTopColor: colors.cardBorder,
              paddingBottom: Math.max(insets.bottom, 10),
              backgroundColor: colors.background,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={4000}
            editable={!isDemo}
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.cardBorder,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={handleSend}
            disabled={isDemo || sendMessage.isPending || draft.trim().length === 0}
            style={[
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity:
                  isDemo || draft.trim().length === 0 || sendMessage.isPending
                    ? 0.5
                    : 1,
              },
            ]}
          >
            <Feather name="send" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// Symmetric compatibility, shown up front. Score and aggregate summary are
// reveal-safe; name and photos stay behind the reveal toggle + server gate.
function CompatibilityCard({
  score,
  summary,
}: {
  score: number;
  summary: string | null;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.featureCard,
        { borderColor: colors.cardBorder, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.compatRow}>
        <View style={[styles.scoreBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.scoreText, { color: colors.primaryForeground }]}>
            {score}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Compatibility {scoreLabel(score)}
          </Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            {summary ??
              "How your readiness and values line up. The more you both share, the sharper this gets."}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Cold-start openers the user can drop into the composer and edit before sending.
function StartersCard({
  starters,
  onPick,
}: {
  starters: ConnectionStarter[];
  onPick: (text: string) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.featureCard,
        { borderColor: colors.cardBorder, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.cardHeader}>
        <Feather name="zap" size={15} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          Openers to break the ice
        </Text>
      </View>
      <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
        Tap one to drop it in, then make it yours before you send.
      </Text>
      <View style={styles.cardList}>
        {starters.map((s, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            onPress={() => onPick(s.text)}
            style={[
              styles.listItem,
              {
                borderColor: colors.cardBorder,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Text style={[styles.listItemText, { color: colors.foreground }]}>
              {s.text}
            </Text>
            <Text
              style={[styles.listItemMeta, { color: colors.mutedForeground }]}
            >
              {s.rationale}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// On-demand date ideas. The POST mutation only spends the deep AI lane (for
// consent-on accounts) when the user actually taps the button. Demo mode shows a
// fixed set immediately. The location label is reveal-safe phrasing from the
// server, never the counterpart's raw city unless they revealed it.
function DateIdeasCard({ id, isDemo }: { id: string; isDemo: boolean }) {
  const colors = useColors();
  const suggest = useSuggestConnectionDateIdeas();
  const ideas: DateIdea[] = isDemo
    ? DEMO_DATE_IDEAS
    : (suggest.data?.ideas ?? []);
  const locationLabel = isDemo
    ? "near both of you"
    : (suggest.data?.locationLabel ?? null);
  const hasResult = isDemo || suggest.isSuccess;

  const handleSuggest = () => {
    if (isDemo || suggest.isPending) return;
    suggest.mutate({ id });
  };

  return (
    <View
      style={[
        styles.featureCard,
        { borderColor: colors.cardBorder, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.cardHeader}>
        <Feather name="map-pin" size={15} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          Date ideas {locationLabel ?? "near both of you"}
        </Text>
      </View>
      <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
        A few ways to take this off the app when you are both ready.
      </Text>
      {hasResult && ideas.length > 0 ? (
        <View style={styles.cardList}>
          {ideas.map((idea, i) => (
            <View
              key={i}
              style={[
                styles.listItem,
                {
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <Text style={[styles.listItemText, { color: colors.foreground }]}>
                {idea.title}
              </Text>
              <Text
                style={[styles.listItemMeta, { color: colors.mutedForeground }]}
              >
                {idea.description}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={handleSuggest}
          disabled={suggest.isPending}
          style={[
            styles.suggestBtn,
            {
              borderColor: colors.cardBorder,
              backgroundColor: colors.background,
              opacity: suggest.isPending ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[styles.suggestBtnText, { color: colors.foreground }]}>
            {suggest.isPending ? "Thinking..." : "Suggest date ideas"}
          </Text>
        </Pressable>
      )}
      {!isDemo && suggest.isError ? (
        <Text
          style={[
            styles.cardHint,
            { color: colors.mutedForeground, marginTop: 8 },
          ]}
        >
          Could not load ideas just now. Try again.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  actionRight: { flexDirection: "row", gap: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontSize: 13, fontWeight: "500" },
  messages: { paddingHorizontal: 14, paddingVertical: 14, gap: 8 },
  banner: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 6 },
  bannerText: { fontSize: 13, lineHeight: 18 },
  revealCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8 },
  revealName: { fontSize: 16, fontWeight: "700" },
  revealHint: { fontSize: 12 },
  revealPhotos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  revealPhoto: { width: 72, height: 72, borderRadius: 12 },
  revealBody: { fontSize: 13, lineHeight: 19 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", maxWidth: 300 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  safety: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    paddingHorizontal: 4,
    paddingTop: 16,
  },
  safetyText: { flex: 1, fontSize: 11, lineHeight: 16 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  compatRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: { fontSize: 18, fontWeight: "700" },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardBody: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardHint: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  cardList: { gap: 8, marginTop: 10 },
  listItem: { borderWidth: 1, borderRadius: 12, padding: 11 },
  listItemText: { fontSize: 14, lineHeight: 19 },
  listItemMeta: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  suggestBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 10,
  },
  suggestBtnText: { fontSize: 13, fontWeight: "600" },
});
