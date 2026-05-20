import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ReplyCardProps {
  style: string;
  text: string;
  rationale?: string;
  accent?: string;
}

export function ReplyCard({ style, text, rationale, accent }: ReplyCardProps) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const tint = accent ?? colors.violet;

  async function copy() {
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.styleBadge, { backgroundColor: `${tint}22` }]}>
          <View style={[styles.dot, { backgroundColor: tint }]} />
          <Text style={[styles.styleText, { color: tint }]}>{style}</Text>
        </View>
        <Pressable
          onPress={copy}
          style={({ pressed }) => [
            styles.copyBtn,
            {
              backgroundColor: copied ? `${colors.success}22` : colors.secondary,
              borderColor: copied ? colors.success : colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Feather
            name={copied ? "check" : "copy"}
            size={14}
            color={copied ? colors.success : colors.foreground}
          />
          <Text
            style={[
              styles.copyText,
              { color: copied ? colors.success : colors.foreground },
            ]}
          >
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.text, { color: colors.foreground }]}>{text}</Text>
      {rationale ? (
        <Text style={[styles.rationale, { color: colors.mutedForeground }]}>
          {rationale}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  styleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  styleText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  copyText: { fontSize: 12, fontFamily: "PlusJakartaSans_600SemiBold" },
  text: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 22,
  },
  rationale: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 17,
    fontStyle: "italic",
  },
});
