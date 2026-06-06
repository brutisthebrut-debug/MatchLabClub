import { Feather } from "@expo/vector-icons";
import {
  getGetConnectionMessagesQueryKey,
  getGetConnectionQueryKey,
  getGetConnectionsQueryKey,
  useGetConnection,
  useGetConnectionMessages,
  useGetConnectionProfile,
  useMarkConnectionRead,
  useReportConnection,
  useSendConnectionMessage,
  useUnmatchConnection,
  type ConnectionMessage,
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
  const profileQuery = useGetConnectionProfile(id, {
    query: {
      queryKey: ["connectionProfile", id],
      enabled: isAuthenticated && id.length > 0 && showReveal,
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
});
