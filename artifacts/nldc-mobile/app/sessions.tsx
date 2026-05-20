import { Feather } from "@expo/vector-icons";
import {
  getListMySessionsQueryKey,
  useListMySessions,
  useRevokeOneSession,
  useRevokeOtherSessions,
  type MySession,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Unknown";
  const diff = Date.now() - then;
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function channelIcon(channel: MySession["channel"]): string {
  if (channel === "mobile") return "smartphone";
  if (channel === "web") return "monitor";
  return "globe";
}

export default function SessionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, logout } = useAuth();

  const sessionsQuery = useListMySessions({
    query: {
      queryKey: getListMySessionsQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const revokeOne = useRevokeOneSession();
  const revokeOthers = useRevokeOtherSessions();
  const [pendingSid, setPendingSid] = useState<string | null>(null);
  const [revokeOthersPending, setRevokeOthersPending] = useState(false);
  const [banner, setBanner] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const sessions = sessionsQuery.data?.sessions ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web"
      ? Math.max(insets.bottom, 34) + 84
      : insets.bottom + 80;

  async function handleRevokeOne(session: MySession) {
    setBanner(null);
    setPendingSid(session.sid);
    try {
      await revokeOne.mutateAsync({ sid: session.sid });
      if (session.current) {
        await logout();
        router.replace("/(tabs)/account");
        return;
      }
      setBanner({
        kind: "success",
        text: "That device has been signed out.",
      });
      await queryClient.invalidateQueries({
        queryKey: getListMySessionsQueryKey(),
      });
    } catch (err) {
      setBanner({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : "Couldn't revoke that sign-in. Please try again.",
      });
    } finally {
      setPendingSid(null);
    }
  }

  async function handleRevokeOthers() {
    setBanner(null);
    setRevokeOthersPending(true);
    try {
      const result = await revokeOthers.mutateAsync();
      setBanner({
        kind: "success",
        text:
          result.revoked === 0
            ? "There were no other active sign-ins."
            : `Signed out ${result.revoked} other ${result.revoked === 1 ? "device" : "devices"}.`,
      });
      await queryClient.invalidateQueries({
        queryKey: getListMySessionsQueryKey(),
      });
    } catch (err) {
      setBanner({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : "Couldn't sign out other devices. Please try again.",
      });
    } finally {
      setRevokeOthersPending(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: `${colors.violet}22` },
            ]}
          >
            <Feather name="shield" size={20} color={colors.violet} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Devices & sign-ins
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Every browser or app currently signed in to your account. Revoke any
            device you don&apos;t recognize.
          </Text>
        </View>

        {banner ? (
          <View
            testID="sessions-banner"
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

        {!isAuthenticated ? (
          <View
            testID="sessions-signed-out"
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Feather name="lock" size={18} color={colors.mutedForeground} />
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              Sign in to manage your devices.
            </Text>
          </View>
        ) : sessionsQuery.isLoading ? (
          <View
            testID="sessions-list-loading"
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                alignItems: "center",
                paddingVertical: 28,
              },
            ]}
          >
            <ActivityIndicator color={colors.violet} />
          </View>
        ) : sessionsQuery.isError ? (
          <View
            testID="sessions-error"
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Feather name="alert-circle" size={18} color={colors.destructive} />
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              Couldn&apos;t load your active sessions. Please pull down to
              refresh.
            </Text>
          </View>
        ) : (
          <View testID="sessions-list">
            <View style={styles.listHeader}>
              <Text
                style={[styles.listCount, { color: colors.mutedForeground }]}
              >
                {sessions.length}{" "}
                {sessions.length === 1 ? "active sign-in" : "active sign-ins"}
              </Text>
              <Pressable
                testID="button-revoke-others"
                disabled={otherCount === 0 || revokeOthersPending}
                onPress={() => {
                  void handleRevokeOthers();
                }}
                style={({ pressed }) => [
                  styles.revokeAllBtn,
                  {
                    borderColor: `${colors.destructive}66`,
                    backgroundColor:
                      otherCount === 0
                        ? "transparent"
                        : `${colors.destructive}14`,
                    opacity:
                      otherCount === 0 || revokeOthersPending
                        ? 0.45
                        : pressed
                          ? 0.75
                          : 1,
                  },
                ]}
              >
                {revokeOthersPending ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <>
                    <Feather name="x" size={13} color={colors.destructive} />
                    <Text
                      style={[
                        styles.revokeAllLabel,
                        { color: colors.destructive },
                      ]}
                    >
                      Sign out everywhere else
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {sessions.map((s) => {
              const busy = pendingSid === s.sid;
              return (
                <View
                  key={s.sid}
                  testID={`session-row-${s.sid}`}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: s.current
                        ? `${colors.violet}55`
                        : colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.sessionRow}>
                    <View
                      style={[
                        styles.channelBubble,
                        { backgroundColor: `${colors.violet}22` },
                      ]}
                    >
                      <Feather
                        name={channelIcon(s.channel) as "smartphone" | "monitor" | "globe"}
                        size={16}
                        color={colors.violet}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.deviceLabelRow}>
                        <Text
                          testID={`session-device-${s.sid}`}
                          style={[
                            styles.deviceLabel,
                            { color: colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {s.deviceLabel ?? "Unknown device"}
                        </Text>
                        {s.current ? (
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: `${colors.violet}22`, borderColor: `${colors.violet}55` },
                            ]}
                          >
                            <Text
                              testID={`session-current-badge-${s.sid}`}
                              style={[
                                styles.badgeText,
                                { color: colors.violet },
                              ]}
                            >
                              This device
                            </Text>
                          </View>
                        ) : null}
                        {s.channel === "mobile" && !s.current ? (
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: `${colors.mutedForeground}18`,
                                borderColor: `${colors.mutedForeground}33`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Mobile app
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        testID={`session-last-seen-${s.sid}`}
                        style={[
                          styles.metaText,
                          { color: colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        Last active {formatRelative(s.lastSeenAt)}
                        {s.ip ? ` · ${s.ip}` : ""}
                      </Text>
                      <Text
                        style={[
                          styles.metaText,
                          { color: colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        Signed in {formatRelative(s.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    testID={`button-revoke-session-${s.sid}`}
                    disabled={busy}
                    onPress={() => {
                      void handleRevokeOne(s);
                    }}
                    style={({ pressed }) => [
                      styles.revokeBtn,
                      {
                        borderColor: `${colors.destructive}66`,
                        backgroundColor: `${colors.destructive}14`,
                        opacity: busy ? 0.5 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.destructive}
                      />
                    ) : (
                      <>
                        <Feather
                          name={s.current ? "log-out" : "x"}
                          size={14}
                          color={colors.destructive}
                        />
                        <Text
                          style={[
                            styles.revokeBtnLabel,
                            { color: colors.destructive },
                          ]}
                        >
                          {s.current ? "Sign out" : "Revoke"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })}

            <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
              Revoked sessions stop working immediately. Sessions you don&apos;t
              use automatically expire after a week.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },
  header: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
    marginBottom: 4,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    flex: 1,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  emptyText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 4,
    gap: 12,
    flexWrap: "wrap",
  },
  listCount: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
  },
  revokeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  revokeAllLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  channelBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  deviceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 3,
  },
  deviceLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
  },
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
  },
  metaText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  revokeBtnLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
  },
  footnote: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 8,
    marginTop: 4,
  },
});
