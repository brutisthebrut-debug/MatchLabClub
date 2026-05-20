import { Feather } from "@expo/vector-icons";
import {
  getListAuditsQueryKey,
  getListTrashedAuditsQueryKey,
  useListTrashedAudits,
  usePurgeAudit,
  useRestoreAudit,
  type Audit,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function formatDeleted(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Deleted today";
  if (days === 1) return "Deleted yesterday";
  if (days < 30) return `Deleted ${days} days ago`;
  return `Deleted ${d.toLocaleDateString()}`;
}

function daysUntilPurge(iso: string | null | undefined): number {
  if (!iso) return 30;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 30;
  const elapsed = Math.floor(
    (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(0, 30 - elapsed);
}

export default function TrashScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isRefetching } =
    useListTrashedAudits();
  const restore = useRestoreAudit();
  const purge = usePurgeAudit();

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: getListTrashedAuditsQueryKey(),
    });
    void queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: ["/audits/summary"] });
  }, [queryClient]);

  const handleRestore = React.useCallback(
    (audit: Audit) => {
      restore.mutate(
        { id: audit.id },
        {
          onSuccess: () => invalidate(),
          onError: () =>
            Alert.alert("Couldn't restore", "Please try again in a moment."),
        },
      );
    },
    [restore, invalidate],
  );

  const handlePurge = React.useCallback(
    (audit: Audit) => {
      Alert.alert(
        "Delete forever?",
        `${audit.firstName ?? "This match"} will be permanently removed. This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              purge.mutate(
                { id: audit.id },
                {
                  onSuccess: () => invalidate(),
                  onError: () =>
                    Alert.alert(
                      "Couldn't delete",
                      "Please try again in a moment.",
                    ),
                },
              ),
          },
        ],
      );
    },
    [purge, invalidate],
  );

  const audits = (data ?? []) as Audit[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Recently deleted" }} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 24,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.foreground}
          />
        }
      >
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Items in the trash are kept for 30 days, then permanently deleted.
          Restore one to bring it back to your matches.
        </Text>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.foreground} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.mutedForeground }}>
              Couldn't load your trash. Pull to refresh.
            </Text>
          </View>
        ) : audits.length === 0 ? (
          <View
            style={[
              styles.empty,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Feather name="trash-2" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nothing here
            </Text>
            <Text
              style={[styles.emptyBody, { color: colors.mutedForeground }]}
            >
              Deleted matches show up here for 30 days before they're gone for
              good.
            </Text>
          </View>
        ) : (
          audits.map((audit) => {
            const remaining = daysUntilPurge(audit.deletedAt);
            const busy =
              (restore.isPending &&
                restore.variables?.id === audit.id) ||
              (purge.isPending && purge.variables?.id === audit.id);
            return (
              <View
                key={audit.id}
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={[styles.cardTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {audit.firstName ?? "Untitled match"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                    {formatDeleted(audit.deletedAt)} ·{" "}
                    {remaining === 0
                      ? "purges today"
                      : `${remaining} day${remaining === 1 ? "" : "s"} left`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${audit.firstName ?? "match"}`}
                    onPress={() => handleRestore(audit)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: busy || pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="rotate-ccw"
                      size={16}
                      color={colors.primaryForeground}
                    />
                    <Text
                      style={{
                        color: colors.primaryForeground,
                        fontWeight: "600",
                      }}
                    >
                      Restore
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Permanently delete ${audit.firstName ?? "match"}`}
                    onPress={() => handlePurge(audit)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      {
                        borderColor: colors.border,
                        opacity: busy || pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={colors.destructive ?? "#ef4444"}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  center: { paddingVertical: 48, alignItems: "center" },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
