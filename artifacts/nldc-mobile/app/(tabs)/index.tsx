import { Feather } from "@expo/vector-icons";
import {
  getGetCoachFollowUpStatsQueryKey,
  getGetMirrorTrendsQueryKey,
  useGetAuditSummary,
  useGetCoachFollowUpStats,
  useGetMirrorTrends,
  useListJournalEntries,
  useListPostDateNotes,
  getListJournalEntriesQueryKey,
  getListPostDateNotesQueryKey,
} from "@workspace/api-client-react";
import { useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";

import { ScoreRing } from "@/components/ScoreRing";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

const DEMO_HISTORY = [
  { date: "2025-04-01", score: 58 },
  { date: "2025-04-09", score: 64 },
  { date: "2025-04-18", score: 71 },
  { date: "2025-04-27", score: 76 },
  { date: "2025-05-05", score: 80 },
  { date: "2025-05-14", score: 84 },
];

const DEMO_STRENGTHS = [
  "Bio shows genuine specificity",
  "Photos vary in setting",
  "Opening messages reference profile",
];

const DEMO_RISKS = [
  "Prompts lean generic",
  "Few prompts about future plans",
];

interface ScoreHistoryPoint {
  date: string;
  score: number;
}

function Sparkline({ history }: { history: ScoreHistoryPoint[] }) {
  const colors = useColors();
  const width = 280;
  const height = 70;
  const padding = 8;

  if (history.length < 2) return null;

  const min = Math.min(...history.map((h) => h.score));
  const max = Math.max(...history.map((h) => h.score));
  const range = Math.max(1, max - min);

  const points = history
    .map((h, i) => {
      const x = padding + (i * (width - padding * 2)) / (history.length - 1);
      const y =
        height -
        padding -
        ((h.score - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={colors.violet}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ScoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isFetching } = useGetAuditSummary();
  const { isAuthenticated, user } = useAuth();
  const firstName = user?.firstName?.trim();
  const followUpStatsQueryKey = useMemo(
    () => getGetCoachFollowUpStatsQueryKey(),
    [],
  );
  const { data: sendStats } = useGetCoachFollowUpStats({
    query: { queryKey: followUpStatsQueryKey, enabled: isAuthenticated },
  });
  const mirrorTrendsQueryKey = useMemo(() => getGetMirrorTrendsQueryKey(), []);
  const { data: mirror } = useGetMirrorTrends({
    query: { queryKey: mirrorTrendsQueryKey, enabled: isAuthenticated },
  });
  const router = useRouter();
  const journalParams = useMemo(() => ({ view: "active" as const, limit: 3 }), []);
  const journalKey = useMemo(
    () => getListJournalEntriesQueryKey(journalParams),
    [journalParams],
  );
  const { data: journalList } = useListJournalEntries(journalParams, {
    query: { queryKey: journalKey, enabled: isAuthenticated },
  });
  const datesParams = useMemo(() => ({ view: "active" as const, limit: 3 }), []);
  const datesKey = useMemo(
    () => getListPostDateNotesQueryKey(datesParams),
    [datesParams],
  );
  const { data: datesList } = useListPostDateNotes(datesParams, {
    query: { queryKey: datesKey, enabled: isAuthenticated },
  });
  const recentReflections = journalList?.entries ?? [];
  const recentDates = datesList?.notes ?? [];

  const sendThroughRate =
    sendStats && sendStats.totalPrompts > 0
      ? Math.round((sendStats.sentCount / sendStats.totalPrompts) * 100)
      : 0;

  const summary = useMemo(() => {
    if (data && data.totalAudits > 0) {
      return {
        score: data.latestScore ?? Math.round(data.averageScore),
        average: data.averageScore,
        total: data.totalAudits,
        history:
          data.scoreHistory.length > 1 ? data.scoreHistory : DEMO_HISTORY,
        strengths: data.topStrengths.length ? data.topStrengths : DEMO_STRENGTHS,
        risks: data.topRisks.length ? data.topRisks : DEMO_RISKS,
        demo: false,
      };
    }
    return {
      score: 84,
      average: 76.5,
      total: 6,
      history: DEMO_HISTORY,
      strengths: DEMO_STRENGTHS,
      risks: DEMO_RISKS,
      demo: true,
    };
  }, [data]);

  const trend =
    summary.history.length > 1
      ? summary.history[summary.history.length - 1].score -
        summary.history[0].score
      : 0;

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          eyebrow="Echo"
          title={
            firstName ? `Hey ${firstName}, here's where we are.` : "Here's where we are."
          }
          subtitle={
            summary.demo
              ? "A sample read for now. Run a profile check on the web and I'll show you your real number."
              : `Your read across ${summary.total} check${summary.total === 1 ? "" : "s"}, averaging ${summary.average.toFixed(1)}.`
          }
        />

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {isError ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: `${colors.destructive}22`, borderColor: colors.destructive },
            ]}
          >
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              Couldn't reach the API, showing demo data.
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.ringCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <ScoreRing score={summary.score} />
          <View
            style={[
              styles.trendPill,
              {
                backgroundColor:
                  trend >= 0 ? `${colors.success}22` : `${colors.destructive}22`,
              },
            ]}
          >
            <Feather
              name={trend >= 0 ? "trending-up" : "trending-down"}
              size={14}
              color={trend >= 0 ? colors.success : colors.destructive}
            />
            <Text
              style={[
                styles.trendText,
                { color: trend >= 0 ? colors.success : colors.destructive },
              ]}
            >
              {trend >= 0 ? "+" : ""}
              {trend} pts over {summary.history.length} audits
            </Text>
          </View>
          <View style={styles.sparkWrap}>
            <Sparkline history={summary.history} />
          </View>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.success}22` }]}
            >
              <Feather name="check-circle" size={16} color={colors.success} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Strengths
            </Text>
          </View>
          {summary.strengths.map((item, i) => (
            <View key={`s-${i}`} style={styles.item}>
              <View style={[styles.bullet, { backgroundColor: colors.success }]} />
              <Text style={[styles.itemText, { color: colors.foreground }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.rose}22` }]}
            >
              <Feather name="alert-triangle" size={16} color={colors.rose} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Risks to fix
            </Text>
          </View>
          {summary.risks.map((item, i) => (
            <View key={`r-${i}`} style={styles.item}>
              <View style={[styles.bullet, { backgroundColor: colors.rose }]} />
              <Text style={[styles.itemText, { color: colors.foreground }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.violet}22` }]}
            >
              <Feather name="send" size={16} color={colors.violet} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Send-through rate
            </Text>
          </View>
          {sendStats && sendStats.totalPrompts > 0 ? (
            <>
              <View style={styles.sendStatsRow}>
                <View style={styles.sendStat}>
                  <Text
                    style={[styles.sendStatValue, { color: colors.foreground }]}
                  >
                    {sendThroughRate}%
                  </Text>
                  <Text
                    style={[
                      styles.sendStatLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Sent
                  </Text>
                </View>
                <View style={styles.sendStat}>
                  <Text
                    style={[styles.sendStatValue, { color: colors.foreground }]}
                  >
                    {sendStats.sentCount}
                  </Text>
                  <Text
                    style={[
                      styles.sendStatLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Replies sent
                  </Text>
                </View>
                <View style={styles.sendStat}>
                  <Text
                    style={[styles.sendStatValue, { color: colors.foreground }]}
                  >
                    {sendStats.totalPrompts}
                  </Text>
                  <Text
                    style={[
                      styles.sendStatLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Prompts
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.sendBarTrack,
                  { backgroundColor: `${colors.violet}22` },
                ]}
              >
                <View
                  style={[
                    styles.sendBarFill,
                    {
                      backgroundColor: colors.violet,
                      width: `${sendThroughRate}%`,
                    },
                  ]}
                />
              </View>
              {sendStats.notSentCount > 0 ? (
                <Text
                  style={[
                    styles.sendDeferText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  <Feather name="clock" size={11} color={colors.mutedForeground} />
                  {"  "}
                  {`${sendStats.notSentCount} still thinking`}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Draft a reply in Coach and Echo will check in with you a couple of
              hours later. Once you've answered a few of those nudges, your
              send-through rate shows up here.
            </Text>
          )}
        </View>

        {mirror && mirror.hasEnoughData ? (
          <Pressable
            onPress={() => router.push("/mirror" as Href)}
            style={[
              styles.section,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View
                style={[styles.iconBubble, { backgroundColor: `${colors.gold}22` }]}
              >
                <Feather name="eye" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Your Mirror
              </Text>
              <View style={styles.mirrorOpen}>
                <Text
                  style={[
                    styles.mirrorOpenText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Open
                </Text>
                <Feather
                  name="chevron-right"
                  size={14}
                  color={colors.mutedForeground}
                />
              </View>
            </View>
            <Text style={[styles.mirrorHeadline, { color: colors.foreground }]}>
              {mirror.headlineInsight}
            </Text>
            <View style={styles.mirrorMetaRow}>
              <View style={styles.mirrorMetaItem}>
                <Text
                  style={[styles.sendStatValue, { color: colors.foreground }]}
                >
                  {mirror.readinessScore}
                </Text>
                <Text
                  style={[
                    styles.sendStatLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Readiness
                </Text>
              </View>
              <View style={styles.mirrorMetaItem}>
                <Text
                  style={[styles.sendStatValue, { color: colors.foreground }]}
                >
                  {mirror.scoreDelta.delta > 0 ? "+" : ""}
                  {mirror.scoreDelta.delta}
                </Text>
                <Text
                  style={[
                    styles.sendStatLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Score delta
                </Text>
              </View>
              <View style={styles.mirrorMetaItem}>
                <Text
                  style={[styles.sendStatValue, { color: colors.foreground }]}
                >
                  {mirror.recurringRisks.length}
                </Text>
                <Text
                  style={[
                    styles.sendStatLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Risks to fix
                </Text>
              </View>
            </View>
            {mirror.readinessSignals.slice(0, 2).map((sig, i) => (
              <View key={`sig-${i}`} style={styles.item}>
                <View
                  style={[
                    styles.bullet,
                    {
                      backgroundColor:
                        sig.tone === "positive"
                          ? colors.success
                          : sig.tone === "watch"
                          ? colors.rose
                          : colors.mutedForeground,
                    },
                  ]}
                />
                <Text
                  style={[styles.itemText, { color: colors.foreground }]}
                >
                  {sig.label}
                </Text>
              </View>
            ))}
          </Pressable>
        ) : null}

        <Pressable
          testID="card-recent-reflections"
          onPress={() => router.push("/journal" as Href)}
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.gold}22` }]}
            >
              <Feather name="book-open" size={16} color={colors.gold} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Recent reflections
            </Text>
            <View style={styles.mirrorOpen}>
              <Text
                style={[
                  styles.mirrorOpenText,
                  { color: colors.mutedForeground },
                ]}
              >
                View all
              </Text>
              <Feather
                name="chevron-right"
                size={14}
                color={colors.mutedForeground}
              />
            </View>
          </View>
          {recentReflections.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Build a Weekly Growth Plan on the web to start your journal.
            </Text>
          ) : (
            recentReflections.map((e) => (
              <View key={e.id} style={styles.item} testID={`row-recent-journal-${e.id}`}>
                <View
                  style={[styles.bullet, { backgroundColor: colors.gold }]}
                />
                <Text
                  style={[styles.itemText, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {e.prompt ? `${e.prompt}, ` : ""}
                  {e.body}
                </Text>
              </View>
            ))
          )}
        </Pressable>

        <Pressable
          testID="card-last-dates"
          onPress={() => router.push("/dates" as Href)}
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.rose}22` }]}
            >
              <Feather name="heart" size={16} color={colors.rose} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Last 3 dates
            </Text>
            <View style={styles.mirrorOpen}>
              <Text
                style={[
                  styles.mirrorOpenText,
                  { color: colors.mutedForeground },
                ]}
              >
                View all
              </Text>
              <Feather
                name="chevron-right"
                size={14}
                color={colors.mutedForeground}
              />
            </View>
          </View>
          {recentDates.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Run a Debrief on the web after your next date to capture what
              happened.
            </Text>
          ) : (
            recentDates.map((n) => (
              <View key={n.id} style={styles.item} testID={`row-recent-date-${n.id}`}>
                <View
                  style={[styles.bullet, { backgroundColor: colors.rose }]}
                />
                <Text
                  style={[styles.itemText, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {n.personLabel ? `${n.personLabel}, ` : ""}
                  {n.summary}
                </Text>
              </View>
            ))
          )}
        </Pressable>

        <View
          style={[
            styles.footerCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Feather name="zap" size={18} color={colors.gold} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Echo's in the Coach tab when a match replies, or in Next to help you draft an opener you'll actually send.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  loading: { paddingVertical: 30, alignItems: "center" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  ringCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 18,
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  trendText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  sparkWrap: { alignItems: "center" },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  itemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 20,
  },
  sendStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  sendStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  sendStatValue: {
    fontSize: 22,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  sendStatLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sendBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 6,
  },
  sendBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  sendDeferText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
  },
  footerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
  },
  mirrorHeadline: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 20,
    marginBottom: 6,
  },
  mirrorMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 6,
  },
  mirrorMetaItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  mirrorOpen: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mirrorOpenText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});

function openWeb(path: string): void {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return;
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  Linking.openURL(`${base}${path}`).catch(() => {
    /* user dismissed or no handler, no-op */
  });
}
