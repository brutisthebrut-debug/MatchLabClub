import { Feather } from "@expo/vector-icons";
import {
  getGetConnectionsQueryKey,
  useGetConnections,
  type Connection,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

const DEMO_CONNECTIONS: Connection[] = [
  {
    id: "demo-1",
    counterpartUserId: "demo-a",
    status: "active",
    closedReason: null,
    closedByYou: false,
    unreadCount: 2,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    lastMessageAt: new Date(Date.now() - 1_800_000).toISOString(),
    lastMessagePreview: "Glad we matched. Your readiness profile is impressive.",
  },
  {
    id: "demo-2",
    counterpartUserId: "demo-b",
    status: "active",
    closedReason: null,
    closedByYou: false,
    unreadCount: 0,
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    lastMessageAt: new Date(Date.now() - 86_400_000).toISOString(),
    lastMessagePreview: "That sounds like a great weekend. Want to compare notes?",
  },
];

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ConnectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const isDemo = !isAuthenticated;

  const connectionsQuery = useGetConnections({
    query: {
      queryKey: getGetConnectionsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const connections = isDemo
    ? DEMO_CONNECTIONS
    : (connectionsQuery.data ?? []);

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
            refreshing={connectionsQuery.isRefetching}
            onRefresh={() => connectionsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          eyebrow="Conversations"
          title="Your mutual matches"
          subtitle="When you and someone both say yes, the conversation opens here."
        />

        {isDemo ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => login()}
            style={[
              styles.signinCard,
              { borderColor: colors.cardBorder, backgroundColor: colors.card },
            ]}
          >
            <Text style={[styles.signinText, { color: colors.foreground }]}>
              This is a sample. Sign in to see your real conversations.
            </Text>
            <View style={[styles.signinBtn, { backgroundColor: colors.primary }]}>
              <Text
                style={[
                  styles.signinBtnText,
                  { color: colors.primaryForeground },
                ]}
              >
                Sign in
              </Text>
            </View>
          </Pressable>
        ) : null}

        {connectionsQuery.isLoading && !isDemo ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : connections.length === 0 ? (
          <View style={styles.center}>
            <Feather name="heart" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No conversations yet. Keep building your Match Readiness and your
              first match will land here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {connections.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => {
                  if (isDemo) {
                    login();
                    return;
                  }
                  router.push(`/messages/${c.id}` as never);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.card,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View
                  style={[styles.avatar, { backgroundColor: colors.primary }]}
                >
                  <Feather
                    name="user"
                    size={18}
                    color={colors.primaryForeground}
                  />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[styles.rowName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {c.status === "closed" ? "Closed conversation" : "Your match"}
                    </Text>
                    <Text
                      style={[styles.rowWhen, { color: colors.mutedForeground }]}
                    >
                      {formatWhen(c.lastMessageAt ?? c.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.rowPreview,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {c.lastMessagePreview ?? "Say hello to start the conversation."}
                  </Text>
                </View>
                {c.unreadCount > 0 ? (
                  <View
                    style={[styles.badge, { backgroundColor: colors.rose }]}
                  >
                    <Text style={styles.badgeText}>{c.unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  center: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  signinCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  signinText: { fontSize: 14, lineHeight: 20 },
  signinBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  signinBtnText: { fontSize: 14, fontWeight: "600" },
  list: { gap: 10, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowName: { fontSize: 15, fontWeight: "600", flex: 1 },
  rowWhen: { fontSize: 12, marginLeft: 8 },
  rowPreview: { fontSize: 13 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
