import { Feather } from "@expo/vector-icons";
import { useAuditFromScreenshot } from "@workspace/api-client-react";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { ScoreRing } from "@/components/ScoreRing";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";

interface PickedImage {
  uri: string;
  base64: string;
}

interface ScanResult {
  auditId: number;
  extractedBio: string;
  extractedPrompts: string[];
  report: {
    readinessScore: number;
    overallGrade: string;
    strengths: string[];
    risks: string[];
    bioAudit: string;
    rewrittenBio: string;
    messagingStyle: string;
    coachingCta: string;
  };
}

const DEMO_RESULT: ScanResult = {
  auditId: 0,
  extractedBio:
    "29 · designer in Brooklyn. Sourdough hobbyist, big into film photography, recovering perfectionist. Looking for someone curious and kind.",
  extractedPrompts: [
    "The way to win me over is… remembering the weird specific thing I mentioned once.",
    "I'm looking for… someone who laughs before the punchline lands.",
  ],
  report: {
    readinessScore: 78,
    overallGrade: "B+",
    strengths: [
      "Bio shows specific personality, not just adjectives",
      "Mentions hobbies that make for easy openers",
      "Tone reads warm and self-aware",
    ],
    risks: [
      "'Recovering perfectionist' is a common phrase — risks reading generic",
      "No prompt about future plans or values",
    ],
    bioAudit:
      "Strong opening with concrete details (Brooklyn, sourdough, film). The closing line is the weakest part — 'curious and kind' is what everyone says. Replace it with one specific behavior you actually want.",
    rewrittenBio:
      "29 · designer in Brooklyn. I bake sourdough on Sundays, shoot film I never develop fast enough, and laugh too loud at my own jokes. Looking for someone who'd rather wander than plan.",
    messagingStyle: "Open with the film photography — ask what camera they shoot on.",
    coachingCta: "Tap Coach to draft a first message that actually lands.",
  },
};

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scan = useAuditFromScreenshot();

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  async function pickFromLibrary() {
    setErrorMsg(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("We need photo access to read the screenshot.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setPicked({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
      setResult(null);
    }
  }

  async function takePhoto() {
    setErrorMsg(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("We need camera access to take a snapshot.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setPicked({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
      setResult(null);
    }
  }

  async function runAudit() {
    if (!picked) return;
    setErrorMsg(null);
    try {
      const res = await scan.mutateAsync({
        data: { imageBase64: picked.base64 },
      });
      setResult({
        auditId: res.auditId,
        extractedBio: res.extractedBio,
        extractedPrompts: res.extractedPrompts,
        report: {
          readinessScore: res.report.readinessScore,
          overallGrade: res.report.overallGrade,
          strengths: res.report.strengths,
          risks: res.report.risks,
          bioAudit: res.report.bioAudit,
          rewrittenBio: res.report.rewrittenBio,
          messagingStyle: res.report.messagingStyle,
          coachingCta: res.report.coachingCta,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't audit that screenshot. Try a clearer photo.";
      setErrorMsg(message);
    }
  }

  function reset() {
    setPicked(null);
    setResult(null);
    setErrorMsg(null);
  }

  const display = result ?? DEMO_RESULT;
  const showingDemo = result === null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
      >
        <ScreenHeader
          eyebrow="Scan a Profile"
          title="Audit a match in 10 seconds"
          subtitle="Snap or upload a screenshot of their profile. We'll read it, score it, and tell you exactly how to open."
        />

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {picked ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: picked.uri }} style={styles.preview} />
              <Pressable onPress={reset} style={styles.clearBtn}>
                <Feather name="x" size={14} color={colors.foreground} />
                <Text style={[styles.clearText, { color: colors.foreground }]}>
                  Replace
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.pickerRow}>
              <Pressable
                onPress={takePhoto}
                style={[
                  styles.pickBtn,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Feather name="camera" size={22} color={colors.violet} />
                <Text style={[styles.pickLabel, { color: colors.foreground }]}>
                  Take photo
                </Text>
              </Pressable>
              <Pressable
                onPress={pickFromLibrary}
                style={[
                  styles.pickBtn,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Feather name="image" size={22} color={colors.gold} />
                <Text style={[styles.pickLabel, { color: colors.foreground }]}>
                  From library
                </Text>
              </Pressable>
            </View>
          )}

          {errorMsg ? (
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
                {errorMsg}
              </Text>
            </View>
          ) : null}

          {picked ? (
            <PrimaryButton
              label={scan.isPending ? "Reading screenshot…" : "Audit this profile"}
              onPress={runAudit}
              loading={scan.isPending}
              icon="zap"
            />
          ) : (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Works best on Hinge, Bumble or Tinder screenshots where the bio and
              prompts are visible. Text is processed on our server — the image is
              not stored.
            </Text>
          )}
        </View>

        {scan.isPending ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              OCR + audit usually takes about 10 seconds…
            </Text>
          </View>
        ) : null}

        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
            {showingDemo ? "Sample mini-report" : "Mini-report"}
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

        <View
          style={[
            styles.ringCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <ScoreRing score={display.report.readinessScore} />
          <Text style={[styles.gradeText, { color: colors.foreground }]}>
            Grade {display.report.overallGrade}
          </Text>
        </View>

        {display.extractedBio ? (
          <Section title="What we read" iconBg={`${colors.teal}22`} iconColor={colors.teal} icon="file-text">
            <Text style={[styles.body, { color: colors.foreground }]}>
              {display.extractedBio}
            </Text>
            {display.extractedPrompts.length > 0 ? (
              <View style={styles.promptList}>
                {display.extractedPrompts.map((p, i) => (
                  <Text key={`p-${i}`} style={[styles.promptItem, { color: colors.mutedForeground }]}>
                    • {p}
                  </Text>
                ))}
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section
          title="Strengths"
          iconBg={`${colors.success}22`}
          iconColor={colors.success}
          icon="check-circle"
        >
          {display.report.strengths.map((s, i) => (
            <Bullet key={`s-${i}`} color={colors.success} text={s} />
          ))}
        </Section>

        <Section
          title="Risks to watch"
          iconBg={`${colors.rose}22`}
          iconColor={colors.rose}
          icon="alert-triangle"
        >
          {display.report.risks.map((r, i) => (
            <Bullet key={`r-${i}`} color={colors.rose} text={r} />
          ))}
        </Section>

        <Section
          title="Bio audit"
          iconBg={`${colors.violet}22`}
          iconColor={colors.violet}
          icon="edit-3"
        >
          <Text style={[styles.body, { color: colors.foreground }]}>
            {display.report.bioAudit}
          </Text>
        </Section>

        <Section
          title="How to open"
          iconBg={`${colors.gold}22`}
          iconColor={colors.gold}
          icon="message-circle"
        >
          <Text style={[styles.body, { color: colors.foreground }]}>
            {display.report.messagingStyle}
          </Text>
          <Text
            style={[
              styles.cta,
              { color: colors.gold, borderColor: colors.gold },
            ]}
          >
            {display.report.coachingCta}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  icon,
  iconBg,
  iconColor,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.iconBubble, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={16} color={iconColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Bullet({ color, text }: { color: string; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.item}>
      <View style={[styles.bullet, { backgroundColor: color }]} />
      <Text style={[styles.itemText, { color: colors.foreground }]}>{text}</Text>
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
  pickerRow: {
    flexDirection: "row",
    gap: 12,
  },
  pickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  previewWrap: {
    alignItems: "center",
    gap: 10,
  },
  preview: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    resizeMode: "cover",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff14",
  },
  clearText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
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
  ringCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 24,
    gap: 10,
  },
  gradeText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1,
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
  body: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 20,
  },
  promptList: { gap: 4, marginTop: 4 },
  promptItem: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
  },
  cta: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
});
