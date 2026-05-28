import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export type EchoSurface =
  | "quiz-result"
  | "audit-report"
  | "sample-report"
  | "compass-read"
  | "message-coach"
  | "self-hub"
  | "blog-post"
  | "landing"
  | "waitlist"
  | "insights-result"
  | "hinge-import"
  | "pricing-tier"
  | "coach";

type Variant = "primary" | "ghost" | "pill";

interface ShareButtonProps {
  surface: EchoSurface;
  title: string;
  text: string;
  path: string;
  ref?: string;
  label?: string;
  copiedLabel?: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  testId?: string;
  iconOnly?: boolean;
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

function buildShareUrl(
  path: string,
  surface: EchoSurface,
  ref?: string,
): string {
  const base = getBaseUrl();
  const fullPath = path.startsWith("http") ? path : `${base}${path}`;
  // URL is available in modern RN; fall back to manual string build if not.
  try {
    const url = new URL(fullPath);
    url.searchParams.set("utm_source", "share");
    url.searchParams.set("utm_medium", "echo");
    url.searchParams.set("utm_campaign", surface);
    if (ref) url.searchParams.set("ref", ref);
    return url.toString();
  } catch {
    const sep = fullPath.includes("?") ? "&" : "?";
    const params = [
      "utm_source=share",
      "utm_medium=echo",
      `utm_campaign=${encodeURIComponent(surface)}`,
      ref ? `ref=${encodeURIComponent(ref)}` : "",
    ]
      .filter(Boolean)
      .join("&");
    return `${fullPath}${sep}${params}`;
  }
}

export function ShareButton({
  surface,
  title,
  text,
  path,
  ref,
  label = "Share",
  copiedLabel = "Copied",
  variant = "ghost",
  style,
  testId = "button-echo-share",
  iconOnly = false,
}: ShareButtonProps) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  async function handlePress() {
    const shareUrl = buildShareUrl(path, surface, ref);
    const message = `${text}\n\n${shareUrl}`;

    try {
      if (Platform.OS !== "web") {
        const result = await Share.share(
          Platform.OS === "ios"
            ? { url: shareUrl, message: text, title }
            : { message, title },
        );
        if (result.action !== Share.dismissedAction) return;
      } else {
        const nav =
          typeof navigator !== "undefined" ? (navigator as Navigator) : undefined;
        if (nav && typeof nav.share === "function") {
          try {
            await nav.share({ title, text, url: shareUrl });
            return;
          } catch {
            // fall through to clipboard
          }
        }
      }
    } catch {
      // fall through to clipboard
    }

    try {
      await Clipboard.setStringAsync(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // give up silently
    }
  }

  const iconName = copied ? "check" : "share-2";
  const displayLabel = copied ? copiedLabel : label;

  let bg = "transparent";
  let border = colors.border;
  let fg = colors.foreground;

  if (variant === "primary") {
    bg = colors.primary;
    border = colors.primary;
    fg = colors.primaryForeground;
  } else if (variant === "pill") {
    bg = `${colors.accent}14`;
    border = `${colors.accent}55`;
    fg = colors.foreground;
  } else {
    bg = colors.input;
    border = colors.border;
    fg = colors.foreground;
  }

  return (
    <Pressable
      testID={testId}
      accessibilityRole="button"
      onPress={() => {
        void handlePress();
      }}
      style={({ pressed }) => [
        styles.btn,
        variant === "pill" ? styles.pill : styles.action,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Feather
        name={iconName}
        size={variant === "pill" ? 13 : 15}
        color={copied ? colors.success : fg}
      />
      {iconOnly ? null : (
        <Text
          style={[
            variant === "pill" ? styles.pillLabel : styles.actionLabel,
            { color: copied ? colors.success : fg },
          ]}
        >
          {displayLabel}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
  },
  action: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 6,
  },
  actionLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  pillLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
