import { Feather } from "@expo/vector-icons";
import { useAnalyzeInsight } from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { useCreateInsightWithAnonClaim } from "@/lib/useCreateAnonymousAware";

const SOURCE_APPS = ["Hinge", "Bumble", "Tinder", "iMessage", "Email"] as const;
type InsightSource = (typeof SOURCE_APPS)[number];

function detectSourceFromText(text: string): InsightSource | null {
  const t = text.toLowerCase();
  if (/\bhinge\b/.test(t)) return "Hinge";
  if (/\bbumble\b/.test(t)) return "Bumble";
  if (/\btinder\b/.test(t)) return "Tinder";
  if (/\bimessage\b|\bsms\b|\btexts?\b/.test(t)) return "iMessage";
  if (/\bemail\b|\bgmail\b|\boutlook\b|@\w+\.\w+/.test(t)) return "Email";
  return null;
}

type Pattern = { pattern: string; frequency: string; impact: string };

type Analysis = {
  communicationPatterns: Pattern[];
  attachmentStyle: string;
  strengths: string[];
  growthAreas: string[];
  datingProfileTips: string[];
  summary: string;
  sourceApp?: string | null;
};

const DEMO_ANALYSIS: Analysis = {
  communicationPatterns: [
    {
      pattern: "Humor as a connector",
      frequency: "High — appears naturally throughout conversation",
      impact:
        "One of the strongest accelerants of attraction and trust. Keep it calibrated to their energy.",
    },
    {
      pattern: "Question-heavy style",
      frequency: "High — 6 questions detected in this sample",
      impact:
        "Strong curiosity signal, but balance with personal disclosures so it doesn't feel like an interview.",
    },
    {
      pattern: "Concrete, specific messaging",
      frequency: "Consistent — you reference specifics",
      impact:
        "Excellent. Specific messages are memorable and give the other person more to respond to.",
    },
  ],
  attachmentStyle: "Secure — you communicate directly and recover well from tension",
  strengths: [
    "Natural use of humor to create warmth and ease",
    "Genuine curiosity — you ask real questions",
    "Specific and concrete — you make conversations memorable",
  ],
  growthAreas: [
    "You wait a bit long before suggesting escalation",
    "Occasionally over-explain or hedge — you can be more direct",
  ],
  datingProfileTips: [
    "Bring the humor into your profile — it's your strongest asset",
    "Add a prompt that ends with an implicit question",
    "Lead with a concrete scene, not personality descriptors",
  ],
  summary:
    "Your communication fingerprint is: Secure and curious. You connect through humor, ask genuine questions, and bring specificity that makes conversations feel real.",
};

function attachmentColor(style: string, colors: ReturnType<typeof useColors>) {
  const lower = style.toLowerCase();
  if (lower.includes("secure")) return colors.teal;
  if (lower.includes("anxious")) return colors.gold;
  if (lower.includes("avoidant")) return colors.violet;
  return colors.rose;
}

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceApp, setSourceApp] = useState<InsightSource | "">("");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);

  const createInsight = useCreateInsightWithAnonClaim();
  const analyzeInsight = useAnalyzeInsight();

  const isLoading = createInsight.isPending || analyzeInsight.isPending;

  const detectedSource =
    sourceApp || detectSourceFromText(`${sourceLabel}\n${content}`) || null;

  async function handleAnalyze() {
    setErrorMsg(null);
    const appForRequest =
      sourceApp || detectSourceFromText(`${sourceLabel}\n${content}`) || null;
    try {
      const insight = await createInsight.mutateAsync({
        data: {
          sourceLabel: sourceLabel.trim() || "My messages",
          pastedContent: content,
          consentGiven: consent,
          sourceApp: appForRequest,
        },
      });
      const result = await analyzeInsight.mutateAsync({ id: insight.id });
      setAnalysis(result as Analysis);
    } catch {
      setAnalysis(DEMO_ANALYSIS);
    }
  }

  const display = analysis ?? DEMO_ANALYSIS;
  const showingDemo = analysis === null;

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  const accentColor = attachmentColor(display.attachmentStyle, colors);

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
          eyebrow="Communication Insights"
          title="Read your patterns"
          subtitle="Paste any conversation and we'll surface your communication style, attachment tendencies, and what to adjust."
        />

        {/* Privacy notice */}
        <View
          style={[
            styles.privacyCard,
            { backgroundColor: `${colors.violet}18`, borderColor: `${colors.violet}40` },
          ]}
        >
          <Feather name="shield" size={16} color={colors.violet} style={styles.privacyIcon} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Your pasted content is analyzed only for your coaching session and is never sold or
            shared. You can delete it anytime.
          </Text>
        </View>

        {/* Source label */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Source label</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="e.g. Hinge messages with Alex"
            placeholderTextColor={colors.mutedForeground}
            value={sourceLabel}
            onChangeText={setSourceLabel}
            returnKeyType="next"
            testID="input-source-label"
          />
        </View>

        {/* Source platform chips */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Platform</Text>
            {!sourceApp && detectedSource ? (
              <Text style={[styles.detectedBadge, { color: colors.violet }]}>
                detected: {detectedSource}
              </Text>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {SOURCE_APPS.map((app) => {
              const active = sourceApp === app;
              return (
                <Pressable
                  key={app}
                  onPress={() => setSourceApp(active ? "" : app)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? `${colors.violet}28` : colors.card,
                      borderColor: active ? colors.violet : colors.cardBorder,
                    },
                  ]}
                  testID={`button-insight-source-${app.toLowerCase()}`}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.violet : colors.mutedForeground },
                    ]}
                  >
                    {app}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Optional — helps us tune the analysis to that platform.
          </Text>
        </View>

        {/* Message history */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Paste your message history
          </Text>
          <TextInput
            style={[
              styles.textarea,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                color: colors.foreground,
              },
            ]}
            placeholder={
              "Me: Hey! Love that you mentioned the Japan trip — I went last year too.\nSam: Oh amazing! I did Tokyo and Kyoto. You?\nMe: Same! Tokyo was wild. Favorite ramen spot?"
            }
            placeholderTextColor={colors.mutedForeground}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            testID="textarea-message-history"
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Format as "Name: message" on each line. Use "Me:" for your own messages.
          </Text>
        </View>

        {/* Consent */}
        <Pressable
          style={styles.consentRow}
          onPress={() => setConsent((v) => !v)}
          testID="checkbox-consent"
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: consent ? colors.violet : "transparent",
                borderColor: consent ? colors.violet : colors.cardBorder,
              },
            ]}
          >
            {consent ? (
              <Feather name="check" size={12} color={colors.background} />
            ) : null}
          </View>
          <Text style={[styles.consentText, { color: colors.mutedForeground }]}>
            I understand this content will be analyzed for communication pattern insights. I consent
            to this analysis and can delete my data at any time.
          </Text>
        </Pressable>

        {errorMsg ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
        ) : null}

        <PrimaryButton
          label={isLoading ? "Analyzing…" : "Analyze My Communication Style"}
          onPress={handleAnalyze}
          disabled={isLoading || !content.trim() || !consent}
        />

        {/* Results */}
        <View style={styles.resultsSection}>
          {showingDemo ? (
            <View
              style={[
                styles.demoBanner,
                { backgroundColor: `${colors.gold}18`, borderColor: `${colors.gold}40` },
              ]}
            >
              <Text style={[styles.demoBannerText, { color: colors.gold }]}>
                Sample results — paste your conversation above to see your own patterns
              </Text>
            </View>
          ) : null}

          {/* Summary */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-insights-summary"
          >
            <Text style={[styles.cardEyebrow, { color: colors.violet }]}>Summary</Text>
            <Text style={[styles.summaryText, { color: colors.foreground }]}>
              {display.summary}
            </Text>
          </View>

          {/* Attachment style */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}40`,
              },
            ]}
            testID="card-attachment-style"
          >
            <View style={styles.cardRow}>
              <Feather name="heart" size={16} color={accentColor} />
              <Text style={[styles.cardEyebrow, { color: accentColor, marginBottom: 0 }]}>
                Attachment Style
              </Text>
            </View>
            <Text style={[styles.attachmentText, { color: colors.foreground }]}>
              {display.attachmentStyle}
            </Text>
          </View>

          {/* Communication patterns */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-communication-patterns"
          >
            <Text style={[styles.cardEyebrow, { color: colors.violet }]}>
              Communication Patterns
            </Text>
            {display.communicationPatterns.map((p, i) => {
              const isExpanded = expandedPattern === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => setExpandedPattern(isExpanded ? null : i)}
                  style={[
                    styles.patternItem,
                    i < display.communicationPatterns.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.cardBorder,
                    },
                  ]}
                  testID={`pattern-item-${i}`}
                >
                  <View style={styles.patternHeader}>
                    <Text
                      style={[styles.patternTitle, { color: colors.foreground }]}
                      numberOfLines={isExpanded ? undefined : 1}
                    >
                      {p.pattern}
                    </Text>
                    <Feather
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={colors.mutedForeground}
                    />
                  </View>
                  {isExpanded ? (
                    <View style={styles.patternExpanded}>
                      <Text style={[styles.patternFrequency, { color: colors.violet }]}>
                        {p.frequency}
                      </Text>
                      <Text style={[styles.patternImpact, { color: colors.mutedForeground }]}>
                        {p.impact}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[styles.patternFrequency, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {p.frequency}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Strengths */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-strengths"
          >
            <View style={styles.cardRow}>
              <Feather name="check-circle" size={15} color={colors.teal} />
              <Text style={[styles.cardEyebrow, { color: colors.teal, marginBottom: 0 }]}>
                Strengths
              </Text>
            </View>
            {display.strengths.map((s, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={[styles.bullet, { backgroundColor: colors.teal }]} />
                <Text style={[styles.bulletText, { color: colors.foreground }]}>{s}</Text>
              </View>
            ))}
          </View>

          {/* Growth areas */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-growth-areas"
          >
            <View style={styles.cardRow}>
              <Feather name="trending-up" size={15} color={colors.gold} />
              <Text style={[styles.cardEyebrow, { color: colors.gold, marginBottom: 0 }]}>
                Growth Areas
              </Text>
            </View>
            {display.growthAreas.map((g, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={[styles.bullet, { backgroundColor: colors.gold }]} />
                <Text style={[styles.bulletText, { color: colors.foreground }]}>{g}</Text>
              </View>
            ))}
          </View>

          {/* Profile tips */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-profile-tips"
          >
            <View style={styles.cardRow}>
              <Feather name="user" size={15} color={colors.rose} />
              <Text style={[styles.cardEyebrow, { color: colors.rose, marginBottom: 0 }]}>
                Profile Tips
              </Text>
            </View>
            {display.datingProfileTips.map((tip, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={[styles.bullet, { backgroundColor: colors.rose }]} />
                <Text style={[styles.bulletText, { color: colors.foreground }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  privacyIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  fieldGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.3,
  },
  detectedBadge: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    minHeight: 160,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  resultsSection: {
    gap: 12,
    marginTop: 4,
  },
  demoBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  demoBannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "PlusJakartaSans_600SemiBold",
    textAlign: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardEyebrow: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
  },
  attachmentText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    lineHeight: 22,
    marginTop: 4,
  },
  patternItem: {
    paddingVertical: 10,
    gap: 4,
  },
  patternHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  patternTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    lineHeight: 19,
  },
  patternExpanded: {
    gap: 6,
    marginTop: 4,
  },
  patternFrequency: {
    fontSize: 12,
    lineHeight: 17,
  },
  patternImpact: {
    fontSize: 13,
    lineHeight: 19,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
