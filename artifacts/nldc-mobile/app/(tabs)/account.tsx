import { Feather } from "@expo/vector-icons";
import {
  deleteMyAccount,
  exportMyData,
  getExportMyDataQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";

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

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

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
      // Tear down every cached query — the user is signed out and any
      // user-scoped data should not survive in memory.
      queryClient.clear();
      setConfirmOpen(false);
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
      setConfirmOpen(false);
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
          subtitle="Download everything we have about you, or permanently remove your account from any device."
        />

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
            These controls do the same thing as the Account page on the web —
            so you can manage your data from whichever device you're holding.
          </Text>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={confirmOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setConfirmOpen(false);
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
            <View style={styles.modalActions}>
              <Pressable
                testID="button-account-delete-cancel"
                disabled={isDeleting}
                onPress={() => setConfirmOpen(false)}
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
                disabled={isDeleting}
                onPress={() => {
                  void handleConfirmDelete();
                }}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  {
                    backgroundColor: colors.destructive,
                    opacity: isDeleting ? 0.7 : pressed ? 0.85 : 1,
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
