import { Feather } from "@expo/vector-icons";
import {
  getListCompassReadsQueryKey,
  useListCompassReads,
  useSaveCompassRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
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

const OWN_STYLES = [
  "Spark Chaser. I feel fast and act on it",
  "Slow Burn. I open gradually, invest deeply",
  "Quality Filter. High standards, early assessment",
  "Steady Seeker. Consistent, want partnership",
  "Guarded Romantic. Want depth, protect myself",
  "Anxious Confirmer. Need reassurance, care deeply",
  "Secure Builder. Comfortable with intimacy, steady",
  "Intensity Responder. Alive in high-stakes moments",
  "Avoidant Editor. Need space, withdraw when close",
  "Low-Trust Dater. Careful with trust, earned slowly",
  "Not sure yet",
];

const PATTERNS = [
  "Attracted to unavailable people",
  "Great starts that slowly fizzle",
  "Getting close then pulling back (me)",
  "They pull back once I'm invested",
  "Moving too fast",
  "Moving too slow, never getting traction",
  "Attracting emotionally immature people",
  "Relationships that feel intense but unstable",
  "Nothing seems to land",
];

interface CompassResult {
  supportiveTraits: string[];
  commonPull: string;
  cautionDynamics: string[];
  bestDynamic: string;
  nonNegotiables: string[];
  falseSpark: string;
}

function analyze(style: string, patterns: string[]): CompassResult {
  const key = style.split(" ")[0];
  const isSpark = key === "Spark";
  const isSlow = key === "Slow";
  const isQuality = key === "Quality";
  const isSteady = key === "Steady";
  const isGuarded = key === "Guarded";
  const isAnxious = key === "Anxious";
  const isSecure = key === "Secure";
  const isIntensity = key === "Intensity";
  const isAvoidant = key === "Avoidant";
  const isLowTrust = key === "Low-Trust";

  const attractsUnavailable = patterns.includes(PATTERNS[0]);
  const fizzles = patterns.includes(PATTERNS[1]);
  const pullsBack = patterns.includes(PATTERNS[2]);
  const theyPullBack = patterns.includes(PATTERNS[3]);
  const tooFast = patterns.includes(PATTERNS[4]);

  const supportive: string[] = [];
  if (isSpark)
    supportive.push(
      "Calm consistency. Someone who holds steady when you're fluctuating",
      "Confidence that doesn't require constant attention",
    );
  if (isSlow)
    supportive.push(
      "Patience that comes from real interest, not passivity",
      "Genuine depth to discover over time",
    );
  if (isQuality)
    supportive.push(
      "Someone who can hold their own under your standards",
      "Substance over polish",
    );
  if (isSteady)
    supportive.push(
      "Reciprocal investment, matched effort",
      "Clarity about what they want",
    );
  if (isGuarded)
    supportive.push(
      "Trust earned through consistency",
      "Security that doesn't depend on your openness",
    );
  if (isAnxious)
    supportive.push(
      "Proactive communicators, not guessers",
      "Consistency at day 1 and day 30",
    );
  if (isSecure)
    supportive.push(
      "Someone doing their own work alongside you",
      "Reciprocal investment, not anchoring",
    );
  if (isIntensity)
    supportive.push(
      "Their own depth, capable of meeting yours",
      "Capacity for the ordinary middle, not just peaks",
    );
  if (isAvoidant)
    supportive.push(
      "Doesn't need frequent reassurance",
      "Respects space without reading it as rejection",
    );
  if (isLowTrust)
    supportive.push(
      "Consistency before openness",
      "Actions matching words across weeks",
    );
  if (supportive.length === 0)
    supportive.push(
      "Consistency over intensity",
      "Real emotional availability, not just access",
      "Self-aware partners doing their own work",
    );

  const cautions: string[] = [];
  if (attractsUnavailable)
    cautions.push(
      "Emotionally unavailable people where distance reads as depth",
    );
  if (fizzles)
    cautions.push(
      "Strong-start partners who can't sustain the middle",
    );
  if (pullsBack || isGuarded || isAvoidant)
    cautions.push(
      "Dynamics where you manage both their discomfort and yours",
    );
  if (theyPullBack || isAnxious)
    cautions.push(
      "Asymmetric pursuit. You consistently want more than you receive",
    );
  if (tooFast || isSpark || isIntensity)
    cautions.push(
      "Fast starts where early intensity replaces real knowing",
    );
  if (cautions.length === 0)
    cautions.push(
      "Promising openings that never develop substance",
    );

  const commonPulls: Record<string, string> = {
    Spark:
      "You're pulled toward excitement that registers as chemistry. Excitement and compatibility are different signals.",
    Slow:
      "You're pulled toward depth and substance, and sometimes toward projected depth that mimics it.",
    Quality:
      "You're pulled toward people who seem to meet your bar. Performance and character are not the same thing.",
    Steady:
      "You overweight early declarations of wanting the same thing. Watch behavior, not statements.",
    Guarded:
      "Slightly out-of-reach people feel safer. Examine whether available people register as worth wanting.",
    Anxious:
      "You're pulled toward people who make you work for connection. Effort feels like love. It often isn't.",
    Secure:
      "You attract people who want your stability more than they want you. Notice anchoring versus building.",
    Intensity:
      "You're pulled toward situations that produce the most feeling. Feeling is not the same as fit.",
    Avoidant:
      "You're pulled toward dynamics that confirm your need for space. Neither pressure nor easy passivity produces growth.",
    "Low-Trust":
      "Familiar feels safe. Familiar often means repeating a dynamic you already know.",
  };

  const bestDynamics: Record<string, string> = {
    Spark: "Someone consistent, interesting, and secure. Spark deepens into substance, not the other way around.",
    Slow: "Someone patient enough to let you arrive who is also investing slowly. Mutual slow-burn produces durable connection.",
    Quality: "Someone who meets your standard and challenges it. Mutual admiration in both directions.",
    Steady: "Matched investment from the start. Your consistency is met with equal consistency.",
    Guarded: "Someone secure enough to earn trust through behavior rather than asking for it.",
    Anxious: "Proactive, consistent communicators who can handle your care without reading it as too much.",
    Secure: "A partner doing their own work, building something alongside you. Equal investment.",
    Intensity: "Someone who can hold depth and be present for quiet moments. Real emotional range.",
    Avoidant: "Secure partners who give you space without interpreting it as abandonment.",
    "Low-Trust": "Patient, clear partners willing to earn trust slowly without being offended by your caution.",
  };

  const falseSparks: Record<string, string> = {
    Spark:
      "Unavailability mistaken for depth. Out-of-reach feels like intensity but is mostly anxiety.",
    Slow:
      "Withholding mistaken for mystery. Real depth reveals itself; projected depth keeps you guessing.",
    Quality:
      "Polish mistaken for character. The filter catches performance before it catches who they actually are.",
    Steady:
      "Early enthusiasm mistaken for sustained interest. The first weeks aren't the whole picture.",
    Guarded:
      "Partial unavailability mistaken for safety. The connections that were actually safe pass you by.",
    Anxious:
      "Relief mistaken for love. Reassurance after worry feels like depth. It's often just the absence of pain.",
    Secure:
      "Urgent interest mistaken for chemistry. Their pace may have nothing to do with you specifically.",
    Intensity:
      "Drama mistaken for aliveness. Nervous system activation is not the same as genuine connection.",
    Avoidant:
      "Distance mistaken for self-respect. Sometimes unavailability has good packaging.",
    "Low-Trust":
      "Familiarity mistaken for safety. The familiar pattern is often the painful one.",
  };

  const nonNegotiables: string[] = [];
  if (isAnxious || isLowTrust)
    nonNegotiables.push("Consistency. Same person at day 1 and day 30.");
  if (isGuarded || isAvoidant)
    nonNegotiables.push("Patience without pressure.");
  if (isSpark || isIntensity)
    nonNegotiables.push("Substance beneath the chemistry.");
  if (isQuality || isSteady)
    nonNegotiables.push("Reciprocal investment that matches yours.");
  if (isSecure || isSlow)
    nonNegotiables.push("Matched self-awareness on their side.");
  if (nonNegotiables.length === 0)
    nonNegotiables.push("Genuine presence. Actually there, not performing being there.");
  nonNegotiables.push("Honesty about what they want. Behavior over declarations.");

  return {
    supportiveTraits: supportive.slice(0, 3),
    commonPull:
      commonPulls[key] ||
      "You're pulled toward what produces strong early feeling. Early feeling is real information, but not the whole picture.",
    cautionDynamics: cautions.slice(0, 3),
    bestDynamic:
      bestDynamics[key] ||
      "Genuine reciprocity. Both investing, both honest, both willing to do the slower work of actually knowing each other.",
    nonNegotiables: nonNegotiables.slice(0, 3),
    falseSpark:
      falseSparks[key] ||
      "Early intensity mistaken for fit. Strong chemistry overshadows the slower signals that predict whether something lasts.",
  };
}

export default function CompassScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const [style, setStyle] = useState<string>("");
  const [patterns, setPatterns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CompassResult | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveRead = useSaveCompassRead();
  const history = useListCompassReads({
    query: {
      queryKey: getListCompassReadsQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  function togglePattern(p: string) {
    setPatterns((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function handleAnalyze() {
    if (!style) {
      setError("Pick your connection style first.");
      return;
    }
    setError(null);
    const deterministic = analyze(style, patterns);
    setResult(deterministic);
    setSavedAt(null);
    try {
      const saved = await saveRead.mutateAsync({
        data: {
          connectionStyle: style,
          patterns,
          notes: notes.trim() ? notes.trim() : null,
          deterministicResult: deterministic as unknown as Record<string, unknown>,
        },
      });
      setSavedAt(new Date(saved.createdAt).toISOString());
      void queryClient.invalidateQueries({
        queryKey: getListCompassReadsQueryKey(),
      });
    } catch {
      // result still shows; user can re-try
    }
  }

  function handleReset() {
    setStyle("");
    setPatterns([]);
    setNotes("");
    setResult(null);
    setSavedAt(null);
    setError(null);
  }

  const historyRows = (history.data?.reads ?? []) as Array<{
    id: number;
    connectionStyle: string;
    createdAt: string;
  }>;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 8, paddingBottom: bottomInset + 40 },
        ]}
      >
        <ScreenHeader
          eyebrow="Compass"
          title="Read your connection style"
          subtitle="Tell us how you tend to show up and the patterns that keep repeating. We'll surface traits to look for, dynamics to watch, and the false spark that pulls you off course."
        />

        {/* Style picker */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.label, { color: colors.foreground }]}>
            How would you describe your connection style?
          </Text>
          <View style={styles.choiceGrid}>
            {OWN_STYLES.map((s) => {
              const active = style === s;
              return (
                <Pressable
                  key={s}
                  testID={`button-style-${s.split(" ")[0].toLowerCase()}`}
                  onPress={() => setStyle(s)}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      backgroundColor: active
                        ? `${colors.violet}22`
                        : colors.input,
                      borderColor: active ? colors.violet : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceLabel,
                      {
                        color: active ? colors.violet : colors.foreground,
                      },
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Patterns multi-select */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.label, { color: colors.foreground }]}>
            Which patterns keep showing up? Pick any.
          </Text>
          <View style={styles.choiceGrid}>
            {PATTERNS.map((p) => {
              const active = patterns.includes(p);
              return (
                <Pressable
                  key={p}
                  onPress={() => togglePattern(p)}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      backgroundColor: active
                        ? `${colors.accent}22`
                        : colors.input,
                      borderColor: active ? colors.accent : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceLabel,
                      {
                        color: active ? colors.accent : colors.foreground,
                      },
                    ]}
                  >
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.label, { color: colors.foreground }]}>
            Anything else worth knowing? Optional.
          </Text>
          <TextInput
            testID="input-compass-notes"
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, 2000))}
            placeholder="A few sentences of context"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.textarea,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
          />
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            testID="button-compass-analyze"
            disabled={saveRead.isPending}
            onPress={() => {
              void handleAnalyze();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: saveRead.isPending ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {saveRead.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather
                  name="compass"
                  size={15}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.primaryLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Read my compass
                </Text>
              </>
            )}
          </Pressable>
          {result ? (
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="rotate-ccw" size={15} color={colors.foreground} />
              <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>
                Reset
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Result */}
        {result ? (
          <View
            testID="compass-result"
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                gap: 14,
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
                Your compass
              </Text>
              <View style={{ flex: 1 }} />
              <ShareButton
                testId="button-share-compass"
                surface="compass-read"
                title="My compass read on MatchLab Club"
                text={`My connection style: ${style}. My best-fit dynamic: ${result.bestDynamic}`}
                path="/compass"
                ref={user?.id ? `user-${user.id}` : "compass"}
                variant="pill"
                label="Share"
              />
            </View>
            <Section
              colors={colors}
              title="Common pull"
              icon="trending-up"
              body={result.commonPull}
            />
            <SectionList
              colors={colors}
              title="Supportive traits to look for"
              icon="check-circle"
              items={result.supportiveTraits}
            />
            <SectionList
              colors={colors}
              title="Dynamics to watch"
              icon="alert-triangle"
              items={result.cautionDynamics}
            />
            <Section
              colors={colors}
              title="Best-fit dynamic"
              icon="heart"
              body={result.bestDynamic}
            />
            <SectionList
              colors={colors}
              title="Non-negotiables"
              icon="anchor"
              items={result.nonNegotiables}
            />
            <Section
              colors={colors}
              title="False spark to watch for"
              icon="zap"
              body={result.falseSpark}
            />
            {savedAt ? (
              <Text
                style={[styles.helper, { color: colors.mutedForeground }]}
              >
                Saved to your hub
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* History */}
        {isAuthenticated && historyRows.length > 0 ? (
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
                <Feather name="clock" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Past reads
              </Text>
            </View>
            {historyRows.slice(0, 10).map((r) => (
              <View key={r.id} style={styles.listRow}>
                <Text
                  style={[styles.listRowBody, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {r.connectionStyle}
                </Text>
                <Text
                  style={[
                    styles.listRowMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {new Date(r.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Section({
  colors,
  title,
  icon,
  body,
}: {
  colors: ReturnType<typeof useColors>;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  body: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.cardHeader}>
        <Feather name={icon} size={14} color={colors.mutedForeground} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.cardBody, { color: colors.foreground }]}>
        {body}
      </Text>
    </View>
  );
}

function SectionList({
  colors,
  title,
  icon,
  items,
}: {
  colors: ReturnType<typeof useColors>;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  items: string[];
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.cardHeader}>
        <Feather name={icon} size={14} color={colors.mutedForeground} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {title}
        </Text>
      </View>
      {items.map((it, i) => (
        <Text
          key={i}
          style={[styles.cardBody, { color: colors.foreground }]}
        >
          {"• "}
          {it}
        </Text>
      ))}
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
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  label: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  choiceGrid: { gap: 8 },
  choice: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  choiceLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  textarea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    minHeight: 90,
    textAlignVertical: "top",
  },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  listRowBody: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  listRowMeta: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    marginLeft: 10,
  },
  helper: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
  },
});
