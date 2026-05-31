import { Feather } from "@expo/vector-icons";
import {
  deleteMyAccount,
  exportMyData,
  getExportMyDataQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  DEFAULT_TRASH_REMINDER_PREFS,
  loadTrashReminderPrefs,
  saveTrashReminderPrefs,
  type TrashReminderPrefs,
} from "@/lib/auditTrashNotifications";
import { HandoffQrCard } from "@/components/HandoffQrCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { useAutoRefreshPref } from "@/lib/autoRefreshPref";

type Banner = { kind: "success" | "error"; text: string } | null;

function todayStamp(): string {
  return new Date().toISOString().split("T")[0];
}

async function saveJsonOnWeb(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareJsonOnNative(filename: string, json: string) {
  const file = new FileSystem.File(FileSystem.Paths.cache, filename);
  if (file.exists) {
    try {
      file.delete();
    } catch {
      // ignore, write below will overwrite
    }
  }
  file.create();
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(
      `Sharing isn't available on this device. Your export was saved to ${file.uri}.`,
    );
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle: "Save your NLDC data export",
  });
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [trashPrefs, setTrashPrefs] = useState<TrashReminderPrefs>(
    DEFAULT_TRASH_REMINDER_PREFS,
  );
  useEffect(() => {
    let active = true;
    void loadTrashReminderPrefs().then((p) => {
      if (active) setTrashPrefs(p);
    });
    return () => {
      active = false;
    };
  }, []);
  const onToggleTrashReminders = React.useCallback(
    (next: boolean) => {
      const updated: TrashReminderPrefs = { ...trashPrefs, enabled: next };
      setTrashPrefs(updated);
      void saveTrashReminderPrefs(updated);
    },
    [trashPrefs],
  );
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
    isSigningIn,
    error: authError,
    login,
    logout,
  } = useAuth();

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const autoRefresh = useAutoRefreshPref();

  const DELETE_CONFIRM_PHRASE = "delete";
  const isDeleteConfirmed =
    deleteConfirmText.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;

  function closeConfirm() {
    setConfirmOpen(false);
    setDeleteConfirmText("");
  }

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Signed in";

  async function handleSignIn() {
    setBanner(null);
    await login();
  }

  async function handleSignOut() {
    setBanner(null);
    setIsSigningOut(true);
    try {
      await logout();
      setBanner({ kind: "success", text: "You've been signed out." });
    } finally {
      setIsSigningOut(false);
    }
  }

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  async function handleDownload() {
    setBanner(null);
    setIsExporting(true);
    try {
      const data = await exportMyData();
      const json = JSON.stringify(data, null, 2);
      const filename = `nldc-data-export-${todayStamp()}.json`;
      if (Platform.OS === "web") {
        await saveJsonOnWeb(filename, json);
      } else {
        await shareJsonOnNative(filename, json);
      }
      setBanner({
        kind: "success",
        text:
          Platform.OS === "web"
            ? "Your data export downloaded as JSON."
            : "Your data export is ready to save or share.",
      });
      // Warm the cache so an in-app data preview (if added later) is fresh.
      queryClient.setQueryData(getExportMyDataQueryKey(), data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't export your data. Please try again.";
      setBanner({ kind: "error", text: message });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleConfirmDelete() {
    setBanner(null);
    setIsDeleting(true);
    try {
      await deleteMyAccount();
      // Tear down every cached query, the user is signed out and any
      // user-scoped data should not survive in memory.
      queryClient.clear();
      closeConfirm();
      setDeleted(true);
      setBanner({
        kind: "success",
        text: "Your account and all associated data have been removed.",
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't delete your account. Please try again.";
      setBanner({ kind: "error", text: message });
      closeConfirm();
      if (Platform.OS !== "web") {
        Alert.alert("Couldn't delete your account", message);
      }
    } finally {
      setIsDeleting(false);
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
        <ScreenHeader
          eyebrow="Account"
          title="Your data, your call"
          subtitle="Sign in to manage your audits across devices, download everything we have about you, or permanently remove your account."
        />

        {authError ? (
          <View
            testID="account-auth-error"
            style={[
              styles.banner,
              {
                backgroundColor: `${colors.destructive}22`,
                borderColor: colors.destructive,
              },
            ]}
          >
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text
              style={[styles.bannerText, { color: colors.destructive }]}
            >
              {authError}
            </Text>
          </View>
        ) : null}

        {isAuthLoading ? (
          <View
            testID="account-auth-loading"
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 28,
              },
            ]}
          >
            <ActivityIndicator color={colors.violet} />
          </View>
        ) : isAuthenticated ? (
          <View
            testID="account-identity-card"
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
                <Feather name="user" size={16} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  testID="account-name"
                  style={[styles.cardTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {fullName}
                </Text>
                {user?.email ? (
                  <Text
                    testID="account-email"
                    style={[
                      styles.cardBody,
                      { color: colors.mutedForeground, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {user.email}
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable
              testID="button-account-signout"
              disabled={isSigningOut || deleted}
              onPress={() => {
                void handleSignOut();
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                  opacity: isSigningOut || deleted ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isSigningOut ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <>
                  <Feather name="log-out" size={15} color={colors.foreground} />
                  <Text
                    style={[styles.actionLabel, { color: colors.foreground }]}
                  >
                    Sign out
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View
            testID="account-signin-card"
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
                <Feather name="log-in" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Sign in to your account
              </Text>
            </View>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              Sign in to sync your audits, matches, and message coaching across
              devices, and to download or delete your data from here.
            </Text>
            <Pressable
              testID="button-account-signin"
              disabled={isSigningIn}
              onPress={() => {
                void handleSignIn();
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: colors.gold,
                  backgroundColor: `${colors.gold}14`,
                  opacity: isSigningIn ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isSigningIn ? (
                <ActivityIndicator color={colors.gold} />
              ) : (
                <>
                  <Feather name="log-in" size={15} color={colors.gold} />
                  <Text style={[styles.actionLabel, { color: colors.gold }]}>
                    Sign in
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {!isAuthenticated && !isAuthLoading ? (
          <HandoffQrCard />
        ) : null}

        {banner ? (
          <View
            testID="account-banner"
            style={[
              styles.banner,
              {
                backgroundColor:
                  banner.kind === "success"
                    ? `${colors.success}22`
                    : `${colors.destructive}22`,
                borderColor:
                  banner.kind === "success" ? colors.success : colors.destructive,
              },
            ]}
          >
            <Feather
              name={banner.kind === "success" ? "check-circle" : "alert-circle"}
              size={16}
              color={
                banner.kind === "success" ? colors.success : colors.destructive
              }
            />
            <Text
              style={[
                styles.bannerText,
                {
                  color:
                    banner.kind === "success" ? colors.success : colors.destructive,
                },
              ]}
            >
              {banner.text}
            </Text>
          </View>
        ) : null}

        {isAuthenticated ? (
          <Pressable
            testID="button-account-sessions"
            onPress={() => router.push("/sessions" as never)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                opacity: pressed ? 0.75 : 1,
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
                <Feather name="shield" size={16} color={colors.violet} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Devices & sign-ins
              </Text>
              <View style={{ flex: 1 }} />
              <Feather
                name="chevron-right"
                size={16}
                color={colors.mutedForeground}
              />
            </View>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              See every browser or app signed in to your account and sign out
              any device you don&apos;t recognize.
            </Text>
          </Pressable>
        ) : null}

        <View
          testID="account-auto-refresh-card"
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.gold}22` }]}
            >
              <Feather name="refresh-cw" size={16} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Keep my reports up to date
            </Text>
          </View>
          <View style={styles.autoRefreshRow}>
            <Text
              style={[
                styles.cardBody,
                { color: colors.mutedForeground, flex: 1, marginRight: 12 },
              ]}
            >
              When on, we'll quietly regenerate a few of your oldest saved
              reports in the background each time you open the app. Failures
              are silent and never block the UI.
            </Text>
            <Switch
              testID="switch-auto-refresh-reports"
              accessibilityLabel="Keep my reports up to date"
              value={autoRefresh.enabled}
              disabled={!autoRefresh.loaded}
              onValueChange={(v) => {
                void autoRefresh.setEnabled(v);
                setBanner({
                  kind: "success",
                  text: v
                    ? "We'll quietly refresh a few stale reports each session."
                    : "Stale reports will stay as-is until you refresh them.",
                });
              }}
              trackColor={{ false: colors.border, true: colors.gold }}
              thumbColor={Platform.OS === "android" ? colors.background : undefined}
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.violet}22` }]}
            >
              <Feather name="download" size={16} color={colors.violet} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Download my data
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Exports your profile, every audit you've run, your saved dating
            profiles, message coaching sessions, and email insights as a single
            JSON file. {Platform.OS === "web"
              ? "Saves directly to your device."
              : "Opens the share sheet so you can save it to Files, send it to yourself, or hand it to another app."}
          </Text>
          <Pressable
            testID="button-account-download-data"
            disabled={isExporting || deleted}
            onPress={() => {
              void handleDownload();
            }}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: colors.violet,
                backgroundColor: `${colors.violet}14`,
                opacity: isExporting || deleted ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {isExporting ? (
              <ActivityIndicator color={colors.violet} />
            ) : (
              <>
                <Feather name="download" size={15} color={colors.violet} />
                <Text style={[styles.actionLabel, { color: colors.violet }]}>
                  Download my data
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[styles.iconBubble, { backgroundColor: `${colors.gold}22` }]}
            >
              <Feather name="bell" size={16} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Recently deleted reminders
            </Text>
            <View style={{ flex: 1 }} />
            <Switch
              testID="switch-trash-reminders"
              value={trashPrefs.enabled}
              onValueChange={onToggleTrashReminders}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={
                Platform.OS === "android" ? colors.background : undefined
              }
            />
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            {trashPrefs.enabled
              ? "We'll send you a heads-up a few days before any trashed audit is permanently deleted, so you can restore it if you change your mind."
              : "Off, we won't warn you before trashed audits are auto-deleted after 30 days."}
          </Text>
        </View>

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
                { backgroundColor: `${colors.destructive}22` },
              ]}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Delete my account
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Permanently removes your profile, every audit, saved dating
            profile, message coaching session, and email insight. You'll be
            signed out of this device immediately. This can't be undone.
          </Text>
          <Pressable
            testID="button-account-delete"
            disabled={isDeleting || deleted}
            onPress={() => setConfirmOpen(true)}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: colors.destructive,
                backgroundColor: `${colors.destructive}14`,
                opacity: isDeleting || deleted ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="trash-2" size={15} color={colors.destructive} />
            <Text style={[styles.actionLabel, { color: colors.destructive }]}>
              {deleted ? "Account deleted" : "Delete my account"}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.footerCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Feather name="shield" size={18} color={colors.gold} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            These controls do the same thing as the Account page on the web,
            so you can manage your data from whichever device you're holding.
          </Text>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={confirmOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) closeConfirm();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View
            testID="dialog-confirm-delete-account"
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Permanently delete your account?
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              This removes your profile, every audit you've run, your saved
              dating profiles, message coaching sessions, and email insights.
              You'll be signed out immediately. This can't be undone.
            </Text>
            <Pressable
              testID="button-account-delete-download"
              disabled={isExporting || isDeleting}
              onPress={() => {
                void handleDownload();
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: colors.violet,
                  backgroundColor: `${colors.violet}14`,
                  opacity:
                    isExporting || isDeleting ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isExporting ? (
                <ActivityIndicator color={colors.violet} />
              ) : (
                <>
                  <Feather name="download" size={15} color={colors.violet} />
                  <Text style={[styles.actionLabel, { color: colors.violet }]}>
                    Download my data first
                  </Text>
                </>
              )}
            </Pressable>
            <View style={styles.modalConfirmField}>
              <Text
                style={[styles.modalLabel, { color: colors.mutedForeground }]}
              >
                Type{" "}
                <Text style={{ color: colors.foreground, fontFamily: "PlusJakartaSans_700Bold" }}>
                  delete
                </Text>{" "}
                to confirm
              </Text>
              <TextInput
                testID="input-account-delete-confirm"
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="delete"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                editable={!isDeleting}
                style={[
                  styles.modalInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.input,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                testID="button-account-delete-cancel"
                disabled={isDeleting}
                onPress={() => closeConfirm()}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.input,
                    opacity: isDeleting ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalBtnLabel, { color: colors.foreground }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                testID="button-account-delete-confirm"
                disabled={isDeleting || !isDeleteConfirmed}
                onPress={() => {
                  void handleConfirmDelete();
                }}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  {
                    backgroundColor: colors.destructive,
                    opacity:
                      isDeleting
                        ? 0.7
                        : !isDeleteConfirmed
                          ? 0.5
                          : pressed
                            ? 0.85
                            : 1,
                  },
                ]}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnLabel, { color: "#fff" }]}>
                    Yes, delete everything
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
  content: { paddingHorizontal: 20, gap: 16 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  autoRefreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  cardBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 2,
  },
  actionLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.2,
  },
  footerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 19,
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
