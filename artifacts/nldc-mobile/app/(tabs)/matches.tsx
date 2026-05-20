import { Feather } from "@expo/vector-icons";
import { useListAudits } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";

interface DemoMatch {
  id: number;
  firstName: string;
  readinessScore: number | null;
  bio: string;
  createdAt: string;
  isDemo: true;
}

const DEMO_MATCHES: DemoMatch[] = [
  {
    id: -1,
    firstName: "Hinge match",
    readinessScore: 78,
    bio: "29 · designer in Brooklyn. Sourdough hobbyist, big into film photography, recovering perfectionist. Looking for someone curious and kind.",
    createdAt: new Date().toISOString(),
    isDemo: true,
  },
  {
    id: -2,
    firstName: "Bumble match",
    readinessScore: 64,
    bio: "Marketing manager, runs half marathons on weekends. Trying to read 30 books this year. Dog mom to a very dramatic corgi.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isDemo: true,
  },
  {
    id: -3,
    firstName: "Tinder match",
    readinessScore: 52,
    bio: "Just here for a good time. Love travel, food, and dogs. Ask me about my last trip.",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isDemo: true,
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function scoreColor(
  score: number | null,
  colors: ReturnType<typeof useColors>,
): string {
  if (score === null) return colors.mutedForeground;
  if (score >= 75) return colors.success;
  if (score >= 55) return colors.gold;
  return colors.rose;
}

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, isRefetching, refetch, error } = useListAudits({
    source: "screenshot",
  });

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  const audits = (data ?? []).slice().reverse();
  const showDemo = !isLoading && audits.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          eyebrow="My Matches"
          title="Profiles you've scanned"
          subtitle="Every screenshot you audit lands here. Tap one to re-open its mini-report."
        />

        {isLoading ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading your matches…
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: `${colors.destructive}22`,
                borderColor: colors.destructive,
              },
            ]}
          >
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              Couldn't load your matches. Pull down to retry.
            </Text>
          </View>
        ) : null}

        {showDemo ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={[styles.iconBubble, { backgroundColor: `${colors.violet}22` }]}>
              <Feather name="camera" size={18} color={colors.violet} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No scans yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Audit a profile from the Scan tab and it'll show up here so you
              can flick back through it later.
            </Text>
            <View style={styles.demoLabelRow}>
              <View
                style={[
                  styles.demoChip,
                  { backgroundColor: `${colors.gold}22`, borderColor: colors.gold },
                ]}
              >
                <Text style={[styles.demoChipText, { color: colors.gold }]}>
                  Sample
                </Text>
              </View>
              <Text style={[styles.demoLabel, { color: colors.mutedForeground }]}>
                What it'll look like
              </Text>
            </View>
            {DEMO_MATCHES.map((m) => (
              <MatchRow
                key={`demo-${m.id}`}
                firstName={m.firstName}
                readinessScore={m.readinessScore}
                bio={m.bio}
                createdAt={m.createdAt}
                disabled
              />
            ))}
          </View>
        ) : null}

        {!showDemo && audits.length > 0 ? (
          <View style={styles.list}>
            {audits.map((audit) => (
              <MatchRow
                key={audit.id}
                firstName={audit.firstName}
                readinessScore={audit.readinessScore ?? null}
                bio={audit.bio}
                createdAt={audit.createdAt}
                onPress={() => router.push(`/audit/${audit.id}` as never)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MatchRow({
  firstName,
  readinessScore,
  bio,
  createdAt,
  onPress,
  disabled,
}: {
  firstName: string;
  readinessScore: number | null;
  bio: string;
  createdAt: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const thumbnail = bio.trim().slice(0, 110);
  const ring = scoreColor(readinessScore, colors);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: disabled ? 0.85 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.scoreBubble, { borderColor: ring }]}>
        <Text style={[styles.scoreText, { color: ring }]}>
          {readinessScore ?? "—"}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text
            style={[styles.rowName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {firstName}
          </Text>
          <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>
            {formatDate(createdAt)}
          </Text>
        </View>
        <Text
          style={[styles.rowBio, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {thumbnail || "No bio text extracted."}
        </Text>
      </View>
      {!disabled ? (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  loadingCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  loadingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
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
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_500Medium",
    marginBottom: 6,
  },
  demoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
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
  demoLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  scoreBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  rowBody: { flex: 1, gap: 4 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  rowDate: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  rowBio: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
