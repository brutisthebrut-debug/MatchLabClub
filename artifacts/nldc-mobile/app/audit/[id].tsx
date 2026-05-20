import { Feather } from "@expo/vector-icons";
import {
  getGetAuditQueryKey,
  getListAuditReportVersionsQueryKey,
  getListAuditsQueryKey,
  useDeleteAudit,
  useGenerateAuditReport,
  useGetAudit,
  useGetEngineMeta,
  useListAuditReportVersions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CopyButton } from "@/components/CopyButton";
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

interface PromptRewrite {
  original: string;
  rewritten: string;
  tip?: string;
}

interface ActionItem {
  priority: number;
  title: string;
  description: string;
  timeframe?: string;
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
  rewrittenPrompts?: PromptRewrite[];
  actionPlan?: ActionItem[];
}

type VersionEntry = {
  id: number;
  readinessScore: number;
  generatedAt: string;
  changeSummary?: unknown;
  report?: unknown;
};

function summarizeVersion(v: VersionEntry, idx: number, total: number): string {
  const cs = v.changeSummary as ChangeSummary | null | undefined;
  if (!cs) {
    return idx === total - 1 ? "First generation" : `Score ${v.readinessScore}`;
  }
  const bits: string[] = [];
  if (cs.addedStrengths?.length)
    bits.push(`+${cs.addedStrengths.length} strength${cs.addedStrengths.length === 1 ? "" : "s"}`);
  if (cs.removedStrengths?.length)
    bits.push(`−${cs.removedStrengths.length} strength${cs.removedStrengths.length === 1 ? "" : "s"}`);
  if (cs.addedRisks?.length)
    bits.push(`+${cs.addedRisks.length} risk${cs.addedRisks.length === 1 ? "" : "s"}`);
  if (cs.removedRisks?.length)
    bits.push(`−${cs.removedRisks.length} risk${cs.removedRisks.length === 1 ? "" : "s"}`);
  if (bits.length === 0)
    return cs.scoreDelta === 0
      ? "Re-run, no changes"
      : `Score ${cs.scoreDelta > 0 ? "+" : ""}${cs.scoreDelta}`;
  return bits.join(" · ");
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
  const versionsQuery = useListAuditReportVersions(valid ? id : 0, {
    query: {
      enabled: valid,
      queryKey: getListAuditReportVersionsQueryKey(valid ? id : 0),
    },
  });
  const versions = versionsQuery.data?.versions ?? [];
  const generate = useGenerateAuditReport({
    mutation: {
      onSuccess: () => {
        if (valid) {
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
          queryClient.invalidateQueries({
            queryKey: getListAuditReportVersionsQueryKey(id),
          });
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
  const [viewingVersionId, setViewingVersionId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

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
      rewrittenPrompts: r.rewrittenPrompts,
      actionPlan: r.actionPlan,
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
          rewrittenPrompts: (r as unknown as ReportShape).rewrittenPrompts,
          actionPlan: (r as unknown as ReportShape).actionPlan,
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
        setViewingVersionId(null);
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
          rewrittenPrompts: (r as unknown as ReportShape).rewrittenPrompts,
          actionPlan: (r as unknown as ReportShape).actionPlan,
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

  const viewVersion = (versionId: number) => {
    const v = versions.find((x) => x.id === versionId);
    if (!v) return;
    const r = v.report as unknown as ReportShape;
    setViewingVersionId(versionId);
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
        (v.changeSummary as ChangeSummary | null | undefined) ?? null,
    });
  };

  const viewLatest = () => {
    setViewingVersionId(null);
    if (storedReport) {
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
    }
  };

  const viewingVersion =
    viewingVersionId != null
      ? versions.find((v) => v.id === viewingVersionId) ?? null
      : null;

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
              <View
                style={[
                  styles.changeFooterRow,
                  { borderTopColor: colors.cardBorder },
                ]}
              >
                <Text
                  style={[
                    styles.changeFooter,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Comparing to your previous run from{" "}
                  {formatGeneratedAt(audit.previousReportGeneratedAt)}.
                </Text>
                {audit?.previousReport ? (
                  <Pressable
                    onPress={() => setShowPrevious(true)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.viewPrevButton,
                      {
                        borderColor: colors.violet,
                        backgroundColor: `${colors.violet}14`,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityLabel="View previous version of this report"
                    testID="button-view-previous-version"
                  >
                    <Feather name="eye" size={12} color={colors.violet} />
                    <Text style={[styles.viewPrevText, { color: colors.violet }]}>
                      View previous version
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : audit?.previousReport && audit?.previousReportGeneratedAt ? (
          <View
            style={[
              styles.prevLinkCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-previous-version-link"
          >
            <Feather name="eye" size={14} color={colors.violet} />
            <Text
              style={[styles.prevLinkText, { color: colors.mutedForeground }]}
            >
              Previous version from{" "}
              {formatGeneratedAt(audit.previousReportGeneratedAt)} is available.
            </Text>
            <Pressable
              onPress={() => setShowPrevious(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.viewPrevButton,
                {
                  borderColor: colors.violet,
                  backgroundColor: `${colors.violet}14`,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityLabel="View previous version of this report"
              testID="button-view-previous-version"
            >
              <Text style={[styles.viewPrevText, { color: colors.violet }]}>
                View
              </Text>
            </Pressable>
          </View>
        ) : null}

        {viewingVersion ? (
          <View
            style={[
              styles.versionBanner,
              {
                backgroundColor: `${colors.teal}14`,
                borderColor: colors.teal,
              },
            ]}
            testID="banner-viewing-version"
          >
            <Feather name="clock" size={14} color={colors.teal} />
            <View style={styles.versionBannerText}>
              <Text style={[styles.versionBannerTitle, { color: colors.foreground }]}>
                Viewing version from {formatGeneratedAt(viewingVersion.generatedAt)} (score {viewingVersion.readinessScore})
              </Text>
              <Text
                style={[
                  styles.versionBannerSubtitle,
                  { color: colors.mutedForeground },
                ]}
              >
                Historical snapshot — your latest report hasn't changed.
              </Text>
            </View>
            <Pressable
              onPress={viewLatest}
              hitSlop={8}
              style={({ pressed }) => [
                styles.versionBannerButton,
                {
                  borderColor: colors.teal,
                  backgroundColor: `${colors.teal}22`,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityLabel="Back to latest version"
              testID="button-view-latest"
            >
              <Text style={[styles.versionBannerButtonText, { color: colors.teal }]}>
                Latest
              </Text>
            </Pressable>
          </View>
        ) : null}

        {valid && versions.length > 1 ? (
          <View
            style={[
              styles.historyCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="card-regeneration-history"
          >
            <View style={styles.historyHeader}>
              <Pressable
                onPress={() => setHistoryOpen((o) => !o)}
                style={({ pressed }) => [
                  styles.historyHeaderPressable,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityLabel="Toggle regeneration history"
                accessibilityState={{ expanded: historyOpen }}
                testID="button-toggle-history"
              >
                <Feather name="clock" size={16} color={colors.violet} />
                <View style={styles.historyHeaderText}>
                  <Text style={[styles.historyTitle, { color: colors.foreground }]}>
                    Regeneration history
                  </Text>
                  <Text
                    style={[
                      styles.historySubtitle,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {versions.length} versions on file
                    {compareMode ? " — pick 2 to compare" : " — tap any to view"}
                  </Text>
                </View>
                <Feather
                  name={historyOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {versions.length >= 2 ? (
                <Pressable
                  onPress={() => {
                    setCompareMode((m) => !m);
                    setCompareIds([]);
                    if (!historyOpen) setHistoryOpen(true);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.compareModeButton,
                    {
                      borderColor: compareMode ? colors.violet : colors.cardBorder,
                      backgroundColor: compareMode
                        ? `${colors.violet}22`
                        : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel="Toggle compare mode"
                  testID="button-toggle-compare-mode"
                >
                  <Feather
                    name="git-merge"
                    size={12}
                    color={compareMode ? colors.violet : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.compareModeText,
                      {
                        color: compareMode
                          ? colors.violet
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    Compare
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {historyOpen ? (
              <>
                {compareMode && compareIds.length === 2 ? (
                  <View
                    style={[
                      styles.compareReadyBar,
                      {
                        borderTopColor: colors.cardBorder,
                        backgroundColor: `${colors.violet}10`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.compareReadyText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      2 versions selected
                    </Text>
                    <Pressable
                      onPress={() => setCompareOpen(true)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.compareGoButton,
                        {
                          backgroundColor: colors.violet,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      accessibilityLabel="Compare selected versions"
                      testID="button-open-compare"
                    >
                      <Feather name="git-merge" size={12} color="white" />
                      <Text style={styles.compareGoText}>Compare</Text>
                    </Pressable>
                  </View>
                ) : compareMode ? (
                  <View
                    style={[
                      styles.compareHintBar,
                      {
                        borderTopColor: colors.cardBorder,
                        backgroundColor: `${colors.violet}08`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.compareHintText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {compareIds.length === 0
                        ? "Tap 2 versions to compare"
                        : "Tap 1 more version"}
                    </Text>
                  </View>
                ) : null}
              <View
                style={[styles.historyList, { borderTopColor: colors.cardBorder }]}
                testID="list-versions"
              >
                {versions.map((v, idx) => {
                  const isLatest = idx === 0;
                  const isActive =
                    !compareMode &&
                    ((viewingVersionId == null && isLatest) ||
                    viewingVersionId === v.id);
                  const isSelected = compareMode && compareIds.includes(v.id);
                  const cs = v.changeSummary as
                    | ChangeSummary
                    | null
                    | undefined;
                  const delta = cs?.scoreDelta ?? null;
                  const summaryLine = summarizeVersion(v, idx, versions.length);
                  const badgeColor =
                    v.readinessScore >= 75
                      ? colors.success
                      : v.readinessScore >= 55
                      ? colors.gold
                      : colors.rose;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => {
                        if (compareMode) {
                          setCompareIds((prev) => {
                            if (prev.includes(v.id))
                              return prev.filter((x) => x !== v.id);
                            if (prev.length >= 2) return prev;
                            return [...prev, v.id];
                          });
                        } else {
                          isLatest ? viewLatest() : viewVersion(v.id);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.versionRow,
                        {
                          borderTopColor: colors.cardBorder,
                          backgroundColor: isSelected
                            ? `${colors.violet}18`
                            : isActive
                            ? `${colors.violet}10`
                            : pressed
                            ? `${colors.mutedForeground}10`
                            : "transparent",
                        },
                      ]}
                      testID={`button-view-version-${v.id}`}
                    >
                      <View
                        style={[
                          styles.versionScore,
                          {
                            backgroundColor: `${badgeColor}22`,
                            borderColor: badgeColor,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.versionScoreText, { color: badgeColor }]}
                        >
                          {v.readinessScore}
                        </Text>
                      </View>
                      <View style={styles.versionMeta}>
                        <View style={styles.versionTitleRow}>
                          <Text
                            style={[
                              styles.versionTitle,
                              { color: colors.foreground },
                            ]}
                            testID={`text-version-time-${v.id}`}
                          >
                            {formatGeneratedAt(v.generatedAt)}
                          </Text>
                          {isLatest ? (
                            <View
                              style={[
                                styles.versionPill,
                                {
                                  backgroundColor: `${colors.success}22`,
                                  borderColor: colors.success,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.versionPillText,
                                  { color: colors.success },
                                ]}
                              >
                                Latest
                              </Text>
                            </View>
                          ) : null}
                          {delta !== null && delta !== 0 ? (
                            <View
                              style={[
                                styles.versionPill,
                                {
                                  backgroundColor: `${
                                    delta > 0 ? colors.success : colors.rose
                                  }22`,
                                  borderColor:
                                    delta > 0 ? colors.success : colors.rose,
                                },
                              ]}
                              testID={`badge-version-delta-${v.id}`}
                            >
                              <Feather
                                name={delta > 0 ? "arrow-up" : "arrow-down"}
                                size={10}
                                color={delta > 0 ? colors.success : colors.rose}
                              />
                              <Text
                                style={[
                                  styles.versionPillText,
                                  {
                                    color:
                                      delta > 0 ? colors.success : colors.rose,
                                  },
                                ]}
                              >
                                {delta > 0 ? "+" : ""}
                                {delta}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.versionSummary,
                            { color: colors.mutedForeground },
                          ]}
                          testID={`text-version-summary-${v.id}`}
                        >
                          {summaryLine}
                        </Text>
                      </View>
                      {compareMode ? (
                        <Feather
                          name={isSelected ? "check-square" : "square"}
                          size={18}
                          color={
                            isSelected ? colors.violet : colors.mutedForeground
                          }
                        />
                      ) : (
                        <Feather
                          name="chevron-right"
                          size={14}
                          color={colors.mutedForeground}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
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
              title="Rewritten bio"
              iconBg={`${colors.violet}22`}
              iconColor={colors.violet}
              icon="feather"
              testID="section-rewritten-bio"
              headerRight={<CopyButton text={report.rewrittenBio} />}
            >
              <Text style={[styles.body, { color: colors.foreground }]} testID="text-rewritten-bio">
                {report.rewrittenBio}
              </Text>
            </Section>

            {report.rewrittenPrompts && report.rewrittenPrompts.length > 0 ? (
              <Section
                title="Prompt rewrites"
                iconBg={`${colors.gold}22`}
                iconColor={colors.gold}
                icon="message-square"
              >
                {report.rewrittenPrompts.map((p, i) => (
                  <View
                    key={`rp-${i}`}
                    style={styles.prevPromptItem}
                    testID={`card-prompt-rewrite-${i}`}
                  >
                    <Text style={[styles.prevPromptOriginal, { color: colors.mutedForeground }]}>
                      {p.original}
                    </Text>
                    <View style={styles.prevPromptRewrittenRow}>
                      <Text style={[styles.prevPromptRewritten, { color: colors.foreground, flex: 1 }]}>
                        {p.rewritten}
                      </Text>
                      <CopyButton text={p.rewritten} />
                    </View>
                    {p.tip ? (
                      <Text style={[styles.body, { color: colors.mutedForeground, fontSize: 12 }]}>
                        {p.tip}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </Section>
            ) : null}

            {report.actionPlan && report.actionPlan.length > 0 ? (
              <Section
                title="Action plan"
                iconBg={`${colors.violet}22`}
                iconColor={colors.violet}
                icon="target"
              >
                {report.actionPlan.map((item, i) => (
                  <View
                    key={`ap-${i}`}
                    style={styles.prevActionItem}
                    testID={`card-action-item-${i}`}
                  >
                    <View style={[styles.prevActionPriority, { backgroundColor: colors.violet }]}>
                      <Text style={styles.prevActionPriorityText}>{item.priority}</Text>
                    </View>
                    <View style={styles.prevActionBody}>
                      <Text style={[styles.prevActionTitle, { color: colors.foreground }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.prevActionDesc, { color: colors.mutedForeground }]}>
                        {item.description}
                      </Text>
                    </View>
                    <CopyButton text={`${item.title}: ${item.description}`} />
                  </View>
                ))}
              </Section>
            ) : null}

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

      <Modal
        visible={showPrevious}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrevious(false)}
        transparent={false}
      >
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: Platform.OS === "web" ? 16 : topInset,
                borderBottomColor: colors.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeaderText}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Previous version
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { color: colors.mutedForeground },
                ]}
                testID="text-previous-version-generated-at"
              >
                {audit?.previousReportGeneratedAt
                  ? `Generated ${formatGeneratedAt(audit.previousReportGeneratedAt)}`
                  : "Earlier audit"}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowPrevious(false)}
              hitSlop={12}
              accessibilityLabel="Close previous version"
              testID="button-close-previous-version"
              style={({ pressed }) => [
                styles.modalClose,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: bottomInset, paddingTop: 12 },
            ]}
            testID="previous-version-content"
          >
            {audit?.previousReport ? (
              <PreviousReportContent
                report={audit.previousReport as unknown as ReportShape}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Compare versions modal ── */}
      {(() => {
        if (!compareOpen || compareIds.length !== 2) return null;
        const idA = compareIds[0]!;
        const idB = compareIds[1]!;
        const vA = versions.find((v: VersionEntry) => v.id === idA) ?? null;
        const vB = versions.find((v: VersionEntry) => v.id === idB) ?? null;
        if (!vA || !vB) return null;
        const [olderV, newerV] =
          new Date(vA.generatedAt) <= new Date(vB.generatedAt)
            ? [vA, vB]
            : [vB, vA];
        return (
          <CompareVersionsModal
            visible={compareOpen}
            onClose={() => setCompareOpen(false)}
            versionA={olderV}
            versionB={newerV}
            topInset={topInset}
            bottomInset={bottomInset}
          />
        );
      })()}
    </View>
  );
}

function CompareVersionsModal({
  visible,
  onClose,
  versionA,
  versionB,
  topInset,
  bottomInset,
}: {
  visible: boolean;
  onClose: () => void;
  versionA: VersionEntry;
  versionB: VersionEntry;
  topInset: number;
  bottomInset: number;
}) {
  const colors = useColors();
  const repA = versionA.report as ReportShape | undefined;
  const repB = versionB.report as ReportShape | undefined;

  const scoreA = versionA.readinessScore;
  const scoreB = versionB.readinessScore;
  const scoreDelta = scoreB - scoreA;

  const strengthsDiff = computeDiff(repA?.strengths ?? [], repB?.strengths ?? []);
  const risksDiff = computeDiff(repA?.risks ?? [], repB?.risks ?? []);
  const bioA = repA?.rewrittenBio ?? null;
  const bioB = repB?.rewrittenBio ?? null;
  const bioTokens = (bioA || bioB) ? wordDiff(bioA ?? "", bioB ?? "") : null;

  const scoreColorA =
    scoreA >= 75 ? colors.success : scoreA >= 55 ? colors.gold : colors.rose;
  const scoreColorB =
    scoreB >= 75 ? colors.success : scoreB >= 55 ? colors.gold : colors.rose;
  const deltaTint =
    scoreDelta > 0 ? colors.success : scoreDelta < 0 ? colors.rose : colors.mutedForeground;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.modalHeader,
            {
              paddingTop: Platform.OS === "web" ? 16 : topInset,
              borderBottomColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.modalHeaderText}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Version comparison
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: colors.mutedForeground }]}
            >
              {formatGeneratedAt(versionA.generatedAt)} → {formatGeneratedAt(versionB.generatedAt)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close comparison"
            testID="button-close-compare"
            style={({ pressed }) => [
              styles.modalClose,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomInset, paddingTop: 12 },
          ]}
          testID="compare-version-content"
        >
          {/* Score section */}
          <View
            style={[
              styles.compareSection,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="compare-score-section"
          >
            <Text style={[styles.compareSectionTitle, { color: colors.mutedForeground }]}>
              SIGNAL SCORE
            </Text>
            <View style={styles.compareScoreRow}>
              <View style={styles.compareScoreCol} testID="compare-score-a">
                <Text
                  style={[
                    styles.compareSectionSubLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {formatGeneratedAt(versionA.generatedAt)}
                </Text>
                <Text style={[styles.compareScoreNum, { color: scoreColorA }]}>
                  {scoreA}
                </Text>
              </View>
              <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
              <View style={styles.compareScoreCol} testID="compare-score-b">
                <Text
                  style={[
                    styles.compareSectionSubLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {formatGeneratedAt(versionB.generatedAt)}
                </Text>
                <Text style={[styles.compareScoreNum, { color: scoreColorB }]}>
                  {scoreB}
                </Text>
              </View>
              <View
                style={[
                  styles.versionPill,
                  {
                    backgroundColor: `${deltaTint}22`,
                    borderColor: deltaTint,
                    marginLeft: "auto",
                  },
                ]}
                testID="compare-score-delta"
              >
                {scoreDelta !== 0 ? (
                  <Feather
                    name={scoreDelta > 0 ? "arrow-up" : "arrow-down"}
                    size={10}
                    color={deltaTint}
                  />
                ) : null}
                <Text style={[styles.versionPillText, { color: deltaTint }]}>
                  {scoreDelta === 0
                    ? "No change"
                    : `${scoreDelta > 0 ? "+" : ""}${scoreDelta} pts`}
                </Text>
              </View>
            </View>
          </View>

          {/* Strengths diff */}
          <View
            style={[
              styles.compareSection,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="compare-strengths-section"
          >
            <Text style={[styles.compareSectionTitle, { color: colors.violet }]}>
              STRENGTHS
            </Text>
            {strengthsDiff.length > 0 ? (
              strengthsDiff.map((item, i) => (
                <CompareDiffItem key={`cs-${i}`} item={item} />
              ))
            ) : (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                No strength data for these versions.
              </Text>
            )}
          </View>

          {/* Risks diff */}
          <View
            style={[
              styles.compareSection,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            testID="compare-risks-section"
          >
            <Text style={[styles.compareSectionTitle, { color: colors.gold }]}>
              RISKS
            </Text>
            {risksDiff.length > 0 ? (
              risksDiff.map((item, i) => (
                <CompareDiffItem key={`cr-${i}`} item={item} />
              ))
            ) : (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                No risk data for these versions.
              </Text>
            )}
          </View>

          {/* Bio word-level diff */}
          {bioTokens ? (
            <View
              style={[
                styles.compareSection,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
              testID="compare-bio-section"
            >
              <View style={styles.compareBioHeader}>
                <Text
                  style={[styles.compareSectionTitle, { color: colors.mutedForeground }]}
                >
                  REWRITTEN BIO
                </Text>
                <View style={styles.compareBioLegend}>
                  <Text style={[styles.compareBioLegendChip, { backgroundColor: `${colors.rose}38`, color: colors.rose }]}>
                    removed
                  </Text>
                  <Text style={[styles.compareBioLegendChip, { backgroundColor: `${colors.success}38`, color: colors.success }]}>
                    added
                  </Text>
                </View>
              </View>
              <WordDiffText tokens={bioTokens} />
            </View>
          ) : null}

          {/* Legend */}
          <View style={styles.compareLegend}>
            <View style={styles.compareLegendItem}>
              <Feather name="plus" size={12} color={colors.success} />
              <Text style={[styles.compareLegendText, { color: colors.mutedForeground }]}>Added</Text>
            </View>
            <View style={styles.compareLegendItem}>
              <Feather name="minus" size={12} color={colors.rose} />
              <Text style={[styles.compareLegendText, { color: colors.mutedForeground }]}>Removed</Text>
            </View>
            <View style={styles.compareLegendItem}>
              <Text style={{ color: colors.mutedForeground, opacity: 0.4 }}>·</Text>
              <Text style={[styles.compareLegendText, { color: colors.mutedForeground }]}>Unchanged</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

type DiffItem = { text: string; status: "added" | "removed" | "kept" };

function computeDiff(a: string[], b: string[]): DiffItem[] {
  const setA = new Set(a);
  const setB = new Set(b);
  const all = Array.from(new Set([...a, ...b]));
  return all.map((text) => {
    if (setA.has(text) && setB.has(text)) return { text, status: "kept" as const };
    if (!setA.has(text) && setB.has(text)) return { text, status: "added" as const };
    return { text, status: "removed" as const };
  });
}

type WordToken = { word: string; status: "added" | "removed" | "kept" };

function wordDiff(textA: string, textB: string): WordToken[] {
  const wordsA = textA.match(/\S+/g) ?? [];
  const wordsB = textB.match(/\S+/g) ?? [];
  const m = wordsA.length;
  const n = wordsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = wordsA[i - 1] === wordsB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const tokens: WordToken[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      tokens.unshift({ word: wordsA[i - 1], status: "kept" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ word: wordsB[j - 1], status: "added" });
      j--;
    } else {
      tokens.unshift({ word: wordsA[i - 1], status: "removed" });
      i--;
    }
  }
  return tokens;
}

function WordDiffText({ tokens }: { tokens: WordToken[] }) {
  const colors = useColors();
  return (
    <Text style={styles.body} testID="bio-word-diff">
      {tokens.map((token, i) => {
        const space = i < tokens.length - 1 ? " " : "";
        if (token.status === "added") {
          return (
            <Text
              key={i}
              style={{
                backgroundColor: `${colors.success}38`,
                color: colors.success,
              }}
            >
              {token.word}
              {space}
            </Text>
          );
        }
        if (token.status === "removed") {
          return (
            <Text
              key={i}
              style={{
                backgroundColor: `${colors.rose}38`,
                color: colors.rose,
                textDecorationLine: "line-through",
              }}
            >
              {token.word}
              {space}
            </Text>
          );
        }
        return (
          <Text key={i} style={{ color: colors.mutedForeground }}>
            {token.word}
            {space}
          </Text>
        );
      })}
    </Text>
  );
}

function CompareDiffItem({ item }: { item: DiffItem }) {
  const colors = useColors();
  if (item.status === "added") {
    return (
      <View style={styles.changeLine} testID="diff-item-added">
        <Feather name="plus" size={12} color={colors.success} style={styles.changeIcon} />
        <Text style={[styles.compareItemText, { color: colors.success }]}>{item.text}</Text>
      </View>
    );
  }
  if (item.status === "removed") {
    return (
      <View style={styles.changeLine} testID="diff-item-removed">
        <Feather name="minus" size={12} color={colors.rose} style={styles.changeIcon} />
        <Text style={[styles.compareItemText, styles.strikethrough, { color: colors.mutedForeground }]}>
          {item.text}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.changeLine} testID="diff-item-kept">
      <Text style={[styles.changeIcon, { color: colors.mutedForeground, opacity: 0.3 }]}>·</Text>
      <Text style={[styles.compareItemText, { color: colors.mutedForeground }]}>{item.text}</Text>
    </View>
  );
}


function PreviousReportContent({ report: pr }: { report: ReportShape }) {
  const colors = useColors();
  return (
    <>
      <View
        style={[
          styles.ringCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <ScoreRing score={pr.readinessScore} />
        <Text style={[styles.gradeText, { color: colors.foreground }]}>
          Grade {pr.overallGrade}
        </Text>
        <Text style={[styles.nameText, { color: colors.mutedForeground }]}>
          {pr.readinessScore} / 100 then
        </Text>
      </View>

      <Section
        title="Strengths then"
        iconBg={`${colors.success}22`}
        iconColor={colors.success}
        icon="check-circle"
      >
        {pr.strengths.map((s, i) => (
          <Bullet key={`ps-${i}`} color={colors.success} text={s} />
        ))}
      </Section>

      <Section
        title="Risks then"
        iconBg={`${colors.rose}22`}
        iconColor={colors.rose}
        icon="alert-triangle"
      >
        {pr.risks.map((s, i) => (
          <Bullet key={`pr-${i}`} color={colors.rose} text={s} />
        ))}
      </Section>

      <Section
        title="Previous bio audit"
        iconBg={`${colors.violet}22`}
        iconColor={colors.violet}
        icon="edit-3"
      >
        <Text style={[styles.body, { color: colors.foreground }]}>
          {pr.bioAudit}
        </Text>
      </Section>

      <Section
        title="Previous rewritten bio"
        iconBg={`${colors.violet}22`}
        iconColor={colors.violet}
        icon="feather"
        headerRight={<CopyButton text={pr.rewrittenBio} />}
      >
        <Text
          style={[styles.body, { color: colors.foreground }]}
          testID="text-previous-rewritten-bio"
        >
          {pr.rewrittenBio}
        </Text>
      </Section>

      {pr.rewrittenPrompts && pr.rewrittenPrompts.length > 0 ? (
        <Section
          title="Previous prompt rewrites"
          iconBg={`${colors.gold}22`}
          iconColor={colors.gold}
          icon="message-square"
        >
          {pr.rewrittenPrompts.map((p, i) => (
            <View
              key={`pp-${i}`}
              style={styles.prevPromptItem}
              testID={`prev-prompt-${i}`}
            >
              <Text
                style={[
                  styles.prevPromptOriginal,
                  { color: colors.mutedForeground },
                ]}
              >
                {p.original}
              </Text>
              <View style={styles.prevPromptRewrittenRow}>
                <Text
                  style={[styles.prevPromptRewritten, { color: colors.foreground, flex: 1 }]}
                >
                  {p.rewritten}
                </Text>
                <CopyButton text={p.rewritten} />
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {pr.actionPlan && pr.actionPlan.length > 0 ? (
        <Section
          title="Previous action plan"
          iconBg={`${colors.violet}22`}
          iconColor={colors.violet}
          icon="target"
        >
          {pr.actionPlan.map((item, i) => (
            <View
              key={`pa-${i}`}
              style={styles.prevActionItem}
              testID={`prev-action-${i}`}
            >
              <View
                style={[
                  styles.prevActionPriority,
                  { backgroundColor: colors.violet },
                ]}
              >
                <Text style={styles.prevActionPriorityText}>{item.priority}</Text>
              </View>
              <View style={styles.prevActionBody}>
                <Text
                  style={[styles.prevActionTitle, { color: colors.foreground }]}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.prevActionDesc,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {item.description}
                </Text>
              </View>
              <CopyButton text={`${item.title}: ${item.description}`} />
            </View>
          ))}
        </Section>
      ) : null}

      <Section
        title="Previous opener strategy"
        iconBg={`${colors.gold}22`}
        iconColor={colors.gold}
        icon="message-circle"
      >
        <Text style={[styles.body, { color: colors.foreground }]}>
          {pr.messagingStyle}
        </Text>
      </Section>
    </>
  );
}

function Section({
  title,
  icon,
  iconBg,
  iconColor,
  headerRight,
  testID,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  iconBg: string;
  iconColor: string;
  headerRight?: React.ReactNode;
  testID?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      testID={testID}
      style={[
        styles.section,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.iconBubble, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={16} color={iconColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, flex: 1 }]}>
          {title}
        </Text>
        {headerRight ?? null}
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
    flex: 1,
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  changeFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
    flexWrap: "wrap",
  },
  viewPrevButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  viewPrevText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
  },
  prevLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  prevLinkText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  modalHeaderText: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  modalClose: {
    padding: 4,
  },
  prevPromptItem: {
    gap: 4,
    paddingVertical: 6,
  },
  prevPromptOriginal: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    fontStyle: "italic",
  },
  prevPromptRewrittenRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  prevPromptRewritten: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    lineHeight: 20,
  },
  prevActionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
  },
  prevActionPriority: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  prevActionPriorityText: {
    color: "white",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  prevActionBody: {
    flex: 1,
    gap: 2,
  },
  prevActionTitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  prevActionDesc: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 17,
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
  versionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  versionBannerText: { flex: 1, gap: 2 },
  versionBannerTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  versionBannerSubtitle: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  versionBannerButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  versionBannerButtonText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyHeaderPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyHeaderText: { flex: 1, gap: 2 },
  historyTitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  historySubtitle: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  compareModeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 10,
  },
  compareModeText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
  },
  compareReadyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
    flexWrap: "wrap",
  },
  compareReadyText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  compareGoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  compareGoText: {
    color: "white",
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
  },
  compareHintBar: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: 1,
  },
  compareHintText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  compareSection: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  compareSectionTitle: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  compareSectionSubLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    marginBottom: 2,
  },
  compareScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  compareScoreCol: {
    alignItems: "center",
    gap: 2,
  },
  compareScoreNum: {
    fontSize: 36,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  compareLegend: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  compareLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  compareLegendText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  compareItemText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 18,
  },
  compareBioHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  compareBioLegend: {
    flexDirection: "row",
    gap: 6,
  },
  compareBioLegendChip: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_600SemiBold",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  historyList: { borderTopWidth: 1 },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  versionScore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  versionScoreText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  versionMeta: { flex: 1, gap: 3 },
  versionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  versionTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  versionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  versionPillText: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  versionSummary: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
