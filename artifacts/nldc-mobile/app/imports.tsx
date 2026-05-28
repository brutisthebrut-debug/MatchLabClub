import { Feather } from "@expo/vector-icons";
import {
  getListImportsQueryKey,
  useDeleteImport,
  useListImports,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { ShareButton } from "@/components/echo/ShareButton";
import { useColors } from "@/hooks/useColors";
import { getStoredAuthToken, useAuth } from "@/lib/auth";

const MAX_BYTES = 50 * 1024 * 1024;

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

type ImportRow = {
  id: number;
  source: string;
  status: string;
  originalFilename?: string | null;
  uploadedAt: string | Date;
  parsedSummary?: Record<string, unknown> | null;
};

function statusLabel(status: string): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "parsing":
      return "Parsing";
    case "fallback":
      return "Parsed (no AI read)";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export default function ImportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  const importsQuery = useListImports({
    query: { queryKey: getListImportsQueryKey() },
  });
  const deleteImport = useDeleteImport();

  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  const rows = (importsQuery.data?.imports ?? []) as ImportRow[];

  async function handlePickAndUpload() {
    setBanner(null);
    let asset: DocumentPicker.DocumentPickerAsset | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/zip",
          "application/x-zip-compressed",
          "application/octet-stream",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      asset = result.assets[0];
    } catch {
      setBanner({
        kind: "error",
        text: "Could not open the file picker. Try again.",
      });
      return;
    }

    if (!asset) return;
    const name = (asset.name || "").toLowerCase();
    if (!name.endsWith(".zip")) {
      setBanner({
        kind: "error",
        text: "That doesn't look like a Hinge ZIP. Pick the .zip file from your export.",
      });
      return;
    }
    if (typeof asset.size === "number" && asset.size > MAX_BYTES) {
      setBanner({
        kind: "error",
        text: "File is over 50MB. Hinge exports are usually smaller. Pick the .zip file.",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: "application/zip",
        // RN FormData accepts the file-like blob with uri/name/type;
        // the typings differ between web and native.
      } as unknown as Blob);

      const token = await getStoredAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${getBaseUrl()}/api/imports/hinge`, {
        method: "POST",
        body: formData,
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 413) {
          setBanner({
            kind: "error",
            text: "File is over the 50MB limit.",
          });
        } else if (res.status === 415) {
          setBanner({
            kind: "error",
            text: "Unsupported file type. Pick the .zip Hinge gave you.",
          });
        } else if (res.status === 400) {
          setBanner({
            kind: "error",
            text: "We couldn't read that ZIP. Make sure it's the GDPR export from Hinge.",
          });
        } else {
          setBanner({
            kind: "error",
            text: `Upload failed (${res.status}). Try again in a minute.`,
          });
        }
        return;
      }

      setBanner({
        kind: "success",
        text: "Your import is in. Give it a minute to finish parsing.",
      });
      void queryClient.invalidateQueries({
        queryKey: getListImportsQueryKey(),
      });
    } catch {
      setBanner({
        kind: "error",
        text: "Upload failed. Check your connection and try again.",
      });
    } finally {
      setUploading(false);
    }
  }

  function confirmDelete(id: number) {
    Alert.alert(
      "Delete this import?",
      "We'll remove the parsed summary and any AI read from your hub.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteImport.mutate(
              { id },
              {
                onSuccess: () => {
                  void queryClient.invalidateQueries({
                    queryKey: getListImportsQueryKey(),
                  });
                },
                onError: () => {
                  setBanner({
                    kind: "error",
                    text: "Couldn't delete that import. Try again.",
                  });
                },
              },
            );
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 8, paddingBottom: bottomInset + 40 },
        ]}
      >
        <ScreenHeader
          eyebrow="Imports"
          title="Bring your dating data in"
          subtitle="We use your export to read the patterns. The raw ZIP is never stored. You can delete a summary anytime."
        />

        {banner ? (
          <View
            testID="imports-banner"
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

        {/* Hinge source card */}
        <View
          testID="source-card-hinge"
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.violet}22` },
              ]}
            >
              <Feather name="upload-cloud" size={16} color={colors.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Hinge
              </Text>
              <Text
                style={[
                  styles.helper,
                  { color: colors.mutedForeground, marginTop: 2 },
                ]}
              >
                Live, AI read included for signed-in users.
              </Text>
            </View>
          </View>
          <Text style={[styles.cardBody, { color: colors.foreground }]}>
            In the Hinge app, go to Settings, Account, Download My Data. Hinge
            will email you a ZIP. Pick it here.
          </Text>
          <Pressable
            testID="button-import-hinge"
            disabled={uploading}
            onPress={() => {
              void handlePickAndUpload();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: uploading ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {uploading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather
                  name="upload"
                  size={15}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.primaryLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Pick your Hinge ZIP
                </Text>
              </>
            )}
          </Pressable>
          <ShareButton
            testId="button-share-hinge-import"
            surface="hinge-import"
            title="Read your Hinge patterns on MatchLab Club"
            text="I uploaded my Hinge export to MatchLab Club and got a read on what my swipe and message patterns actually say. Worth a look."
            path="/imports"
            ref={user?.id ? `user-${user.id}` : "imports"}
            variant="ghost"
            label="Share imports"
          />
        </View>

        {/* Tinder + Bumble disabled */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: 0.6,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.gold}22` },
              ]}
            >
              <Feather name="zap" size={16} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Tinder
              </Text>
              <Text
                style={[
                  styles.helper,
                  { color: colors.mutedForeground, marginTop: 2 },
                ]}
              >
                Coming soon. Request your data from Tinder first.
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: 0.6,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.accent}22` },
              ]}
            >
              <Feather name="user-plus" size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Bumble
              </Text>
              <Text
                style={[
                  styles.helper,
                  { color: colors.mutedForeground, marginTop: 2 },
                ]}
              >
                Coming soon.
              </Text>
            </View>
          </View>
        </View>

        {/* Past imports */}
        <View
          testID="imports-history"
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: `${colors.violet}22` },
              ]}
            >
              <Feather name="clock" size={16} color={colors.violet} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Past imports
            </Text>
          </View>
          {!isAuthenticated ? (
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              Sign in to see imports you've uploaded.
            </Text>
          ) : importsQuery.isLoading ? (
            <ActivityIndicator color={colors.violet} />
          ) : rows.length === 0 ? (
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              Nothing yet. Pick a ZIP above to get started.
            </Text>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={styles.importRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.listRowBody, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {row.originalFilename || `${row.source} export`}
                  </Text>
                  <Text
                    style={[
                      styles.listRowMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {statusLabel(row.status)}
                    {" • "}
                    {new Date(row.uploadedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Pressable
                  testID={`button-delete-import-${row.id}`}
                  onPress={() => confirmDelete(row.id)}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.input,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  cardBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 19,
  },
  helper: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  importRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  listRowBody: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  listRowMeta: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
