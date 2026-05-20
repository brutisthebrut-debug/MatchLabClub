import { Feather } from "@expo/vector-icons";
import {
  useCoachMessage,
  useCreateMessageCoachingSession,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { ReplyCard } from "@/components/ReplyCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";

interface Reply {
  style: string;
  text: string;
  rationale: string;
}

const DEMO_REPLIES: Reply[] = [
  {
    style: "Playful",
    text: "Okay but you can't drop 'I just got back from Lisbon' and then not tell me your favorite spot — I'm taking notes.",
    rationale:
      "Picks up the specific detail they shared, signals interest, gives them an easy thing to respond to.",
  },
  {
    style: "Direct",
    text: "I'd actually love to hear more about that over a drink this week — Thursday or Friday work?",
    rationale:
      "You've had 4 exchanges of real rapport. The cost of asking is lower than the cost of letting it fade.",
  },
  {
    style: "Warm",
    text: "I really liked what you said about wanting work to feel meaningful — that landed. What kind of work would feel like that for you?",
    rationale:
      "Mirrors their vulnerability with curiosity, not a one-up. Keeps the conversation going somewhere real.",
  },
];

const STYLE_COLORS: Record<string, "violet" | "gold" | "rose" | "teal"> = {
  playful: "gold",
  warm: "rose",
  direct: "violet",
  bold: "violet",
  curious: "teal",
};

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [matchName, setMatchName] = useState("");
  const [context, setContext] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [results, setResults] = useState<Reply[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createSession = useCreateMessageCoachingSession();
  const coach = useCoachMessage();

  const isPending = createSession.isPending || coach.isPending;

  const accentFor = (style: string) => {
    const key = style.toLowerCase();
    const tint =
      STYLE_COLORS[key] ??
      (Object.keys(STYLE_COLORS).find((k) => key.includes(k)) as
        | keyof typeof STYLE_COLORS
        | undefined);
    return tint ? colors[tint] : colors.violet;
  };

  async function onSubmit() {
    setErrorMsg(null);
    if (!context.trim() || !lastMessage.trim()) {
      setErrorMsg("Paste both the conversation context and the last message you got.");
      return;
    }
    try {
      const session = await createSession.mutateAsync({
        data: {
          matchName: matchName.trim() || "Match",
          conversationContext: context.trim(),
          yourLastMessage: lastMessage.trim(),
          goal: "Keep the conversation alive",
        },
      });
      const coached = await coach.mutateAsync({ id: session.id });
      setResults(coached.suggestedReplies);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setErrorMsg(message);
    }
  }

  const display = useMemo(() => results ?? DEMO_REPLIES, [results]);
  const showingDemo = results === null;

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
      >
        <ScreenHeader
          eyebrow="Message Coach"
          title="Reply that lands"
          subtitle="Paste what you've got. Get three replies in different tones — copy the one that sounds like you."
        />

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Field label="Their name (optional)">
            <TextInput
              value={matchName}
              onChangeText={setMatchName}
              placeholder="e.g. Maya"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>

          <Field label="The conversation so far">
            <TextInput
              value={context}
              onChangeText={setContext}
              placeholder="Paste the last few messages — what was said, who said what."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                styles.multiline,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>

          <Field label="Their last message to you">
            <TextInput
              value={lastMessage}
              onChangeText={setLastMessage}
              placeholder="The thing you're trying to respond to."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                styles.multilineShort,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>

          {errorMsg ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: `${colors.destructive}22`, borderColor: colors.destructive },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={isPending ? "Coaching…" : "Get coached replies"}
            onPress={onSubmit}
            loading={isPending}
            icon="zap"
          />
        </View>

        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
            {showingDemo ? "Sample replies" : "Your replies"}
          </Text>
          {showingDemo ? (
            <View
              style={[
                styles.demoChip,
                { backgroundColor: `${colors.gold}22`, borderColor: colors.gold },
              ]}
            >
              <Text style={[styles.demoChipText, { color: colors.gold }]}>Demo</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.repliesList}>
          {display.map((r, i) => (
            <ReplyCard
              key={`reply-${i}`}
              style={r.style}
              text={r.text}
              rationale={r.rationale}
              accent={accentFor(r.style)}
            />
          ))}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
    minHeight: 46,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  multilineShort: { minHeight: 80, textAlignVertical: "top" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  resultsTitle: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  demoChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  demoChipText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  repliesList: { gap: 12 },
});
