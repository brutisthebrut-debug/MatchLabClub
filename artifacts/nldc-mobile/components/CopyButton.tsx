import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { useColors } from "@/hooks/useColors";

interface CopyButtonProps {
  text: string;
  onCopy?: () => void;
  /**
   * "ghost"   , minimal icon+label, no border/background (default).
   *              Used in audit headers and action-plan rows.
   * "outlined", pill with border and tinted background on copy.
   *              Used in reply cards and other prominent copy actions.
   */
  variant?: "ghost" | "outlined";
}

const RESET_DELAY_MS = 2000;

export function CopyButton({ text, onCopy, variant = "ghost" }: CopyButtonProps) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    if (variant === "outlined" && Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setCopied(true);
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setCopied(false);
    }, RESET_DELAY_MS);
    onCopy?.();
  };

  if (variant === "outlined") {
    return (
      <Pressable
        onPress={handleCopy}
        style={({ pressed }) => [
          styles.outlinedBtn,
          {
            backgroundColor: copied ? `${colors.success}22` : colors.secondary,
            borderColor: copied ? colors.success : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        hitSlop={8}
        accessibilityLabel="Copy to clipboard"
      >
        <Feather
          name={copied ? "check" : "copy"}
          size={14}
          color={copied ? colors.success : colors.foreground}
        />
        <Text
          style={[
            styles.outlinedText,
            { color: copied ? colors.success : colors.foreground },
          ]}
        >
          {copied ? "Copied" : "Copy"}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handleCopy}
      hitSlop={8}
      accessibilityLabel="Copy to clipboard"
      style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather
        name={copied ? "check" : "copy"}
        size={13}
        color={copied ? colors.success : colors.mutedForeground}
      />
      <Text
        style={[
          styles.ghostText,
          { color: copied ? colors.success : colors.mutedForeground },
        ]}
      >
        {copied ? "Copied" : "Copy"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  ghostText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  outlinedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  outlinedText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
