import { Feather } from "@expo/vector-icons";
import {
  useGenerateAuditReport,
  useGetAudit,
} from "@workspace/api-client-react";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreRing } from "@/components/ScoreRing";
import { useColors } from "@/hooks/useColors";

interface ReportShape {
  readinessScore: number;
  overallGrade: string;
  strengths: string[];
  risks: string[];
  bioAudit: string;
  rewrittenBio: string;
  messagingStyle: string;
  coachingCta: string;
}

export default function AuditDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = Number.parseInt(idParam ?? "", 10);
  const valid = Number.isFinite(id);

  const colors = useColors();
  const insets = useSafeAreaInsets();

  const auditQuery = useGetAudit(valid ? id : 0);
  const generate = useGenerateAuditReport();
  const [report, setReport] = useState<ReportShape | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!valid || report || generate.isPending) return;
    generate
      .mutateAsync({ id })
      .then((r) => {
        setReport({
          readinessScore: r.readinessScore,
          overallGrade: r.overallGrade,
          strengths: r.strengths,
          risks: r.risks,
          bioAudit: r.bioAudit,
          rewrittenBio: r.rewrittenBio,
          messagingStyle: r.messagingStyle,
          coachingCta: r.coachingCta,
        });
      })
      .catch((err) => {
        const m =
          err instanceof Error
            ? err.message
            : "Couldn't load this mini-report.";
        setErrorMsg(m);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, id]);

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom + 20;

  const audit = auditQuery.data;
  const promptList = audit?.prompts
    ? audit.prompts.split("\n").map((p) => p.trim()).filter(Boolean)
    : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: audit?.firstName ? audit.firstName : "Mini-report",
        }}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset, paddingBottom: bottomInset },
        ]}
      >
        {!valid ? (
          <Text style={[styles.body, { color: colors.destructive }]}>
            That audit link looks broken.
          </Text>
        ) : null}

        {valid && auditQuery.isLoading ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading match…
            </Text>
          </View>
        ) : null}

        {auditQuery.error ? (
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
              Couldn't load this audit.
            </Text>
          </View>
        ) : null}

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

        {audit ? (
          <View
            style={[
              styles.ringCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ScoreRing
              score={
                report?.readinessScore ?? audit.readinessScore ?? 0
              }
            />
            {report ? (
              <Text style={[styles.gradeText, { color: colors.foreground }]}>
                Grade {report.overallGrade}
              </Text>
            ) : (
              <Text style={[styles.gradeText, { color: colors.mutedForeground }]}>
                {generate.isPending ? "Regenerating mini-report…" : " "}
              </Text>
            )}
            <Text style={[styles.nameText, { color: colors.mutedForeground }]}>
              {audit.firstName}
              {audit.currentApps[0] ? ` · ${audit.currentApps[0]}` : ""}
            </Text>
          </View>
        ) : null}

        {audit ? (
          <Section
            title="What we read"
            iconBg={`${colors.teal}22`}
            iconColor={colors.teal}
            icon="file-text"
          >
            <Text style={[styles.body, { color: colors.foreground }]}>
              {audit.bio}
            </Text>
            {promptList.length > 0 ? (
              <View style={styles.promptList}>
                {promptList.map((p, i) => (
                  <Text
                    key={`p-${i}`}
                    style={[styles.promptItem, { color: colors.mutedForeground }]}
                  >
                    • {p}
                  </Text>
                ))}
              </View>
            ) : null}
          </Section>
        ) : null}

        {report ? (
          <>
            <Section
              title="Strengths"
              iconBg={`${colors.success}22`}
              iconColor={colors.success}
              icon="check-circle"
            >
              {report.strengths.map((s, i) => (
                <Bullet key={`s-${i}`} color={colors.success} text={s} />
              ))}
            </Section>

            <Section
              title="Risks to watch"
              iconBg={`${colors.rose}22`}
              iconColor={colors.rose}
              icon="alert-triangle"
            >
              {report.risks.map((r, i) => (
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
                {report.bioAudit}
              </Text>
            </Section>

            <Section
              title="How to open"
              iconBg={`${colors.gold}22`}
              iconColor={colors.gold}
              icon="message-circle"
            >
              <Text style={[styles.body, { color: colors.foreground }]}>
                {report.messagingStyle}
              </Text>
              <Text
                style={[
                  styles.cta,
                  { color: colors.gold, borderColor: colors.gold },
                ]}
              >
                {report.coachingCta}
              </Text>
            </Section>
          </>
        ) : null}
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
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
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
  ringCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 24,
    gap: 8,
  },
  gradeText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1,
  },
  nameText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
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
