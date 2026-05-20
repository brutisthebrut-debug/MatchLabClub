import { Feather } from "@expo/vector-icons";
import {
  getListAuditsQueryKey,
  getListTrashedAuditsQueryKey,
  useEmptyTrash,
  useListTrashedAudits,
  usePurgeAudit,
  useRestoreAllTrash,
  useRestoreAudit,
  type Audit,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const PURGE_CONFIRM_PHRASE = "delete";

export default function TrashScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isRefetching } =
    useListTrashedAudits();
  const restore = useRestoreAudit();
  const purge = usePurgeAudit();
  const emptyTrash = useEmptyTrash();
  const restoreAll = useRestoreAllTrash();

  const [purgeTarget, setPurgeTarget] = React.useState<Audit | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = React.useState("");
  const isPurgeConfirmed =
    purgeConfirmText.trim().toLowerCase() === PURGE_CONFIRM_PHRASE;

  const closePurgeConfirm = React.useCallback(() => {
    setPurgeTarget(null);
    setPurgeConfirmText("");
  }, []);

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

  const handlePurge = React.useCallback((audit: Audit) => {
    setPurgeConfirmText("");
    setPurgeTarget(audit);
  }, []);

  const handleConfirmPurge = React.useCallback(() => {
    if (!purgeTarget) return;
    const id = purgeTarget.id;
    purge.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          closePurgeConfirm();
        },
        onError: () => {
          closePurgeConfirm();
          Alert.alert("Couldn't delete", "Please try again in a moment.");
        },
      },
    );
  }, [purge, purgeTarget, invalidate, closePurgeConfirm]);

  const audits = (data ?? []) as Audit[];
  const hasItems = audits.length > 0;
  const bulkBusy = emptyTrash.isPending || restoreAll.isPending;

  const handleEmptyTrash = React.useCallback(() => {
    if (audits.length === 0) return;
    Alert.alert(
      "Empty trash?",
      `Permanently delete ${audits.length} item${audits.length === 1 ? "" : "s"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty trash",
          style: "destructive",
          onPress: () =>
            emptyTrash.mutate(undefined, {
              onSuccess: () => invalidate(),
              onError: () =>
                Alert.alert(
                  "Couldn't empty trash",
                  "Please try again in a moment.",
                ),
            }),
        },
      ],
    );
  }, [audits.length, emptyTrash, invalidate]);

  const handleRestoreAll = React.useCallback(() => {
    if (audits.length === 0) return;
    restoreAll.mutate(undefined, {
      onSuccess: () => invalidate(),
      onError: () =>
        Alert.alert("Couldn't restore", "Please try again in a moment."),
    });
  }, [audits.length, restoreAll, invalidate]);

  const purgeTargetName = purgeTarget?.firstName ?? "This match";
  const isPurging =
    purge.isPending && purge.variables?.id === purgeTarget?.id;

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

        {hasItems ? (
          <View style={styles.bulkRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restore all items in the trash"
              onPress={handleRestoreAll}
              disabled={bulkBusy}
              style={({ pressed }) => [
                styles.bulkBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: bulkBusy || pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="rotate-ccw"
                size={14}
                color={colors.foreground}
              />
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                Restore all
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Empty trash"
              onPress={handleEmptyTrash}
              disabled={bulkBusy}
              style={({ pressed }) => [
                styles.bulkBtn,
                {
                  borderColor: colors.destructive ?? "#ef4444",
                  backgroundColor: "transparent",
                  opacity: bulkBusy || pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="trash-2"
                size={14}
                color={colors.destructive ?? "#ef4444"}
              />
              <Text
                style={{
                  color: colors.destructive ?? "#ef4444",
                  fontWeight: "600",
                }}
              >
                Empty trash
              </Text>
            </Pressable>
          </View>
        ) : null}

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
                    testID={`button-trash-purge-${audit.id}`}
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

      <Modal
        transparent
        visible={purgeTarget !== null}
        animationType="fade"
        onRequestClose={() => {
          if (!isPurging) closePurgeConfirm();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View
            testID="dialog-confirm-purge-audit"
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Delete forever?
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              {purgeTargetName} will be permanently removed. This can't be
              undone.
            </Text>
            <View style={styles.modalConfirmField}>
              <Text
                style={[styles.modalLabel, { color: colors.mutedForeground }]}
              >
                Type{" "}
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "PlusJakartaSans_700Bold",
                  }}
                >
                  delete
                </Text>{" "}
                to confirm
              </Text>
              <TextInput
                testID="input-trash-purge-confirm"
                value={purgeConfirmText}
                onChangeText={setPurgeConfirmText}
                placeholder="delete"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                editable={!isPurging}
                style={[
                  styles.modalInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.input ?? colors.card,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                testID="button-trash-purge-cancel"
                disabled={isPurging}
                onPress={() => closePurgeConfirm()}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.input ?? colors.card,
                    opacity: isPurging ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.modalBtnLabel, { color: colors.foreground }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                testID="button-trash-purge-confirm"
                disabled={isPurging || !isPurgeConfirmed}
                onPress={() => handleConfirmPurge()}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  {
                    backgroundColor: colors.destructive ?? "#ef4444",
                    opacity: isPurging
                      ? 0.7
                      : !isPurgeConfirmed
                        ? 0.5
                        : pressed
                          ? 0.85
                          : 1,
                  },
                ]}
              >
                {isPurging ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnLabel, { color: "#fff" }]}>
                    Delete forever
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  bulkRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  modalBody: {
    fontSize: 13.5,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
  },
  modalConfirmField: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  modalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnDanger: {
    borderColor: "transparent",
  },
  modalBtnLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
