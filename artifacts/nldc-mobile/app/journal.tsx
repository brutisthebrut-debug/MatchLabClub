import { Feather } from "@expo/vector-icons";
import {
  useListJournalEntries,
  useCreateJournalEntry,
  useDeleteJournalEntry,
  useRestoreJournalEntry,
  useUpdateJournalEntry,
  getListJournalEntriesQueryKey,
  type JournalEntry,
} from "@workspace/api-client-react";
import { rememberAnonymousId } from "@/lib/anonymousIds";
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

export default function JournalScreen() {
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
    () => getListJournalEntriesQueryKey(listParams),
    [listParams],
  );
  const list = useListJournalEntries(listParams, {
    query: { queryKey: listKey, enabled: isAuthenticated },
  });
  const del = useDeleteJournalEntry();
  const restore = useRestoreJournalEntry();
  const create = useCreateJournalEntry();
  const update = useUpdateJournalEntry();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [draftPrompt, setDraftPrompt] = React.useState("");
  const [draftBody, setDraftBody] = React.useState("");
  const [draftTags, setDraftTags] = React.useState("");

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editPrompt, setEditPrompt] = React.useState("");
  const [editBody, setEditBody] = React.useState("");
  const [editTags, setEditTags] = React.useState("");

  const openEdit = React.useCallback((entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditPrompt(entry.prompt ?? "");
    setEditBody(entry.body);
    setEditTags((entry.tags ?? []).join(", "));
  }, []);

  const closeEdit = React.useCallback(() => {
    setEditingId(null);
  }, []);

  function submitEdit() {
    if (editingId == null) return;
    const body = editBody.trim();
    if (!body) return;
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    const promptTrimmed = editPrompt.trim();
    update.mutate(
      {
        id: editingId,
        data: {
          body,
          prompt: promptTrimmed ? promptTrimmed : null,
          tags,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setEditingId(null);
        },
        onError: () =>
          Alert.alert("Couldn't save", "Try again in a moment."),
      },
    );
  }

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
  }, [queryClient]);

  const handleDelete = React.useCallback(
    (entry: JournalEntry) => {
      Alert.alert(
        "Move to trash?",
        "You can restore it within 30 days.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move to trash",
            style: "destructive",
            onPress: () =>
              del.mutate(
                { id: entry.id },
                {
                  onSuccess: () => invalidate(),
                  onError: () =>
                    Alert.alert("Couldn't delete", "Try again in a moment."),
                },
              ),
          },
        ],
      );
    },
    [del, invalidate],
  );

  function submitCreate() {
    const body = draftBody.trim();
    if (!body) return;
    const tags = draftTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    create.mutate(
      {
        data: {
          body,
          ...(draftPrompt.trim() ? { prompt: draftPrompt.trim() } : {}),
          ...(tags.length > 0 ? { tags } : {}),
        },
      },
      {
        onSuccess: (entry) => {
          void rememberAnonymousId("journalEntries", entry.id);
          invalidate();
          setCreateOpen(false);
          setDraftPrompt("");
          setDraftBody("");
          setDraftTags("");
        },
        onError: () =>
          Alert.alert("Couldn't save", "Try again in a moment."),
      },
    );
  }

  const handleRestore = React.useCallback(
    (entry: JournalEntry) => {
      restore.mutate(
        { id: entry.id },
        {
          onSuccess: () => invalidate(),
          onError: () =>
            Alert.alert("Couldn't restore", "Try again in a moment."),
        },
      );
    },
    [restore, invalidate],
  );

  const entries = list.data?.entries ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: view === "trash" ? "Journal trash" : "Your journal",
          headerRight: () =>
            view === "active" ? (
              <Pressable
                testID="button-new-journal"
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
          Reflections from your weekly plans, debriefs, and freeform notes.
          Captured automatically when you build a plan or debrief a date.
        </Text>

        <View style={styles.row}>
          <Link href={"/journal" as Href} asChild>
            <Pressable
              testID="tab-journal-active"
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
          <Link href={"/journal?view=trash" as Href} asChild>
            <Pressable
              testID="tab-journal-trash"
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
            testID="input-search-journal"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => setSubmittedQ(q.trim())}
            placeholder="Search reflections…"
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
              Couldn't load your journal. Pull to refresh.
            </Text>
          </View>
        ) : entries.length === 0 ? (
          <View
            style={[
              styles.empty,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Feather name="book-open" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {view === "trash"
                ? "Nothing in the trash"
                : submittedQ
                  ? "No matches"
                  : "No reflections yet"}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {view === "trash"
                ? "Deleted reflections show up here for 30 days."
                : "Build a Weekly Growth Plan on the web to start your journal."}
            </Text>
          </View>
        ) : (
          entries.map((e) => (
            <Pressable
              key={e.id}
              testID={`row-journal-${e.id}`}
              onPress={view === "active" ? () => openEdit(e) : undefined}
              disabled={view !== "active"}
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: pressed && view === "active" ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    flex: 1,
                  }}
                >
                  {fmt(e.createdAt)}
                  {e.tags && e.tags.length > 0 ? `  ·  ${e.tags.join(", ")}` : ""}
                </Text>
                {view === "trash" ? (
                  <Pressable
                    testID={`button-restore-journal-${e.id}`}
                    onPress={() => handleRestore(e)}
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
                    testID={`button-delete-journal-${e.id}`}
                    onPress={() => handleDelete(e)}
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
              {e.prompt ? (
                <Text
                  style={[styles.cardTitle, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {e.prompt}
                </Text>
              ) : null}
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 13,
                  lineHeight: 19,
                }}
              >
                {e.body}
              </Text>
            </Pressable>
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
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Pressable
              testID="button-cancel-new-journal"
              onPress={() => setCreateOpen(false)}
              hitSlop={10}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              New reflection
            </Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Prompt (optional)
            </Text>
            <TextInput
              testID="input-new-journal-prompt"
              value={draftPrompt}
              onChangeText={setDraftPrompt}
              placeholder="What were you reflecting on?"
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
              Reflection
            </Text>
            <TextInput
              testID="input-new-journal-body"
              value={draftBody}
              onChangeText={setDraftBody}
              placeholder="Write it out, what's coming up for you?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  minHeight: 160,
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Tags (comma-separated)
            </Text>
            <TextInput
              testID="input-new-journal-tags"
              value={draftTags}
              onChangeText={setDraftTags}
              placeholder="weekly, intention"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <View style={{ height: 8 }} />
            <PrimaryButton
              label={create.isPending ? "Saving…" : "Save reflection"}
              onPress={submitCreate}
              loading={create.isPending}
              disabled={!draftBody.trim()}
              icon="check"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editingId != null}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Pressable
              testID="button-cancel-edit-journal"
              onPress={closeEdit}
              hitSlop={10}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              Edit reflection
            </Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Prompt (optional)
            </Text>
            <TextInput
              testID="input-edit-journal-prompt"
              value={editPrompt}
              onChangeText={setEditPrompt}
              placeholder="What were you reflecting on?"
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
              Reflection
            </Text>
            <TextInput
              testID="input-edit-journal-body"
              value={editBody}
              onChangeText={setEditBody}
              placeholder="Write it out, what's coming up for you?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  minHeight: 160,
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Tags (comma-separated)
            </Text>
            <TextInput
              testID="input-edit-journal-tags"
              value={editTags}
              onChangeText={setEditTags}
              placeholder="weekly, intention"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <View style={{ height: 8 }} />
            <PrimaryButton
              label={update.isPending ? "Saving…" : "Save changes"}
              onPress={submitEdit}
              loading={update.isPending}
              disabled={!editBody.trim()}
              icon="check"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  cardTitle: { fontSize: 14, fontWeight: "700" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
