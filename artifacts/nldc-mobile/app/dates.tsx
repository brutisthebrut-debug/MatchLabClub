import { Feather } from "@expo/vector-icons";
import {
  useListPostDateNotes,
  useCreatePostDateNote,
  useDeletePostDateNote,
  useRestorePostDateNote,
  getListPostDateNotesQueryKey,
  type PostDateNote,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams, type Href } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

const OUTCOMES: Array<{
  value: "another_date" | "no_more" | "unsure" | "ghosted";
  label: string;
}> = [
  { value: "another_date", label: "Another date" },
  { value: "no_more", label: "No more dates" },
  { value: "unsure", label: "Unsure" },
  { value: "ghosted", label: "Ghosted" },
];

const OUTCOME_LABELS: Record<string, string> = {
  another_date: "Another date planned",
  no_more: "Not continuing",
  unsure: "Still figuring out",
  ghosted: "Ghosted",
};

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function DatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ view?: string; q?: string }>();
  const view: "trash" | "active" = params.view === "trash" ? "trash" : "active";
  const initialQ = typeof params.q === "string" ? params.q : "";
  const [q, setQ] = React.useState(initialQ);
  const [submittedQ, setSubmittedQ] = React.useState(initialQ);

  const listParams = React.useMemo(
    () => ({
      view,
      ...(submittedQ ? { q: submittedQ } : {}),
      limit: 50,
    }),
    [view, submittedQ],
  );
  const listKey = React.useMemo(
    () => getListPostDateNotesQueryKey(listParams),
    [listParams],
  );
  const list = useListPostDateNotes(listParams, {
    query: { queryKey: listKey, enabled: isAuthenticated },
  });
  const del = useDeletePostDateNote();
  const restore = useRestorePostDateNote();
  const create = useCreatePostDateNote();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [draftPerson, setDraftPerson] = React.useState("");
  const [draftSummary, setDraftSummary] = React.useState("");
  const [draftWentWell, setDraftWentWell] = React.useState("");
  const [draftDidntWork, setDraftDidntWork] = React.useState("");
  const [draftOutcome, setDraftOutcome] = React.useState<
    "another_date" | "no_more" | "unsure" | "ghosted" | null
  >(null);

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["/api/post-date-notes"] });
  }, [queryClient]);

  const handleDelete = React.useCallback(
    (n: PostDateNote) => {
      Alert.alert("Move to trash?", "You can restore it within 30 days.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to trash",
          style: "destructive",
          onPress: () =>
            del.mutate(
              { id: n.id },
              {
                onSuccess: () => invalidate(),
                onError: () =>
                  Alert.alert("Couldn't delete", "Try again in a moment."),
              },
            ),
        },
      ]);
    },
    [del, invalidate],
  );

  function submitCreate() {
    const summary = draftSummary.trim();
    if (!summary) return;
    create.mutate(
      {
        data: {
          summary,
          ...(draftPerson.trim() ? { personLabel: draftPerson.trim() } : {}),
          ...(draftWentWell.trim() ? { whatWentWell: draftWentWell.trim() } : {}),
          ...(draftDidntWork.trim() ? { whatDidntWork: draftDidntWork.trim() } : {}),
          ...(draftOutcome ? { outcome: draftOutcome } : {}),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setCreateOpen(false);
          setDraftPerson("");
          setDraftSummary("");
          setDraftWentWell("");
          setDraftDidntWork("");
          setDraftOutcome(null);
        },
        onError: () =>
          Alert.alert("Couldn't save", "Try again in a moment."),
      },
    );
  }

  const handleRestore = React.useCallback(
    (n: PostDateNote) => {
      restore.mutate(
        { id: n.id },
        {
          onSuccess: () => invalidate(),
          onError: () =>
            Alert.alert("Couldn't restore", "Try again in a moment."),
        },
      );
    },
    [restore, invalidate],
  );

  const notes = list.data?.notes ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: view === "trash" ? "Dates trash" : "Your dates",
          headerRight: () =>
            view === "active" ? (
              <Pressable
                testID="button-new-date"
                onPress={() => setCreateOpen(true)}
                hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 6 })}
              >
                <Feather name="plus" size={22} color={colors.foreground} />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 24,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => void list.refetch()}
            tintColor={colors.foreground}
          />
        }
      >
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          The record of what you debriefed after each date — what went well,
          what didn't, and where it landed.
        </Text>

        <View style={styles.row}>
          <Link href={"/dates" as Href} asChild>
            <Pressable
              testID="tab-dates-active"
              style={({ pressed }) => [
                styles.tab,
                {
                  borderColor: colors.border,
                  backgroundColor:
                    view === "active" ? colors.primary : colors.card,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    view === "active"
                      ? colors.primaryForeground
                      : colors.foreground,
                  fontWeight: "600",
                }}
              >
                Active
              </Text>
            </Pressable>
          </Link>
          <Link href={"/dates?view=trash" as Href} asChild>
            <Pressable
              testID="tab-dates-trash"
              style={({ pressed }) => [
                styles.tab,
                {
                  borderColor: colors.border,
                  backgroundColor:
                    view === "trash" ? colors.primary : colors.card,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather
                name="trash-2"
                size={14}
                color={
                  view === "trash"
                    ? colors.primaryForeground
                    : colors.foreground
                }
              />
              <Text
                style={{
                  color:
                    view === "trash"
                      ? colors.primaryForeground
                      : colors.foreground,
                  fontWeight: "600",
                }}
              >
                Trash
              </Text>
            </Pressable>
          </Link>
        </View>

        <View
          style={[
            styles.searchRow,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            testID="input-search-dates"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => setSubmittedQ(q.trim())}
            placeholder="Search notes…"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {q ? (
            <Pressable
              onPress={() => {
                setQ("");
                setSubmittedQ("");
              }}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        {list.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.foreground} />
          </View>
        ) : list.isError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.mutedForeground }}>
              Couldn't load your notes. Pull to refresh.
            </Text>
          </View>
        ) : notes.length === 0 ? (
          <View
            style={[
              styles.empty,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Feather name="heart" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {view === "trash"
                ? "Nothing in the trash"
                : submittedQ
                  ? "No matches"
                  : "No post-date notes yet"}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {view === "trash"
                ? "Deleted notes show up here for 30 days."
                : "Run a Debrief on the web after your next date."}
            </Text>
          </View>
        ) : (
          notes.map((n) => (
            <View
              key={n.id}
              testID={`row-date-${n.id}`}
              style={[
                styles.card,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {fmt(n.dateAt ?? n.createdAt)}
                  {n.personLabel ? `  ·  ${n.personLabel}` : ""}
                  {n.outcome
                    ? `  ·  ${OUTCOME_LABELS[n.outcome] ?? n.outcome}`
                    : ""}
                </Text>
                {view === "trash" ? (
                  <Pressable
                    testID={`button-restore-date-${n.id}`}
                    onPress={() => handleRestore(n)}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather
                      name="rotate-ccw"
                      size={16}
                      color={colors.foreground}
                    />
                  </Pressable>
                ) : (
                  <Pressable
                    testID={`button-delete-date-${n.id}`}
                    onPress={() => handleDelete(n)}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={colors.destructive ?? "#ef4444"}
                    />
                  </Pressable>
                )}
              </View>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 13.5,
                  lineHeight: 19,
                }}
              >
                {n.summary}
              </Text>
              {n.whatWentWell ? (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  <Text style={{ color: colors.success, fontWeight: "700" }}>
                    What went well · {""}
                  </Text>
                  {n.whatWentWell}
                </Text>
              ) : null}
              {n.whatDidnt ? (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  <Text
                    style={{
                      color: colors.rose ?? colors.destructive ?? "#ef4444",
                      fontWeight: "700",
                    }}
                  >
                    What didn't · {""}
                  </Text>
                  {n.whatDidnt}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Pressable
              testID="button-cancel-new-date"
              onPress={() => setCreateOpen(false)}
              hitSlop={10}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}
            >
              New post-date note
            </Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Who was it with? (optional)
            </Text>
            <TextInput
              testID="input-new-date-person"
              value={draftPerson}
              onChangeText={setDraftPerson}
              placeholder="First name or nickname"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Summary
            </Text>
            <TextInput
              testID="input-new-date-summary"
              value={draftSummary}
              onChangeText={setDraftSummary}
              placeholder="A sentence or two about how it went."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  minHeight: 90,
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              What went well
            </Text>
            <TextInput
              testID="input-new-date-went-well"
              value={draftWentWell}
              onChangeText={setDraftWentWell}
              placeholder="The good stuff."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  minHeight: 70,
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              What didn't work
            </Text>
            <TextInput
              testID="input-new-date-didnt-work"
              value={draftDidntWork}
              onChangeText={setDraftDidntWork}
              placeholder="Friction, mismatches, or red flags."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  minHeight: 70,
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Outcome
            </Text>
            <View style={[styles.row, { flexWrap: "wrap" }]}>
              {OUTCOMES.map((o) => {
                const active = draftOutcome === o.value;
                return (
                  <Pressable
                    key={o.value}
                    testID={`chip-outcome-${o.value}`}
                    onPress={() =>
                      setDraftOutcome(active ? null : o.value)
                    }
                    style={[
                      styles.tab,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active
                          ? colors.primary
                          : colors.card,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active
                          ? colors.primaryForeground
                          : colors.foreground,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ height: 8 }} />
            <PrimaryButton
              label={create.isPending ? "Saving…" : "Save note"}
              onPress={submitCreate}
              loading={create.isPending}
              disabled={!draftSummary.trim()}
              icon="check"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  root: { flex: 1 },
  intro: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },
  center: { paddingVertical: 48, alignItems: "center" },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
