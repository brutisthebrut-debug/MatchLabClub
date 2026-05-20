import { Feather } from "@expo/vector-icons";
import {
  getGetAuditQueryKey,
  getListAuditsQueryKey,
  useDeleteAudit,
  useGenerateAuditReport,
  useGetAudit,
  useGetEngineMeta,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreRing } from "@/components/ScoreRing";
import { useColors } from "@/hooks/useColors";

const STALE_REPORT_DAYS = 30;

function ageInDays(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function formatStaleAge(iso: string): string {
  const days = ageInDays(iso);
  if (days === null) return "a while ago";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 2) {
    const weeks = Math.floor(days / 7);
    return `${weeks} weeks ago`;
  }
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "earlier";
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ChangeSummary {
  scoreDelta: number;
  previousScore: number;
  newScore: number;
  addedStrengths: string[];
  removedStrengths: string[];
  addedRisks: string[];
  removedRisks: string[];
}

interface ReportShape {
  readinessScore: number;
  overallGrade: string;
  strengths: string[];
  risks: string[];
  bioAudit: string;
  rewrittenBio: string;
  messagingStyle: string;
  coachingCta: string;
  changeSummary?: ChangeSummary | null;
}

function changeSummaryHasChanges(c: ChangeSummary): boolean {
  return (
    c.scoreDelta !== 0 ||
    c.addedStrengths.length > 0 ||
    c.removedStrengths.length > 0 ||
    c.addedRisks.length > 0 ||
    c.removedRisks.length > 0
  );
}

export default function AuditDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = Number.parseInt(idParam ?? "", 10);
  const valid = Number.isFinite(id);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const auditQuery = useGetAudit(valid ? id : 0);
  const { data: engineMeta } = useGetEngineMeta();
  const currentEngineVersion = engineMeta?.engineVersion ?? null;
  const generate = useGenerateAuditReport({
    mutation: {
      onSuccess: () => {
        if (valid) {
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
        }
      },
    },
  });
  const deleteAudit = useDeleteAudit({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListAuditsQueryKey({ source: "screenshot" }),
        });
        queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/matches" as never);
      },
      onError: () => {
        if (Platform.OS !== "web") {
          Alert.alert("Couldn't delete", "Something went wrong. Try again.");
        }
      },
    },
  });

  const askDelete = () => {
    if (!valid) return;
    const name = auditQuery.data?.firstName ?? "this match";
    const message = `Remove ${name} from your matches? This can't be undone.`;
    const run = () => deleteAudit.mutate({ id });
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) run();
      return;
    }
    Alert.alert("Delete match?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: run },
    ]);
  };
  const [report, setReport] = useState<ReportShape | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const storedReport = auditQuery.data?.report ?? null;

  useEffect(() => {
    if (!storedReport || report) return;
    const r = storedReport as unknown as ReportShape;
    setReport({
      readinessScore: r.readinessScore,
      overallGrade: r.overallGrade,
      strengths: r.strengths,
      risks: r.risks,
      bioAudit: r.bioAudit,
      rewrittenBio: r.rewrittenBio,
      messagingStyle: r.messagingStyle,
      coachingCta: r.coachingCta,
      changeSummary: r.changeSummary ?? null,
    });
  }, [storedReport, report]);

  useEffect(() => {
    if (!valid || report || generate.isPending) return;
    if (!auditQuery.data) return;
    if (auditQuery.data.report) return;
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
          changeSummary:
            (r as unknown as { changeSummary?: ChangeSummary | null })
              .changeSummary ?? null,
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
  }, [valid, id, auditQuery.data]);

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom + 20;

  const audit = auditQuery.data;
  const promptList = audit?.prompts
    ? audit.prompts.split("\n").map((p) => p.trim()).filter(Boolean)
    : [];

  const reportGeneratedAt = audit?.reportGeneratedAt ?? null;
  const reportGeneratedLabel = reportGeneratedAt
    ? formatGeneratedAt(reportGeneratedAt)
    : null;

  const storedEngineVersion =
    (storedReport as { engineVersion?: string | null } | null)?.engineVersion ??
    null;
  const isStaleEngine =
    !!storedReport &&
    !!currentEngineVersion &&
    storedEngineVersion !== currentEngineVersion;

  const reportAgeDays = reportGeneratedAt ? ageInDays(reportGeneratedAt) : null;
  const isStaleByAge =
    !!reportGeneratedAt &&
    reportAgeDays !== null &&
    reportAgeDays >= STALE_REPORT_DAYS;

  const regenerate = () => {
    if (!valid || generate.isPending) return;
    setErrorMsg(null);
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
          changeSummary:
            (r as unknown as { changeSummary?: ChangeSummary | null })
              .changeSummary ?? null,
        });
      })
      .catch((err) => {
        const m =
          err instanceof Error
            ? err.message
            : "Couldn't refresh this mini-report.";
        setErrorMsg(m);
      });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: audit?.firstName ? audit.firstName : "Mini-report",
          headerRight: () =>
            valid && audit ? (
              <Pressable
                onPress={askDelete}
                disabled={deleteAudit.isPending}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.headerDelete,
                  { opacity: deleteAudit.isPending ? 0.4 : pressed ? 0.6 : 1 },
                ]}
                accessibilityLabel="Delete match"
              >
                <Feather name="trash-2" size={20} color={colors.destructive} />
              </Pressable>
            ) : null,
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

        {audit && isStaleByAge && reportGeneratedAt ? (
          <View
            style={[
              styles.staleBanner,
              {
                backgroundColor: `${colors.gold}14`,
                borderColor: colors.gold,
              },
            ]}
            testID="banner-stale-report"
          >
            <Feather
              name="alert-circle"
              size={16}
              color={colors.gold}
              style={styles.staleBannerIcon}
            />
            <View style={styles.staleBannerText}>
              <Text
                style={[styles.staleBannerTitle, { color: colors.foreground }]}
                testID="text-stale-report-headline"
              >
                This report was generated {formatStaleAge(reportGeneratedAt)} — regenerate?
              </Text>
              <Text
                style={[
                  styles.staleBannerSubtitle,
                  { color: colors.mutedForeground },
                ]}
              >
                Profiles change fast. A fresh run reflects what's on your profile today.
              </Text>
            </View>
            <Pressable
              onPress={regenerate}
              disabled={generate.isPending}
              hitSlop={8}
              style={({ pressed }) => [
                styles.staleBannerButton,
                {
                  borderColor: colors.gold,
                  backgroundColor: `${colors.gold}22`,
                  opacity: generate.isPending ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
              accessibilityLabel="Regenerate this stale mini-report"
              testID="button-stale-report-regenerate"
            >
              <Feather name="refresh-cw" size={12} color={colors.gold} />
              <Text style={[styles.staleBannerButtonText, { color: colors.gold }]}>
                {generate.isPending ? "Refreshing…" : "Regenerate"}
              </Text>
            </Pressable>
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
            {reportGeneratedLabel || report ? (
              <View style={styles.regenRow}>
                <Text
                  style={[styles.generatedText, { color: colors.mutedForeground }]}
                >
                  {reportGeneratedLabel
                    ? `Report from ${reportGeneratedLabel}`
                    : "Report generated"}
                </Text>
                {isStaleEngine ? (
                  <View
                    style={[
                      styles.staleBadge,
                      {
                        backgroundColor: `${colors.gold}22`,
                        borderColor: colors.gold,
                      },
                    ]}
                    accessibilityLabel="This report is from an older engine"
                  >
                    <Feather
                      name="alert-circle"
                      size={11}
                      color={colors.gold}
                    />
                    <Text style={[styles.staleText, { color: colors.gold }]}>
                      Older engine
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={regenerate}
                  disabled={generate.isPending}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.regenButton,
                    {
                      borderColor: colors.primary,
                      opacity: generate.isPending ? 0.5 : pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel={
                    isStaleEngine
                      ? "Re-run mini-report with latest engine"
                      : "Regenerate mini-report"
                  }
                >
                  <Feather
                    name="refresh-cw"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={[styles.regenText, { color: colors.primary }]}>
                    {generate.isPending
                      ? "Refreshing…"
                      : isStaleEngine
                      ? "Re-run with latest"
                      : "Regenerate"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {report?.changeSummary && changeSummaryHasChanges(report.changeSummary) ? (
          <View
            style={[
              styles.changeCard,
              {
                backgroundColor: `${colors.violet}10`,
                borderColor: colors.violet,
              },
            ]}
            testID="card-what-changed"
          >
            <View style={styles.changeHeader}>
              <Feather name="zap" size={14} color={colors.violet} />
              <Text style={[styles.changeTitle, { color: colors.foreground }]}>
                What changed since last run
              </Text>
              <View
                style={[
                  styles.changeDeltaBadge,
                  {
                    backgroundColor:
                      report.changeSummary.scoreDelta > 0
                        ? `${colors.success}22`
                        : report.changeSummary.scoreDelta < 0
                        ? `${colors.rose}22`
                        : `${colors.mutedForeground}22`,
                    borderColor:
                      report.changeSummary.scoreDelta > 0
                        ? colors.success
                        : report.changeSummary.scoreDelta < 0
                        ? colors.rose
                        : colors.mutedForeground,
                  },
                ]}
              >
                {report.changeSummary.scoreDelta !== 0 ? (
                  <Feather
                    name={
                      report.changeSummary.scoreDelta > 0
                        ? "arrow-up"
                        : "arrow-down"
                    }
                    size={11}
                    color={
                      report.changeSummary.scoreDelta > 0
                        ? colors.success
                        : colors.rose
                    }
                  />
                ) : null}
                <Text
                  style={[
                    styles.changeDeltaText,
                    {
                      color:
                        report.changeSummary.scoreDelta > 0
                          ? colors.success
                          : report.changeSummary.scoreDelta < 0
                          ? colors.rose
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {report.changeSummary.scoreDelta === 0
                    ? "Score unchanged"
                    : `${report.changeSummary.scoreDelta > 0 ? "+" : ""}${report.changeSummary.scoreDelta} pts`}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.changeSubText, { color: colors.mutedForeground }]}
            >
              Signal Score: {report.changeSummary.previousScore} →{" "}
              {report.changeSummary.newScore}
            </Text>
            {report.changeSummary.addedStrengths.length > 0 ? (
              <View style={styles.changeGroup}>
                <Text style={[styles.changeGroupTitle, { color: colors.success }]}>
                  New strengths
                </Text>
                {report.changeSummary.addedStrengths.map((s, i) => (
                  <ChangeLine
                    key={`as-${i}`}
                    color={colors.success}
                    icon="plus"
                    text={s}
                  />
                ))}
              </View>
            ) : null}
            {report.changeSummary.removedStrengths.length > 0 ? (
              <View style={styles.changeGroup}>
                <Text
                  style={[
                    styles.changeGroupTitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No longer strengths
                </Text>
                {report.changeSummary.removedStrengths.map((s, i) => (
                  <ChangeLine
                    key={`rs-${i}`}
                    color={colors.mutedForeground}
                    icon="minus"
                    text={s}
                    strikethrough
                  />
                ))}
              </View>
            ) : null}
            {report.changeSummary.addedRisks.length > 0 ? (
              <View style={styles.changeGroup}>
                <Text style={[styles.changeGroupTitle, { color: colors.rose }]}>
                  New risks
                </Text>
                {report.changeSummary.addedRisks.map((s, i) => (
                  <ChangeLine
                    key={`ar-${i}`}
                    color={colors.rose}
                    icon="plus"
                    text={s}
                  />
                ))}
              </View>
            ) : null}
            {report.changeSummary.removedRisks.length > 0 ? (
              <View style={styles.changeGroup}>
                <Text
                  style={[
                    styles.changeGroupTitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No longer risks
                </Text>
                {report.changeSummary.removedRisks.map((s, i) => (
                  <ChangeLine
                    key={`rr-${i}`}
                    color={colors.mutedForeground}
                    icon="minus"
                    text={s}
                    strikethrough
                  />
                ))}
              </View>
            ) : null}
            {audit?.previousReportGeneratedAt ? (
              <Text
                style={[
                  styles.changeFooter,
                  { color: colors.mutedForeground, borderTopColor: colors.cardBorder },
                ]}
              >
                Comparing to your previous run from{" "}
                {formatGeneratedAt(audit.previousReportGeneratedAt)}.
              </Text>
            ) : null}
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

function ChangeLine({
  color,
  icon,
  text,
  strikethrough = false,
}: {
  color: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  text: string;
  strikethrough?: boolean;
}) {
  return (
    <View style={styles.changeLine}>
      <Feather name={icon} size={12} color={color} style={styles.changeIcon} />
      <Text
        style={[
          styles.changeLineText,
          { color },
          strikethrough ? styles.strikethrough : null,
        ]}
      >
        {text}
      </Text>
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
  headerDelete: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
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
  staleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  staleBannerIcon: {
    marginTop: 2,
  },
  staleBannerText: {
    flex: 1,
    gap: 2,
  },
  staleBannerTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    lineHeight: 17,
  },
  staleBannerSubtitle: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 15,
  },
  staleBannerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  staleBannerButtonText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
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
  regenRow: {
    marginTop: 10,
    alignItems: "center",
    gap: 8,
  },
  staleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  staleText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  generatedText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    letterSpacing: 0.2,
  },
  regenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  regenText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
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
  changeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  changeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  changeTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  changeDeltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changeDeltaText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
  },
  changeSubText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    letterSpacing: 0.2,
  },
  changeGroup: {
    marginTop: 6,
    gap: 4,
  },
  changeGroupTitle: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  changeLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  changeIcon: {
    marginTop: 3,
  },
  changeLineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 17,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  changeFooter: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
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
