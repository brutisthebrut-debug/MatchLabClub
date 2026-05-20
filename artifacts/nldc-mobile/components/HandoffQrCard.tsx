import { Feather } from "@expo/vector-icons";
import { useIssueAnonymousClaimHandoff } from "@workspace/api-client-react";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import React, { useRef, useState } from "react";
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
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";

import { useColors } from "@/hooks/useColors";
import { buildMobileHandoffShareUrl } from "@/lib/handoffLink";

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface IssuedLink {
  url: string;
  expiresAt: string;
}

export function HandoffQrCard() {
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const qrViewRef = useRef<View>(null);
  const issue = useIssueAnonymousClaimHandoff();

  async function handleOpen() {
    setSavedBanner(null);
    setModalVisible(true);
    if (issued) return;
    try {
      const result = await issue.mutateAsync();
      const url = await buildMobileHandoffShareUrl(result.handoff);
      setIssued({ url, expiresAt: result.expiresAt });
    } catch {
      setModalVisible(false);
      Alert.alert(
        "Couldn't generate link",
        "We couldn't create a continue-on-another-device link. Try again in a moment.",
      );
    }
  }

  function handleClose() {
    setModalVisible(false);
    setIssued(null);
    setSavedBanner(null);
  }

  async function handleSaveQr() {
    if (!qrViewRef.current) return;
    setIsSaving(true);
    setSavedBanner(null);
    let namedUri: string | null = null;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Allow NLDC to access your photo library to save the QR code.",
        );
        return;
      }
      const capturedUri = await captureRef(qrViewRef, { format: "png", quality: 1 });
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 23);
      const filename = `handoff-qr-${timestamp}.png`;
      const dest = new FileSystem.File(FileSystem.Paths.cache, filename);
      namedUri = dest.uri;
      const src = new FileSystem.File(capturedUri);
      src.copy(dest);
      const asset = await MediaLibrary.createAssetAsync(namedUri);
      try {
        await MediaLibrary.createAlbumAsync("NLDC", asset, false);
      } catch {
        // album creation failing is non-fatal
      }
      setSavedBanner(`Saved as ${filename}`);
    } catch {
      Alert.alert("Couldn't save", "Saving the QR code to your camera roll failed. Try again.");
    } finally {
      if (namedUri) {
        try {
          const tmp = new FileSystem.File(namedUri);
          if (tmp.exists) tmp.delete();
        } catch {
          // cleanup failure is non-fatal
        }
      }
      setIsSaving(false);
    }
  }

  const loading = issue.isPending && !issued;

  return (
    <>
      <Pressable
        testID="button-handoff-open"
        onPress={() => { void handleOpen(); }}
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
              { backgroundColor: `${colors.teal}22` },
            ]}
          >
            <Feather name="smartphone" size={16} color={colors.teal} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Continue on another device
          </Text>
          <View style={{ flex: 1 }} />
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Moving to a new device? Generate a QR code and scan it on your other device to carry your anonymous audits over when you sign in.
        </Text>
      </Pressable>

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.backdrop}>
          <View
            testID="dialog-handoff-qr"
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                Continue on another device
              </Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>
              Open this link on the device where you&apos;ll sign in. After you sign in there, your audit will be waiting for you.
            </Text>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Generating a secure link…
                </Text>
              </View>
            ) : issued ? (
              <>
                <View style={styles.qrWrap}>
                  <View
                    ref={qrViewRef}
                    testID="handoff-qr"
                    collapsable={false}
                    style={styles.qrPad}
                  >
                    <QRCode
                      value={issued.url}
                      size={192}
                      color="#0f172a"
                      backgroundColor="#ffffff"
                    />
                  </View>
                </View>

                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  Point your camera at the code on your other device.
                </Text>

                <View
                  testID="handoff-url"
                  style={[
                    styles.urlBox,
                    { backgroundColor: colors.input, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[styles.urlText, { color: colors.mutedForeground }]}
                    numberOfLines={3}
                  >
                    {issued.url}
                  </Text>
                </View>

                {savedBanner ? (
                  <View
                    style={[
                      styles.successBanner,
                      {
                        backgroundColor: `${colors.success}22`,
                        borderColor: colors.success,
                      },
                    ]}
                  >
                    <Feather name="check-circle" size={13} color={colors.success} />
                    <Text style={[styles.successText, { color: colors.success }]}>
                      {savedBanner}
                    </Text>
                  </View>
                ) : null}

                {Platform.OS !== "web" ? (
                  <Pressable
                    testID="button-handoff-save-qr"
                    disabled={isSaving}
                    onPress={() => { void handleSaveQr(); }}
                    style={({ pressed }) => [
                      styles.saveBtn,
                      {
                        backgroundColor: `${colors.teal}14`,
                        borderColor: colors.teal,
                        opacity: isSaving ? 0.5 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator color={colors.teal} />
                    ) : (
                      <>
                        <Feather name="download" size={15} color={colors.teal} />
                        <Text style={[styles.saveBtnText, { color: colors.teal }]}>
                          Save QR to camera roll
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}

                <Text style={[styles.expiry, { color: colors.mutedForeground }]}>
                  This link expires at {formatExpiry(issued.expiresAt)} and works only on the next sign-in. Don&apos;t share it — it gives access to your anonymous audit.
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    flex: 1,
  },
  cardBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 19,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_700Bold",
    flex: 1,
    marginRight: 8,
  },
  sheetBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 19,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  qrWrap: {
    alignItems: "center",
  },
  qrPad: {
    padding: 12,
    backgroundColor: "#ffffff",
  },
  hint: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
  },
  urlBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  urlText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  successText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    flex: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  expiry: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 15,
  },
});
