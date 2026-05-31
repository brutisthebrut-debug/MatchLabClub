import { Feather } from "@expo/vector-icons";
import {
  getGetMatchingStateQueryKey,
  getGetMirrorPortraitQueryKey,
  useGetMatchingState,
  useGetMirrorPortrait,
  type MatchingState,
  type MirrorPortrait,
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

import { ScoreRing } from "@/components/ScoreRing";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

// A demo portrait so the screen never looks empty before sign-in or a first
// signal. Mirrors the web "Sample view, sign in for your own" fallback.
const DEMO_PORTRAIT: MirrorPortrait = {
  readinessScore: 58,
  stage: "forming",
  stageLabel: "Patterns forming",
  stageBlurb:
    "Enough signal for the machine to see how you connect, not just what you say you want.",
  coveragePercent: 46,
  headline:
    "We can see how you open a conversation and how you talk about what you want. We cannot see yet how you show up after a few dates.",
  known: [
    {
      key: "compass",
      label: "How you connect",
      coverage: 70,
      confidence: 64,
      insight:
        "Your compass read points to a slow, deliberate opener who invests once trust is there.",
      dimensions: ["attachment", "pace"],
    },
    {
      key: "coaching",
      label: "How you message",
      coverage: 52,
      confidence: 48,
      insight:
        "Your openers reference the other person, which is a strong, specific habit.",
      dimensions: ["communication"],
    },
  ],
  blindSpots: [
    {
      key: "postDate",
      label: "How dates actually go",
      why: "No debriefs yet, so we cannot see what happens once you meet in person.",
      actionLabel: "Log a debrief",
      href: "/dates",
    },
    {
      key: "wellness",
      label: "What you need to feel steady",
      why: "Your wellness profile is mostly empty, so reads stay surface level.",
      actionLabel: "Answer a few questions",
      href: "/self-hub",
    },
  ],
  nextSignal: {
    key: "compass",
    label: "Run a Compatibility Compass read",
    detail:
      "Ten minutes, and it gives the machine the clearest single read on how you connect.",
    href: "/compass",
    points: 12,
  },
  outcomeHeadline:
    "The more the machine knows you, the better it matches you with people near you.",
  totalDates: 0,
  eligible: false,
  threshold: 50,
  engineVersion: "demo",
};

const DEMO_NEXT_ACTION = {
  key: "compass",
  label: "Run a Compatibility Compass read",
  detail:
    "Ten minutes, and it gives the machine the clearest single read on how you connect.",
  points: 12,
  href: "/compass",
};

// Compact port of the web climb model (lib/climb.ts + lib/milestones.ts). The
// climb is a gamified lens over the same readiness score; it never changes the
// number. Kept inline because artifacts cannot import across each other.
interface ClimbView {
  level: number;
  totalLevels: number;
  stageTitle: string;
  pointsToNext: number;
  progressToNextPct: number;
  eligible: boolean;
  nextTitle: string | null;
}

function computeClimb(score: number, threshold: number): ClimbView {
  const safeScore = Number.isFinite(score)
    ? Math.min(100, Math.max(0, Math.round(score)))
    : 0;
  const readyThreshold = Number.isFinite(threshold)
    ? Math.min(100, Math.max(1, Math.round(threshold)))
    : 50;

  const steps = new Map<number, string>();
  steps.set(1, "First signals");
  steps.set(25, "Patterns forming");
  steps.set(75, "Dialed in");
  steps.set(readyThreshold, "Match ready");

  const ladder = [...steps.entries()]
    .map(([t, title]) => ({ threshold: t, title }))
    .sort((a, b) => a.threshold - b.threshold);

  const cleared = ladder.filter((m) => safeScore >= m.threshold);
  const next = ladder.find((m) => safeScore < m.threshold);
  const current = cleared[cleared.length - 1];

  const bandStart = current ? current.threshold : 0;
  const bandEnd = next ? next.threshold : 100;
  const span = Math.max(1, bandEnd - bandStart);

  return {
    level: cleared.length,
    totalLevels: ladder.length,
    stageTitle: current ? current.title : "Getting started",
    pointsToNext: next ? Math.max(0, next.threshold - safeScore) : 0,
    progressToNextPct: next
      ? Math.min(100, Math.max(0, Math.round(((safeScore - bandStart) / span) * 100)))
      : 100,
    eligible: safeScore >= readyThreshold,
    nextTitle: next ? next.title : null,
  };
}

// Mobile has a subset of the web routes. Map the action hrefs the server emits
// to a native screen when one exists, and open the web app otherwise so no CTA
// dead-ends.
const MOBILE_ROUTES: Record<string, Href> = {
  "/compass": "/compass" as Href,
  "/journal": "/journal" as Href,
  "/dates": "/dates" as Href,
  "/post-date": "/dates" as Href,
  "/imports": "/imports" as Href,
  "/hinge": "/imports" as Href,
  "/coach": "/coach" as Href,
  "/scan": "/scan" as Href,
  "/account": "/account" as Href,
  "/self-hub": "/self-hub" as Href,
  "/me": "/self-hub" as Href,
};

function openWeb(path: string): void {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  if (!base) return;
  Linking.openURL(`${base}${path}`).catch(() => {});
}

export default function MirrorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();

  const portraitQuery = useGetMirrorPortrait({
    query: {
      queryKey: getGetMirrorPortraitQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const matchingQuery = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const portrait: MirrorPortrait = portraitQuery.data ?? DEMO_PORTRAIT;
  const matching: MatchingState | undefined = matchingQuery.data;
  const isSignedOut = !isAuthenticated;
  const showLoading =
    isAuthenticated && portraitQuery.isLoading && !portraitQuery.data;
  const showError =
    isAuthenticated && portraitQuery.isError && !portraitQuery.data;

  const climb = useMemo(
    () =>
      computeClimb(
        portrait.readinessScore,
        portrait.threshold,
      ),
    [portrait.readinessScore, portrait.threshold],
  );

  const nextAction = useMemo(() => {
    const fromMatching = matching?.nextActions?.[0];
    if (fromMatching) return fromMatching;
    if (portrait.nextSignal) {
      return {
        key: portrait.nextSignal.key,
        label: portrait.nextSignal.label,
        detail: portrait.nextSignal.detail,
        points: portrait.nextSignal.points,
        href: portrait.nextSignal.href,
      };
    }
    return isSignedOut ? DEMO_NEXT_ACTION : null;
  }, [matching, portrait.nextSignal, isSignedOut]);

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  function goToAction(href: string) {
    const mobile = MOBILE_ROUTES[href];
    if (mobile) {
      router.push(mobile);
      return;
    }
    openWeb(href);
  }

  const refreshing =
    (portraitQuery.isFetching && !portraitQuery.isLoading) ||
    (matchingQuery.isFetching && !matchingQuery.isLoading);

  function refetchAll() {
    void portraitQuery.refetch();
    void matchingQuery.refetch();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetchAll}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          eyebrow="Your Mirror"
          title="What the machine knows about you"
          subtitle={portrait.stageBlurb}
        />

        {isSignedOut ? (
          <View
            testID="mirror-demo-banner"
            style={[
              styles.demoBanner,
              { backgroundColor: `${colors.gold}22`, borderColor: colors.gold },
            ]}
          >
            <Feather name="eye" size={15} color={colors.gold} />
            <Text style={[styles.demoBannerText, { color: colors.gold }]}>
              Sample view. Sign in to see your own Mirror.
            </Text>
          </View>
        ) : null}

        {showLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {showError ? (
          <View
            testID="mirror-error-banner"
            style={[
              styles.demoBanner,
              {
                backgroundColor: `${colors.destructive}22`,
                borderColor: colors.destructive,
              },
            ]}
          >
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text
              style={[styles.demoBannerText, { color: colors.destructive }]}
            >
              We could not load your Mirror just now. Pull down to try again.
            </Text>
          </View>
        ) : null}

        {/* Headline portrait */}
        <View
          style={[
            styles.headlineCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.headlineText, { color: colors.foreground }]}>
            {portrait.headline}
          </Text>
          <View style={styles.coverageRow}>
            <View
              style={[
                styles.coverageTrack,
                { backgroundColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.coverageFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.max(0, Math.min(100, portrait.coveragePercent))}%`,
                  },
                ]}
              />
            </View>
            <Text
              style={[styles.coverageLabel, { color: colors.mutedForeground }]}
            >
              {Math.round(portrait.coveragePercent)}% of you mapped so far
            </Text>
          </View>
        </View>

        {/* Readiness gauge + climb */}
        <View
          style={[
            styles.ringCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <ScoreRing score={portrait.readinessScore} label="Readiness" />

          <View style={styles.climbHeader}>
            <Text style={[styles.climbStage, { color: colors.foreground }]}>
              {climb.stageTitle}
            </Text>
            <Text style={[styles.climbLevel, { color: colors.mutedForeground }]}>
              Level {climb.level} of {climb.totalLevels}
            </Text>
          </View>

          <View
            style={[styles.barTrack, { backgroundColor: `${colors.violet}22` }]}
          >
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: colors.violet,
                  width: `${climb.progressToNextPct}%`,
                },
              ]}
            />
          </View>

          {climb.eligible ? (
            <View style={styles.eligibleRow}>
              <Feather name="check-circle" size={15} color={colors.success} />
              <Text style={[styles.eligibleText, { color: colors.success }]}>
                You are match ready. The introductions pool is open to you.
              </Text>
            </View>
          ) : (
            <Text style={[styles.climbHint, { color: colors.mutedForeground }]}>
              {climb.nextTitle
                ? `${climb.pointsToNext} more readiness to reach ${climb.nextTitle}.`
                : "You have cleared the full climb."}
            </Text>
          )}
        </View>

        {/* Next best action */}
        {nextAction ? (
          <View
            testID="mirror-next-action"
            style={[
              styles.section,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View
                style={[styles.iconBubble, { backgroundColor: `${colors.gold}22` }]}
              >
                <Feather name="zap" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Your next best move
              </Text>
            </View>
            <Text style={[styles.actionLabel, { color: colors.foreground }]}>
              {nextAction.label}
            </Text>
            <Text style={[styles.actionDetail, { color: colors.mutedForeground }]}>
              {nextAction.detail}
            </Text>
            <View style={styles.actionFooter}>
              <View
                style={[
                  styles.pointsPill,
                  { backgroundColor: `${colors.violet}22` },
                ]}
              >
                <Feather name="trending-up" size={12} color={colors.violet} />
                <Text style={[styles.pointsText, { color: colors.violet }]}>
                  +{nextAction.points} readiness
                </Text>
              </View>
              <Pressable
                testID="mirror-next-action-cta"
                onPress={() => goToAction(nextAction.href)}
                style={({ pressed }) => [
                  styles.startBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text
                  style={[styles.startBtnText, { color: colors.primaryForeground }]}
                >
                  Start
                </Text>
                <Feather
                  name="arrow-right"
                  size={14}
                  color={colors.primaryForeground}
                />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* What we can see */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.teal}22` }]}
            >
              <Feather name="check-circle" size={16} color={colors.teal} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              What we can see
            </Text>
          </View>
          {portrait.known.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Feed your first signal and this fills in.
            </Text>
          ) : (
            portrait.known.map((dim) => (
              <View key={dim.key} style={styles.knownRow}>
                <View style={styles.knownTop}>
                  <Text style={[styles.knownLabel, { color: colors.foreground }]}>
                    {dim.label}
                  </Text>
                  <Text
                    style={[styles.knownMeta, { color: colors.mutedForeground }]}
                  >
                    {dim.coverage}% seen, {dim.confidence}% sure
                  </Text>
                </View>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: `${colors.teal}22` },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      { backgroundColor: colors.teal, width: `${dim.coverage}%` },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.knownInsight, { color: colors.mutedForeground }]}
                >
                  {dim.insight}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Blind spots */}
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
              <Feather name="help-circle" size={16} color={colors.rose} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              What we cannot see yet
            </Text>
          </View>
          {portrait.blindSpots.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nothing major is missing right now. Keep feeding signals to stay
              sharp.
            </Text>
          ) : (
            portrait.blindSpots.map((spot) => (
              <View
                key={spot.key}
                style={[
                  styles.blindCard,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.blindLabel, { color: colors.foreground }]}>
                  {spot.label}
                </Text>
                <Text
                  style={[styles.blindWhy, { color: colors.mutedForeground }]}
                >
                  {spot.why}
                </Text>
                <Pressable
                  onPress={() => goToAction(spot.href)}
                  style={styles.blindCta}
                >
                  <Text style={[styles.blindCtaText, { color: colors.violet }]}>
                    {spot.actionLabel}
                  </Text>
                  <Feather name="arrow-right" size={13} color={colors.violet} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Outcome tie-in */}
        <View
          style={[
            styles.outcomeCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Feather name="compass" size={18} color={colors.gold} />
          <Text style={[styles.outcomeText, { color: colors.mutedForeground }]}>
            {portrait.outcomeHeadline}
          </Text>
        </View>

        {isSignedOut && !authLoading ? (
          <Pressable
            testID="mirror-signin"
            onPress={() => {
              void login();
            }}
            style={({ pressed }) => [
              styles.signInBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="log-in" size={15} color={colors.primaryForeground} />
            <Text
              style={[styles.signInText, { color: colors.primaryForeground }]}
            >
              Sign in to see your own Mirror
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  loading: { paddingVertical: 20, alignItems: "center" },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  demoBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  headlineCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  headlineText: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  coverageRow: { marginTop: 14, gap: 8 },
  coverageTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  coverageFill: { height: 8, borderRadius: 999 },
  coverageLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  ringCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    gap: 16,
  },
  climbHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    width: "100%",
  },
  climbStage: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  climbLevel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  barTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999 },
  eligibleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  eligibleText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    lineHeight: 18,
  },
  climbHint: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    alignSelf: "flex-start",
  },
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
    marginBottom: 2,
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
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
    lineHeight: 22,
  },
  actionDetail: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pointsText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  startBtnText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  knownRow: { gap: 6, marginBottom: 4 },
  knownTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  knownLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  knownMeta: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  knownInsight: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  blindCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  blindLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  blindWhy: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  blindCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  blindCtaText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  outcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  outcomeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  signInBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  signInText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
