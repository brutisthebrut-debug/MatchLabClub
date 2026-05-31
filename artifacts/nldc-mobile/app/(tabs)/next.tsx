import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
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

const GOALS = [
  "Keep it alive",
  "Suggest meeting",
  "Re-engage after quiet",
  "Follow up on something",
  "Wind it down gracefully",
] as const;

type Goal = (typeof GOALS)[number];

interface Option {
  style: string;
  text: string;
  when: string;
}

function generateOptions(context: string, lastMsg: string, goal: Goal): Option[] {
  const lower = `${context} ${lastMsg}`.toLowerCase();
  const isQuiet = goal === "Re-engage after quiet";
  const isMeeting = goal === "Suggest meeting";
  const isWindDown = goal === "Wind it down gracefully";
  const hasHumor = /laugh|fun|joke|haha|lol|banter|wit/.test(lower);
  const hasShared = /we|both|us|our|together|same/.test(lower);

  return [
    {
      style: "Safe",
      text: isQuiet
        ? "Hey, I keep thinking about what you said about [thing from the conversation]. Still rolling it around."
        : isMeeting
        ? "I'd genuinely love to meet up. When does your week open up?"
        : "I keep coming back to something you said. What made you say it?",
      when: "Low-stakes restart that references something real.",
    },
    {
      style: "Warm",
      text: isQuiet
        ? "I didn't want things to go quiet without saying, I had a really good time talking with you."
        : isMeeting
        ? "I've been thinking about you. Would love to actually meet, are you free this week?"
        : "I really enjoy this. One of the better conversations I've had on here in a while.",
      when: "Signals genuine interest without pressure.",
    },
    {
      style: "Playful",
      text: isQuiet
        ? "You went quiet on me. I'm choosing to interpret that as you thinking of something really good to say."
        : hasHumor
        ? "Okay I have to know, what was the actual ending to that story? It's been bothering me."
        : "I feel like we've been building up to a real conversation. When does that part start?",
      when: "Keeps the vibe light and banter-y.",
    },
    {
      style: "Bold",
      text: isMeeting
        ? "I like you. Let's meet, Thursday or Friday?"
        : isWindDown
        ? "I want to be honest, I've been a bit unsure about where this is heading. Worth a real chat about it?"
        : "I'm going to say the thing no one says: I'm actually interested in getting to know you properly. Let's do something about that.",
      when: "When you have rapport and want momentum.",
    },
    {
      style: "Curious",
      text: hasShared
        ? "I keep noticing we keep landing on the same things. What do you think that's about?"
        : "There's one thing in what you said I want to dig into, when did you first realise that about yourself?",
      when: "Pulls them deeper into the thing they care about.",
    },
    {
      style: "Invitation",
      text: isMeeting
        ? "There's a [coffee place / wine bar / walk] near me I think you'd like. Want to find out together this week?"
        : "If your week has a 45-minute window, I think we could turn this into something good. Want to try?",
      when: "Gives them a concrete, low-friction yes.",
    },
    {
      style: "Clean exit",
      text:
        "I've enjoyed this, but I don't think we're heading toward what either of us is looking for. Wishing you the best out there.",
      when: "When the answer is 'no' but you want to leave kindly.",
    },
  ];
}

const STYLE_TINTS: Record<string, "violet" | "gold" | "rose" | "teal"> = {
  Safe: "violet",
  Warm: "rose",
  Playful: "gold",
  Bold: "violet",
  Curious: "teal",
  Invitation: "gold",
  "Clean exit": "rose",
};

export default function NextMessageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [context, setContext] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [goal, setGoal] = useState<Goal>("Keep it alive");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function onSubmit() {
    setErrorMsg(null);
    if (!context.trim()) {
      setErrorMsg("Add a bit of context from the conversation first.");
      return;
    }
    setOptions(generateOptions(context, lastMessage, goal));
  }

  const display = options ?? generateOptions(
    "We've been messaging for a few days about travel and music.",
    "She just sent a long thoughtful message about Lisbon.",
    "Keep it alive",
  );
  const showingDemo = options === null;

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
          eyebrow="Next Message"
          title="7 ways to send it"
          subtitle="One context, seven angles, from safe to bold to a clean exit. Pick the one that fits."
        />

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Goal</Text>
          <View style={styles.goalRow}>
            {GOALS.map((g) => {
              const active = g === goal;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGoal(g)}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: active ? `${colors.violet}33` : colors.input,
                      borderColor: active ? colors.violet : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.goalText,
                      {
                        color: active ? colors.violet : colors.mutedForeground,
                      },
                    ]}
                  >
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Conversation context
          </Text>
          <TextInput
            value={context}
            onChangeText={setContext}
            placeholder="What have you been talking about? What's the vibe?"
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

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Their last message (optional)
          </Text>
          <TextInput
            value={lastMessage}
            onChangeText={setLastMessage}
            placeholder="The most recent thing they said."
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

          {errorMsg ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: `${colors.destructive}22`, borderColor: colors.destructive },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

          <PrimaryButton label="Give me 7 options" onPress={onSubmit} icon="send" />
        </View>

        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
            {showingDemo ? "Sample options" : "Your 7 options"}
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
          {display.map((o, i) => (
            <ReplyCard
              key={`opt-${i}`}
              style={o.style}
              text={o.text}
              rationale={o.when}
              accent={colors[STYLE_TINTS[o.style] ?? "violet"]}
            />
          ))}
        </View>
      </KeyboardAwareScrollView>
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
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  goalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  goalText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
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
  multiline: { minHeight: 90, textAlignVertical: "top" },
  multilineShort: { minHeight: 70, textAlignVertical: "top" },
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
