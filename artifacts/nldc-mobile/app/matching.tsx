import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMatchingProposalsQueryKey,
  getGetMatchingStateQueryKey,
  getGetVerificationQueryKey,
  useCreateMatchingEchoRead,
  useDiscoverMatches,
  useGetMatchingProposals,
  useGetMatchingState,
  useGetVerification,
  useRespondToMatchProposal,
  useUpdateMatchingPoolMembership,
  useUpdateMatchingPreferences,
  type EchoMatchRead,
  type MatchProposal,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreRing } from "@/components/ScoreRing";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

// Matching is radius based in miles. We store kilometers on the server, so the
// presets map miles to their rounded km equivalent.
const RADIUS_PRESETS: { value: string; label: string }[] = [
  { value: "any", label: "Any distance" },
  { value: "40", label: "Within 25 miles" },
  { value: "56", label: "Within 35 miles" },
  { value: "72", label: "Within 45 miles" },
];

// Open to every gender and orientation. The values mirror the web option set so
// existing preferences hydrate cleanly.
const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "Open to all" },
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "nonbinary", label: "Nonbinary" },
  { value: "trans-women", label: "Trans women" },
  { value: "trans-men", label: "Trans men" },
];

const GENDER_VALUES = GENDER_OPTIONS.map((o) => o.value);

// Human labels for each proposal status, plus a note for resolved states so a
// non-open proposal is never a dead end on the page.
const PROPOSAL_STATUS_META: Record<
  string,
  { label: string; tone: "good" | "muted"; note: string }
> = {
  proposed: { label: "Awaiting you", tone: "good", note: "" },
  user_yes: {
    label: "You said yes",
    tone: "good",
    note: "The founder routes interested intros to the front of the queue. We will be in touch.",
  },
  user_no: {
    label: "You passed",
    tone: "muted",
    note: "We will not bring this one back.",
  },
  mutual_yes: {
    label: "Mutual yes",
    tone: "good",
    note: "Both of you are in. The founder sets up the intro from here.",
  },
  completed: {
    label: "Intro made",
    tone: "good",
    note: "This intro has been made. How it goes is up to the two of you.",
  },
  expired: {
    label: "Expired",
    tone: "muted",
    note: "This one timed out before it moved forward.",
  },
};

// Human label for where a proposal came from, so an internal member match never
// shows the raw "internal" source string and an external read reads cleanly.
function proposalSourceLabel(source: string): string {
  if (source === "internal") return "Member match";
  if (source === "external_paste") return "Profile read";
  if (source === "concierge") return "Founder pick";
  return "Intro";
}

// Snap any stored distance to the nearest preset so the selector always has a
// matching option, even for historical values saved before presets existed.
function snapRadiusKm(km: number | null | undefined): string {
  if (km == null) return "any";
  let nearest = RADIUS_PRESETS[1];
  let best = Infinity;
  for (const preset of RADIUS_PRESETS) {
    if (preset.value === "any") continue;
    const diff = Math.abs(Number(preset.value) - km);
    if (diff < best) {
      best = diff;
      nearest = preset;
    }
  }
  return nearest.value;
}

function normalizeGenderPreference(value: string | null | undefined): string {
  if (!value) return "any";
  return GENDER_VALUES.includes(value) ? value : "any";
}

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: number; response?: { status?: number } };
  return e?.status ?? e?.response?.status;
}

function openWeb(path: string): void {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  if (!base) return;
  Linking.openURL(`${base}${path}`).catch(() => {});
}

// Demo content so the screen never looks empty for a brand new or signed out
// member. Mirrors the web "sample view, sign in for your own" fallback.
const DEMO_PROPOSALS: MatchProposal[] = [
  {
    id: "demo-1",
    userId: "demo",
    proposedToUserId: null,
    source: "internal",
    compatibilityScore: 82,
    summary:
      "You both move slow and ask real questions. The machine sees a steady pace and shared curiosity.",
    status: "proposed",
    cosmicResonance: 71,
    cosmicResonanceNote: "Two earth signs who like a plan. For fun only.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-2",
    userId: "demo",
    proposedToUserId: null,
    source: "concierge",
    compatibilityScore: 76,
    summary:
      "A founder pick. Direct communicator who values follow through, which lines up with your signals.",
    status: "mutual_yes",
    cosmicResonance: null,
    cosmicResonanceNote: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const DEMO_ECHO: EchoMatchRead = {
  headline:
    "You open slow and invest once trust is there. That reads as steady to the right person.",
  confidence: 62,
  reading: [
    "You ask specific questions early, which lands as genuine interest.",
    "Your pace is deliberate, so you do better with people who do not rush.",
  ],
  idealMatch: [
    "Someone curious who trades real questions, not one word replies.",
    "A person comfortable letting a connection build over a few conversations.",
  ],
  radiusLabel: "inside your 35 mile radius",
  gapToPool: 12,
  nextStep: { label: "Run a compass read", href: "/compass" },
  usedAi: false,
};

type Banner = { kind: "success" | "error"; text: string } | null;

export default function MatchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const isSignedOut = !isAuthenticated;

  const state = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const proposals = useGetMatchingProposals({
    query: {
      queryKey: getGetMatchingProposalsQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const verificationQuery = useGetVerification({
    query: {
      queryKey: getGetVerificationQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const updatePrefs = useUpdateMatchingPreferences();
  const updatePool = useUpdateMatchingPoolMembership();
  const runEcho = useCreateMatchingEchoRead();
  const respondProposal = useRespondToMatchProposal();
  const discover = useDiscoverMatches();

  const [ageMin, setAgeMin] = useState<string>("25");
  const [ageMax, setAgeMax] = useState<string>("45");
  const [distanceKm, setDistanceKm] = useState<string>("any");
  const [genderPreference, setGenderPreference] = useState<string>("any");
  const [cityHint, setCityHint] = useState<string>("");
  const [dealBreakers, setDealBreakers] = useState<string[]>([]);
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [dealBreakerDraft, setDealBreakerDraft] = useState("");
  const [mustHaveDraft, setMustHaveDraft] = useState("");
  const [echoResult, setEchoResult] = useState<EchoMatchRead | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  const prefs = state.data?.preferences ?? null;

  // Hydrate the editable form from server preferences exactly once. A later
  // background refetch returns a fresh object identity, so keying the effect on
  // `prefs` alone would clobber edits in progress; the ref guards against that.
  const prefsHydratedRef = useRef(false);
  useEffect(() => {
    if (!prefs || prefsHydratedRef.current) return;
    prefsHydratedRef.current = true;
    if (typeof prefs.ageMin === "number") setAgeMin(String(prefs.ageMin));
    if (typeof prefs.ageMax === "number") setAgeMax(String(prefs.ageMax));
    setDistanceKm(snapRadiusKm(prefs.distanceKm));
    setGenderPreference(normalizeGenderPreference(prefs.genderPreference));
    setCityHint(prefs.cityHint ?? "");
    setDealBreakers(prefs.dealBreakers ?? []);
    setMustHaves(prefs.mustHaves ?? []);
  }, [prefs]);

  // Echo's read is on demand (mirrors web): a signed-in member taps to spend a
  // single Claude credit. Failures stay quiet so the card simply offers a retry.
  function handleEchoRead(): void {
    if (!isAuthenticated) return;
    runEcho.mutate(undefined, {
      onSuccess: (result) => setEchoResult(result),
      onError: () => {},
    });
  }

  const isVerified = verificationQuery.data?.isVerified ?? false;
  const selfieVerified = verificationQuery.data?.selfieVerified ?? false;
  const idVerified = verificationQuery.data?.idVerified ?? false;
  const ageOver18 = verificationQuery.data?.ageOver18 ?? false;

  const readinessScore =
    state.data?.readiness.score ?? (isSignedOut ? 58 : 0);
  const readinessThreshold = state.data?.readinessThreshold ?? 50;
  const eligible = state.data?.eligible ?? false;
  const poolStatus = state.data?.poolStatus ?? "off";
  const poolToggleOn = poolStatus !== "off" && poolStatus !== "paused";
  // Lock the opt in until readiness clears the bar, but only once we have
  // confirmed server state so a load never flashes a false ineligible message.
  const poolLocked = Boolean(state.data) && !poolToggleOn && !eligible;
  const cityDensity = state.data?.cityDensity ?? 0;
  const totalPool = state.data?.totalPoolCount ?? 0;
  const tier = state.data?.tier ?? null;
  const pointsToPool = Math.max(0, readinessThreshold - readinessScore);

  const proposalList: MatchProposal[] = isSignedOut
    ? DEMO_PROPOSALS
    : proposals.data ?? [];

  const echoView = echoResult ?? (isSignedOut ? DEMO_ECHO : null);

  const cityLabel = useMemo(
    () => prefs?.cityHint ?? cityHint,
    [prefs, cityHint],
  );

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  const showLoading =
    isAuthenticated && state.isLoading && !state.data;

  const refreshing =
    (state.isFetching && !state.isLoading) ||
    (proposals.isFetching && !proposals.isLoading);

  function refetchAll() {
    void state.refetch();
    void proposals.refetch();
    void verificationQuery.refetch();
  }

  function requireSignIn(): boolean {
    if (isSignedOut) {
      void login();
      return true;
    }
    return false;
  }

  function handleSavePreferences() {
    if (requireSignIn()) return;
    const distanceNum = distanceKm === "any" ? null : Number(distanceKm);
    if (
      distanceNum != null &&
      (!Number.isFinite(distanceNum) || distanceNum < 0)
    ) {
      setBanner({ kind: "error", text: "Pick a match radius and try again." });
      return;
    }
    const minNum = Number(ageMin);
    const maxNum = Number(ageMax);
    const safeMin = Number.isFinite(minNum)
      ? Math.min(120, Math.max(18, Math.round(minNum)))
      : null;
    const safeMax = Number.isFinite(maxNum)
      ? Math.min(120, Math.max(18, Math.round(maxNum)))
      : null;
    updatePrefs.mutate(
      {
        data: {
          ageMin: safeMin,
          ageMax: safeMax,
          distanceKm: distanceNum,
          genderPreference:
            genderPreference === "any" ? null : genderPreference,
          cityHint: cityHint.trim().length === 0 ? null : cityHint.trim(),
          dealBreakers: dealBreakers.length === 0 ? null : dealBreakers,
          mustHaves: mustHaves.length === 0 ? null : mustHaves,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          setBanner({ kind: "success", text: "Preferences saved." });
        },
        onError: () => {
          setBanner({
            kind: "error",
            text: "Could not save preferences. Try again.",
          });
        },
      },
    );
  }

  function handleTogglePool(next: boolean) {
    if (requireSignIn()) return;
    updatePool.mutate(
      { data: { status: next ? "building" : "off" } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          setBanner({
            kind: "success",
            text: next
              ? "You are on the matching list."
              : "Removed from the matching list.",
          });
        },
        onError: (err) => {
          if (statusOf(err) === 422) {
            setBanner({
              kind: "error",
              text: `You need a readiness of ${readinessThreshold} first. You are at ${readinessScore} right now.`,
            });
          } else {
            setBanner({
              kind: "error",
              text: "Could not update your status. Try again.",
            });
          }
        },
      },
    );
  }

  function handleProposalResponse(id: string, interested: boolean) {
    if (requireSignIn()) return;
    respondProposal.mutate(
      { id, data: { interested } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetMatchingProposalsQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          setBanner({
            kind: "success",
            text: interested
              ? "Noted. The founder routes interested intros to the front of the queue."
              : "Passed. We will not bring this one back.",
          });
        },
        onError: () => {
          setBanner({
            kind: "error",
            text: "Could not record that. Try again.",
          });
        },
      },
    );
  }

  function handleDiscover() {
    if (requireSignIn()) return;
    discover.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: getGetMatchingProposalsQueryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: getGetMatchingStateQueryKey(),
        });
        setBanner({
          kind: "success",
          text: "We looked across the pool. Any new intros are in your match track below.",
        });
      },
      onError: () => {
        setBanner({
          kind: "error",
          text: "Could not run a match pass right now. Try again.",
        });
      },
    });
  }

  function addDealBreaker() {
    const v = dealBreakerDraft.trim();
    if (!v) return;
    setDealBreakers((prev) => [...prev, v].slice(0, 20));
    setDealBreakerDraft("");
  }
  function addMustHave() {
    const v = mustHaveDraft.trim();
    if (!v) return;
    setMustHaves((prev) => [...prev, v].slice(0, 20));
    setMustHaveDraft("");
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
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow="Match"
          title="How you get to the front of the line"
          subtitle="The more the machine knows you, the better it matches you. When matching opens you get introductions inside your radius to people you would not find on your own. Open to every gender and orientation. No swipe."
        />

        {isSignedOut ? (
          <View
            testID="matching-demo-banner"
            style={[
              styles.banner,
              { backgroundColor: `${colors.gold}22`, borderColor: colors.gold },
            ]}
          >
            <Feather name="eye" size={15} color={colors.gold} />
            <Text style={[styles.bannerText, { color: colors.gold }]}>
              Sample view. Sign in to see your own match track.
            </Text>
          </View>
        ) : null}

        {banner ? (
          <View
            testID="matching-banner"
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
              size={15}
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

        {showLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {/* Readiness */}
        <View
          testID="card-match-readiness"
          style={[
            styles.ringCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <ScoreRing score={readinessScore} label="Readiness" />
          <View style={styles.badgeRow}>
            {isVerified ? (
              <View
                style={[styles.badge, { backgroundColor: `${colors.success}22` }]}
              >
                <Feather name="shield" size={12} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  Verified
                </Text>
              </View>
            ) : (
              <Pressable
                testID="link-verify"
                onPress={() => openWeb("/verification")}
                style={[styles.badge, { backgroundColor: `${colors.violet}22` }]}
              >
                <Feather name="shield" size={12} color={colors.violet} />
                <Text style={[styles.badgeText, { color: colors.violet }]}>
                  Verify to rank higher
                </Text>
              </Pressable>
            )}
            {selfieVerified ? (
              <View
                style={[styles.badge, { backgroundColor: `${colors.success}22` }]}
              >
                <Feather name="camera" size={12} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  Photo checked
                </Text>
              </View>
            ) : null}
            {idVerified ? (
              <View
                style={[styles.badge, { backgroundColor: `${colors.success}22` }]}
              >
                <Feather name="credit-card" size={12} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  ID verified
                </Text>
              </View>
            ) : null}
            {ageOver18 ? (
              <View
                style={[styles.badge, { backgroundColor: `${colors.success}22` }]}
              >
                <Feather name="check" size={12} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  18+
                </Text>
              </View>
            ) : null}
          </View>
          {eligible ? (
            <View style={styles.eligibleRow}>
              <Feather name="check-circle" size={15} color={colors.success} />
              <Text style={[styles.eligibleText, { color: colors.success }]}>
                You are match ready. The introductions pool is open to you.
              </Text>
            </View>
          ) : (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {pointsToPool > 0
                ? `${pointsToPool} more readiness opens the pool. Run a compass read, answer a wellness prompt, or import your data to close the gap.`
                : "The deeper your signals, the better the match."}
            </Text>
          )}
        </View>

        {/* Echo's read on you */}
        {echoView ? (
          <View
            testID="card-echo-read"
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
                What Echo sees in your signals
              </Text>
            </View>
            <Text style={[styles.echoHeadline, { color: colors.foreground }]}>
              {echoView.headline}
            </Text>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {echoView.confidence}% confidence, {echoView.radiusLabel}.
            </Text>
            {echoView.reading.length > 0 ? (
              <View style={styles.bulletGroup}>
                {echoView.reading.map((line, i) => (
                  <View key={`reading-${i}`} style={styles.bulletRow}>
                    <Feather name="eye" size={13} color={colors.teal} />
                    <Text
                      style={[styles.bulletText, { color: colors.mutedForeground }]}
                    >
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {echoView.idealMatch.length > 0 ? (
              <>
                <Text
                  style={[styles.subLabel, { color: colors.foreground }]}
                >
                  Who Echo would put in front of you
                </Text>
                <View style={styles.bulletGroup}>
                  {echoView.idealMatch.map((line, i) => (
                    <View key={`ideal-${i}`} style={styles.bulletRow}>
                      <Feather name="heart" size={13} color={colors.rose} />
                      <Text
                        style={[
                          styles.bulletText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {line}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {echoView.nextStep ? (
              <Pressable
                testID="button-echo-next-step"
                onPress={() => openWeb(echoView.nextStep!.href)}
                style={styles.linkRow}
              >
                <Text style={[styles.linkText, { color: colors.violet }]}>
                  {echoView.nextStep.label}
                </Text>
                <Feather name="arrow-right" size={13} color={colors.violet} />
              </Pressable>
            ) : null}
          </View>
        ) : isAuthenticated ? (
          <View
            testID="card-echo-read-cta"
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
                What Echo sees in your signals
              </Text>
            </View>
            <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
              Run a read grounded in your own aggregate signals. Nothing about
              anyone else is shared.
            </Text>
            <Pressable
              testID="button-run-echo-read"
              onPress={handleEchoRead}
              disabled={runEcho.isPending}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: runEcho.isPending ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {runEcho.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather
                    name="zap"
                    size={15}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.primaryBtnText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Get Echo's read
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* City density */}
        <View
          testID="card-city-density"
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.violet}22` }]}
            >
              <Feather name="users" size={16} color={colors.violet} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {cityLabel && cityLabel.trim().length > 0
                ? `${cityDensity} ${cityDensity === 1 ? "person" : "people"} near ${cityLabel}`
                : `${totalPool} early pool signups so far`}
            </Text>
          </View>
          <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
            We hold launch until each city has enough depth to make intros worth
            your time.
          </Text>
        </View>

        {/* Pool membership */}
        <View
          testID="card-pool-membership"
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.gold}22` }]}
            >
              <Feather name="user-check" size={16} color={colors.gold} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Consider me for introductions
            </Text>
            <View style={{ flex: 1 }} />
            <Switch
              testID="switch-pool-membership"
              value={poolToggleOn}
              disabled={updatePool.isPending || poolLocked}
              onValueChange={handleTogglePool}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={
                Platform.OS === "android" ? colors.background : undefined
              }
            />
          </View>
          <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
            Off by default. Turn it on and we hold your spot in the pool. Status
            today: {poolStatus}.
            {tier === "guided"
              ? " Your Guided plan routes you to the human-review queue."
              : ""}
          </Text>
          {poolLocked ? (
            <Text
              testID="text-pool-locked"
              style={[styles.lockedText, { color: colors.gold }]}
            >
              The pool opens at a readiness of {readinessThreshold}. You are at{" "}
              {readinessScore} right now. Run a compass read, answer a wellness
              prompt, or import your data to close the gap.
            </Text>
          ) : null}
        </View>

        {/* Preferences */}
        <View
          testID="card-preferences"
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.teal}22` }]}
            >
              <Feather name="sliders" size={16} color={colors.teal} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Your preferences
            </Text>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
            Who you want to meet
          </Text>
          <View style={styles.chipWrap}>
            {GENDER_OPTIONS.map((opt) => {
              const active = genderPreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  testID={`chip-gender-${opt.value}`}
                  onPress={() => setGenderPreference(opt.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.input,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
            Match radius
          </Text>
          <View style={styles.chipWrap}>
            {RADIUS_PRESETS.map((opt) => {
              const active = distanceKm === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  testID={`chip-radius-${opt.value}`}
                  onPress={() => setDistanceKm(opt.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.input,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.ageRow}>
            <View style={styles.ageField}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Age min
              </Text>
              <TextInput
                testID="input-age-min"
                value={ageMin}
                onChangeText={(t) => setAgeMin(t.replace(/[^0-9]/g, "").slice(0, 3))}
                keyboardType="number-pad"
                placeholder="25"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>
            <View style={styles.ageField}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Age max
              </Text>
              <TextInput
                testID="input-age-max"
                value={ageMax}
                onChangeText={(t) => setAgeMax(t.replace(/[^0-9]/g, "").slice(0, 3))}
                keyboardType="number-pad"
                placeholder="45"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
            City
          </Text>
          <TextInput
            testID="input-city-hint"
            value={cityHint}
            onChangeText={(t) => setCityHint(t.slice(0, 120))}
            placeholder="Where you are based"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
            Deal breakers
          </Text>
          <View style={styles.addRow}>
            <TextInput
              testID="input-deal-breaker"
              value={dealBreakerDraft}
              onChangeText={setDealBreakerDraft}
              onSubmitEditing={addDealBreaker}
              placeholder="Add one and tap plus"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: colors.input,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
            />
            <Pressable
              testID="button-add-deal-breaker"
              onPress={addDealBreaker}
              style={[styles.addBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="plus" size={18} color={colors.foreground} />
            </Pressable>
          </View>
          {dealBreakers.length > 0 ? (
            <View style={styles.chipWrap}>
              {dealBreakers.map((item, i) => (
                <Pressable
                  key={`db-${item}-${i}`}
                  testID={`deal-breaker-${i}`}
                  onPress={() =>
                    setDealBreakers((prev) => prev.filter((_, j) => j !== i))
                  }
                  style={[
                    styles.removableChip,
                    { backgroundColor: colors.input, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground }]}>
                    {item}
                  </Text>
                  <Feather name="x" size={13} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
            Must haves
          </Text>
          <View style={styles.addRow}>
            <TextInput
              testID="input-must-have"
              value={mustHaveDraft}
              onChangeText={setMustHaveDraft}
              onSubmitEditing={addMustHave}
              placeholder="Add one and tap plus"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: colors.input,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
            />
            <Pressable
              testID="button-add-must-have"
              onPress={addMustHave}
              style={[styles.addBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="plus" size={18} color={colors.foreground} />
            </Pressable>
          </View>
          {mustHaves.length > 0 ? (
            <View style={styles.chipWrap}>
              {mustHaves.map((item, i) => (
                <Pressable
                  key={`mh-${item}-${i}`}
                  testID={`must-have-${i}`}
                  onPress={() =>
                    setMustHaves((prev) => prev.filter((_, j) => j !== i))
                  }
                  style={[
                    styles.removableChip,
                    { backgroundColor: colors.input, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground }]}>
                    {item}
                  </Text>
                  <Feather name="x" size={13} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable
            testID="button-save-preferences"
            onPress={handleSavePreferences}
            disabled={updatePrefs.isPending}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: updatePrefs.isPending ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {updatePrefs.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="save" size={15} color={colors.primaryForeground} />
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Save preferences
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Match track */}
        <View
          testID="card-match-track"
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
              Your match track
            </Text>
          </View>
          <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
            Intros the founder has hand picked or the machine has surfaced for
            you. Say you are interested and it routes to the front of the queue.
          </Text>

          {eligible ? (
            <Pressable
              testID="button-discover-matches"
              onPress={handleDiscover}
              disabled={discover.isPending}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: discover.isPending ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {discover.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather
                    name="search"
                    size={15}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.primaryBtnText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Find matches near you
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}

          {proposalList.length === 0 ? (
            <Text
              testID="text-no-proposals"
              style={[styles.bodyText, { color: colors.mutedForeground }]}
            >
              No intros yet. Keep feeding signals and turn on the pool above.
              When you are eligible, run a match pass to pair with other members,
              or wait for the founder to curate one for you.
            </Text>
          ) : (
            proposalList.map((p) => {
              const meta =
                PROPOSAL_STATUS_META[p.status] ?? {
                  label: p.status,
                  tone: "muted" as const,
                  note: "",
                };
              const open = p.status === "proposed";
              const isMatch = p.status === "mutual_yes";
              return (
                <View
                  key={p.id}
                  testID={`proposal-${p.id}`}
                  style={[
                    styles.proposalCard,
                    {
                      backgroundColor: colors.input,
                      borderColor: isMatch ? colors.rose : colors.border,
                    },
                  ]}
                >
                  {isMatch ? (
                    <View style={styles.matchRow}>
                      <Feather name="heart" size={14} color={colors.rose} />
                      <Text style={[styles.matchText, { color: colors.rose }]}>
                        It is a match
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.proposalTop}>
                    <Text
                      style={[styles.proposalSource, { color: colors.foreground }]}
                    >
                      {proposalSourceLabel(p.source)}
                    </Text>
                    <View
                      testID={`proposal-status-${p.id}`}
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            meta.tone === "good"
                              ? `${colors.success}22`
                              : `${colors.muted}`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color:
                              meta.tone === "good"
                                ? colors.success
                                : colors.mutedForeground,
                          },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <Text
                      style={[styles.proposalScore, { color: colors.foreground }]}
                    >
                      {p.compatibilityScore}%
                    </Text>
                  </View>
                  <View
                    style={[styles.barTrack, { backgroundColor: colors.border }]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${Math.max(0, Math.min(100, p.compatibilityScore))}%`,
                        },
                      ]}
                    />
                  </View>
                  {p.cosmicResonance != null ? (
                    <View
                      testID={`proposal-resonance-${p.id}`}
                      style={styles.resonanceRow}
                    >
                      <Feather name="star" size={13} color={colors.plum} />
                      <Text
                        style={[
                          styles.resonanceText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Cosmic resonance {p.cosmicResonance}
                        {p.cosmicResonanceNote ? `. ${p.cosmicResonanceNote}` : ""}
                        {" "}For fun. The real read is the compatibility score
                        above.
                      </Text>
                    </View>
                  ) : null}
                  {p.summary ? (
                    <Text
                      style={[
                        styles.proposalSummary,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {p.summary}
                    </Text>
                  ) : null}
                  {open ? (
                    <View style={styles.proposalActions}>
                      <Pressable
                        testID={`button-proposal-interested-${p.id}`}
                        onPress={() => handleProposalResponse(p.id, true)}
                        disabled={respondProposal.isPending}
                        style={({ pressed }) => [
                          styles.respondBtn,
                          {
                            backgroundColor: colors.primary,
                            opacity: respondProposal.isPending
                              ? 0.6
                              : pressed
                                ? 0.85
                                : 1,
                          },
                        ]}
                      >
                        <Feather
                          name="heart"
                          size={14}
                          color={colors.primaryForeground}
                        />
                        <Text
                          style={[
                            styles.respondBtnText,
                            { color: colors.primaryForeground },
                          ]}
                        >
                          I am interested
                        </Text>
                      </Pressable>
                      <Pressable
                        testID={`button-proposal-pass-${p.id}`}
                        onPress={() => handleProposalResponse(p.id, false)}
                        disabled={respondProposal.isPending}
                        style={({ pressed }) => [
                          styles.passBtn,
                          {
                            borderColor: colors.border,
                            opacity: respondProposal.isPending
                              ? 0.6
                              : pressed
                                ? 0.7
                                : 1,
                          },
                        ]}
                      >
                        <Feather name="x" size={14} color={colors.foreground} />
                        <Text
                          style={[styles.passBtnText, { color: colors.foreground }]}
                        >
                          Pass
                        </Text>
                      </Pressable>
                    </View>
                  ) : meta.note ? (
                    <Text
                      style={[styles.metaText, { color: colors.mutedForeground }]}
                    >
                      {meta.note}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {isSignedOut && !authLoading ? (
          <Pressable
            testID="button-matching-signin"
            onPress={() => {
              void login();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="log-in" size={15} color={colors.primaryForeground} />
            <Text
              style={[styles.primaryBtnText, { color: colors.primaryForeground }]}
            >
              Sign in to get to the front of the line
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  ringCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    gap: 14,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
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
  hint: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
    textAlign: "center",
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
    flexShrink: 1,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  metaText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  echoHeadline: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  subLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    marginTop: 4,
  },
  bulletGroup: { gap: 8 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  linkText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  lockedText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  removableChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 7,
  },
  ageRow: {
    flexDirection: "row",
    gap: 12,
  },
  ageField: { flex: 1, gap: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.2,
  },
  proposalCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  matchText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  proposalTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proposalSource: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  proposalScore: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_800ExtraBold",
  },
  barTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999 },
  resonanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  resonanceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  proposalSummary: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  proposalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  respondBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  respondBtnText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  passBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  passBtnText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
