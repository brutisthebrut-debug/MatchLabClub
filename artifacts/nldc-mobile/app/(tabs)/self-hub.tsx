import { Feather } from "@expo/vector-icons";
import {
  getGetAccountSummaryQueryKey,
  getGetAiContentConsentQueryKey,
  getListJournalEntriesQueryKey,
  getListPostDateNotesQueryKey,
  getListWellnessAnswersQueryKey,
  useCreateInstagramPaste,
  useGetAccountSummary,
  useGetAiContentConsent,
  useListJournalEntries,
  useListPostDateNotes,
  useListWellnessAnswers,
  useSetAiContentConsent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { ShareButton } from "@/components/echo/ShareButton";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

const WELLNESS_DIMENSION_COUNT = 18;

function daysAgo(iso?: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function SelfHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();

  const summary = useGetAccountSummary({
    query: {
      queryKey: getGetAccountSummaryQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const consent = useGetAiContentConsent({
    query: {
      queryKey: getGetAiContentConsentQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const wellness = useListWellnessAnswers(undefined, {
    query: {
      queryKey: getListWellnessAnswersQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const journal = useListJournalEntries(undefined, {
    query: {
      queryKey: getListJournalEntriesQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const postDate = useListPostDateNotes(undefined, {
    query: {
      queryKey: getListPostDateNotesQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const setConsent = useSetAiContentConsent();
  const igPaste = useCreateInstagramPaste();

  const [igBio, setIgBio] = useState("");
  const [igCaptions, setIgCaptions] = useState("");
  const [banner, setBanner] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  const wellnessRows = (wellness.data?.answers ?? []) as Array<{
    dimension?: string;
  }>;
  const distinctDims = new Set(
    wellnessRows.map((r) => r.dimension).filter(Boolean),
  );
  const wellnessPct = Math.min(
    100,
    Math.round((distinctDims.size / WELLNESS_DIMENSION_COUNT) * 100),
  );

  const journalRows = (journal.data?.entries ?? []) as Array<{
    id: number;
    createdAt?: string;
    body?: string;
  }>;
  const postDateRows = (postDate.data?.notes ?? []) as Array<{
    id: number;
    createdAt?: string;
    matchName?: string | null;
    body?: string;
  }>;

  const consentGranted = Boolean(consent.data?.granted);
  const summaryData = summary.data ?? {
    audits: 0,
    profiles: 0,
    messages: 0,
    insights: 0,
    journalEntries: 0,
    postDateNotes: 0,
  };

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Friend";

  function handleConsentToggle(next: boolean) {
    setConsent.mutate(
      { data: { granted: next } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetAiContentConsentQueryKey(),
          });
          setBanner({
            kind: "success",
            text: next
              ? "AI on your content is on. You can switch it back off anytime."
              : "AI on your content is off. The deterministic baseline still works.",
          });
        },
        onError: () => {
          setBanner({
            kind: "error",
            text: "Could not save your choice. Try again in a moment.",
          });
        },
      },
    );
  }

  function handleInstagramSubmit() {
    const bio = igBio.trim();
    const captions = igCaptions
      .split(/\r?\n/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .slice(0, 10);
    if (!bio) {
      setBanner({
        kind: "error",
        text: "Paste your Instagram bio first so we have something to read.",
      });
      return;
    }
    igPaste.mutate(
      {
        data: {
          bio: bio.slice(0, 500),
          recentCaptions: captions.map((c) => c.slice(0, 800)),
        },
      },
      {
        onSuccess: () => {
          setIgBio("");
          setIgCaptions("");
          setBanner({
            kind: "success",
            text: "We got it. Your tone read will be ready in a minute.",
          });
        },
        onError: () => {
          setBanner({
            kind: "error",
            text: "Could not save that paste. Try again in a moment.",
          });
        },
      },
    );
  }

  if (authLoading) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, justifyContent: "center" },
        ]}
      >
        <ActivityIndicator color={colors.violet} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topInset + 16, paddingBottom: bottomInset },
          ]}
        >
          <ScreenHeader
            eyebrow="Self Hub"
            title="Your second brain, in one place"
            subtitle="Wellness completeness, journal cadence, compass reads, imports, and consent. Sign in to see yours."
          />
          <Pressable
            testID="button-self-hub-signin"
            onPress={() => {
              void login();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="log-in" size={15} color={colors.primaryForeground} />
            <Text
              style={[styles.primaryLabel, { color: colors.primaryForeground }]}
            >
              Sign in to see mine
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
      >
        <ScreenHeader
          eyebrow="Self Hub"
          title={`Hi${user?.firstName ? `, ${user.firstName}` : ""}.`}
          subtitle="Here's what we know about you. Everything below is yours, exportable, and deletable at any time."
        />

        {/* Identity */}
        <View
          testID="self-hub-identity"
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.gold}22` },
              ]}
            >
              <Feather name="user" size={16} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.cardTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {fullName}
              </Text>
              {user?.email ? (
                <Text
                  style={[
                    styles.cardBody,
                    { color: colors.mutedForeground, marginTop: 2 },
                  ]}
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>
          <ShareButton
            testId="button-share-self-hub"
            surface="self-hub"
            title="Read your dating signals, free in 2 minutes"
            text="I've been using MatchLab Club as a second brain for my dating life. Try a quiz, see what your patterns actually say about you."
            path="/quizzes"
            ref={user?.id ? `user-${user.id}` : "self-hub"}
            variant="primary"
            label="Send a quiz to a friend"
            style={{ marginTop: 12 }}
          />
        </View>

        {/* Your Mirror */}
        <Pressable
          testID="self-hub-mirror-card"
          onPress={() => router.push("/mirror" as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.gold}22` },
              ]}
            >
              <Feather name="eye" size={16} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Your Mirror
            </Text>
            <View style={{ flex: 1 }} />
            <Feather
              name="chevron-right"
              size={16}
              color={colors.mutedForeground}
            />
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            The evolving read of what we can see about you, your blind spots, and
            the one move that teaches the machine the most next.
          </Text>
        </Pressable>

        {banner ? (
          <View
            testID="self-hub-banner"
            style={[
              styles.banner,
              {
                backgroundColor:
                  banner.kind === "success"
                    ? `${colors.success}22`
                    : `${colors.destructive}22`,
                borderColor:
                  banner.kind === "success"
                    ? colors.success
                    : colors.destructive,
              },
            ]}
          >
            <Feather
              name={banner.kind === "success" ? "check-circle" : "alert-circle"}
              size={16}
              color={
                banner.kind === "success" ? colors.success : colors.destructive
              }
            />
            <Text
              style={[
                styles.bannerText,
                {
                  color:
                    banner.kind === "success"
                      ? colors.success
                      : colors.destructive,
                },
              ]}
            >
              {banner.text}
            </Text>
          </View>
        ) : null}

        {/* Wellness completeness */}
        <View
          testID="self-hub-wellness"
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.violet}22` },
              ]}
            >
              <Feather name="activity" size={16} color={colors.violet} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Your wellness profile
            </Text>
            <View style={{ flex: 1 }} />
            <Text
              style={[
                styles.cardTitle,
                { color: colors.foreground, fontSize: 18 },
              ]}
              testID="self-hub-wellness-pct"
            >
              {wellnessPct}%
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            {distinctDims.size === 0
              ? "You haven't answered any wellness questions yet. Start there. It powers everything else."
              : `You've covered ${distinctDims.size} of ${WELLNESS_DIMENSION_COUNT} dimensions. The more you cover, the sharper your compass reads and coaching become.`}
          </Text>
        </View>

        {/* Activity counts */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.gold}22` },
              ]}
            >
              <Feather name="bar-chart-2" size={16} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Activity on file
            </Text>
          </View>
          <View style={styles.statGrid}>
            <Stat label="Audits" value={summaryData.audits} colors={colors} />
            <Stat
              label="Coaching"
              value={summaryData.messages}
              colors={colors}
            />
            <Stat
              label="Insights"
              value={summaryData.insights}
              colors={colors}
            />
            <Stat
              label="Journal"
              value={summaryData.journalEntries}
              colors={colors}
            />
            <Stat
              label="Debriefs"
              value={summaryData.postDateNotes}
              colors={colors}
            />
            <Stat
              label="Profiles"
              value={summaryData.profiles}
              colors={colors}
            />
          </View>
        </View>

        {/* Recent journal */}
        <Pressable
          testID="self-hub-journal-card"
          onPress={() => router.push("/journal" as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.violet}22` },
              ]}
            >
              <Feather name="book-open" size={16} color={colors.violet} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Recent journal
            </Text>
            <View style={{ flex: 1 }} />
            <Feather
              name="chevron-right"
              size={16}
              color={colors.mutedForeground}
            />
          </View>
          {journalRows.length === 0 ? (
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              No entries yet. Start one when something catches your attention.
            </Text>
          ) : (
            journalRows.slice(0, 3).map((row) => (
              <View key={row.id} style={styles.listRow}>
                <Text
                  style={[
                    styles.listRowBody,
                    { color: colors.foreground },
                  ]}
                  numberOfLines={2}
                >
                  {row.body || "Untitled entry"}
                </Text>
                <Text
                  style={[
                    styles.listRowMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {daysAgo(row.createdAt)}
                </Text>
              </View>
            ))
          )}
        </Pressable>

        {/* Recent post-date notes */}
        <Pressable
          testID="self-hub-debriefs-card"
          onPress={() => router.push("/dates" as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.accent}22` },
              ]}
            >
              <Feather name="heart" size={16} color={colors.accent} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Recent post-date notes
            </Text>
            <View style={{ flex: 1 }} />
            <Feather
              name="chevron-right"
              size={16}
              color={colors.mutedForeground}
            />
          </View>
          {postDateRows.length === 0 ? (
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              No debriefs yet. Log one after your next date.
            </Text>
          ) : (
            postDateRows.slice(0, 3).map((row) => (
              <View key={row.id} style={styles.listRow}>
                <Text
                  style={[styles.listRowBody, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {row.matchName ? `${row.matchName}: ` : ""}
                  {row.body || "Debrief"}
                </Text>
                <Text
                  style={[
                    styles.listRowMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {daysAgo(row.createdAt)}
                </Text>
              </View>
            ))
          )}
        </Pressable>

        {/* AI consent */}
        <View
          testID="self-hub-consent-card"
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.accent}22` },
              ]}
            >
              <Feather name="cpu" size={16} color={colors.accent} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Use AI on my content
            </Text>
            <View style={{ flex: 1 }} />
            <Switch
              testID="switch-ai-content-consent"
              value={consentGranted}
              disabled={consent.isLoading || setConsent.isPending}
              onValueChange={handleConsentToggle}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={
                Platform.OS === "android" ? colors.background : undefined
              }
            />
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            When on, your bios, messages, and pastes can be sent to Claude for
            deeper analysis. Off by default. Switch anytime.
          </Text>
        </View>

        {/* Instagram paste */}
        <View
          testID="self-hub-instagram-card"
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.accent}22` },
              ]}
            >
              <Feather name="instagram" size={16} color={colors.accent} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Import from Instagram (beta)
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Paste your bio and a handful of recent captions. We use them to
            read your tone and write things that sound like you.
          </Text>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>
            Your Instagram bio
          </Text>
          <TextInput
            testID="input-instagram-bio"
            value={igBio}
            onChangeText={(t) => setIgBio(t.slice(0, 500))}
            placeholder="Paste your bio here"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            style={[
              styles.textarea,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
          />
          <Text
            style={[
              styles.helper,
              { color: colors.mutedForeground, alignSelf: "flex-end" },
            ]}
          >
            {igBio.length}/500
          </Text>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>
            Recent captions (one per line)
          </Text>
          <TextInput
            testID="input-instagram-captions"
            value={igCaptions}
            onChangeText={setIgCaptions}
            placeholder="Paste 5 to 10 recent captions"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.textarea,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
                minHeight: 120,
              },
            ]}
          />
          <Pressable
            testID="button-instagram-submit"
            disabled={igPaste.isPending || !igBio.trim()}
            onPress={handleInstagramSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity:
                  igPaste.isPending || !igBio.trim()
                    ? 0.5
                    : pressed
                      ? 0.85
                      : 1,
              },
            ]}
          >
            {igPaste.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather
                  name="send"
                  size={15}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.primaryLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Send to MatchLab
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Open compass / imports */}
        <Pressable
          testID="link-self-hub-compass"
          onPress={() => router.push("/compass" as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.violet}22` },
              ]}
            >
              <Feather name="compass" size={16} color={colors.violet} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Open Compass
            </Text>
            <View style={{ flex: 1 }} />
            <Feather
              name="chevron-right"
              size={16}
              color={colors.mutedForeground}
            />
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            A read of your connection style and recurring patterns. Takes about
            a minute.
          </Text>
        </Pressable>

        <Pressable
          testID="link-self-hub-imports"
          onPress={() => router.push("/imports" as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.gold}22` },
              ]}
            >
              <Feather name="upload" size={16} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Open Imports
            </Text>
            <View style={{ flex: 1 }} />
            <Feather
              name="chevron-right"
              size={16}
              color={colors.mutedForeground}
            />
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Bring your Hinge GDPR export in. We'll read what your match
            patterns say about you.
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.input, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  cardBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 19,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stat: {
    flexGrow: 1,
    flexBasis: "30%",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  listRow: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  listRowBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  listRowMeta: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginTop: 6,
  },
  textarea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    minHeight: 72,
    textAlignVertical: "top",
  },
  helper: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
