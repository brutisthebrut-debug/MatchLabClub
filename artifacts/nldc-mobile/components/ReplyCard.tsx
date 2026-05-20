import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CopyButton } from "@/components/CopyButton";
import { useColors } from "@/hooks/useColors";

interface ReplyCardProps {
  style: string;
  text: string;
  rationale?: string;
  accent?: string;
  onCopy?: () => void;
}

export function ReplyCard({ style, text, rationale, accent, onCopy }: ReplyCardProps) {
  const colors = useColors();
  const tint = accent ?? colors.violet;

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
        <CopyButton text={text} onCopy={onCopy} variant="outlined" />
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
