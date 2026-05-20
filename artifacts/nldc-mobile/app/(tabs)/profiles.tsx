import { Feather } from "@expo/vector-icons";
import {
  getListProfilesQueryKey,
  useListProfiles,
  type DatingProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
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
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { useCreateProfileWithAnonClaim } from "@/lib/useCreateAnonymousAware";

const PLATFORM_CHIPS = ["Hinge", "Bumble", "Tinder", "OkCupid", "Coffee Meets Bagel", "Other"];

const DEMO_PROFILES: (DatingProfile & { isDemo: true })[] = [
  {
    id: -1,
    platform: "Hinge",
    bio: "29 · designer in Brooklyn. Sourdough hobbyist, big into film photography, recovering perfectionist.",
    prompts: "The way to win me over is… remembering the weird specific thing I mentioned once.",
    photoCount: 6,
    notes: "Really good prompts, check back on this one",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isDemo: true,
  },
  {
    id: -2,
    platform: "Bumble",
    bio: "Marketing manager, runs half marathons on weekends. Trying to read 30 books this year.",
    prompts: null,
    photoCount: null,
    notes: null,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    isDemo: true,
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ProfileCard({
  profile,
  isDemo,
}: {
  profile: DatingProfile;
  isDemo?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View
            style={[
              styles.platformBadge,
              { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "40" },
            ]}
          >
            <Text style={[styles.platformText, { color: colors.primary }]}>
              {profile.platform}
            </Text>
          </View>
          {isDemo && (
            <View
              style={[
                styles.demoBadge,
                { backgroundColor: colors.gold + "1A", borderColor: colors.gold + "33" },
              ]}
            >
              <Text style={[styles.demoText, { color: colors.gold }]}>Demo</Text>
            </View>
          )}
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            {formatDate(profile.createdAt)}
          </Text>
        </View>
      </View>

      <Text
        style={[styles.bioText, { color: colors.foreground }]}
        numberOfLines={3}
      >
        {profile.bio}
      </Text>

      {profile.prompts ? (
        <View style={[styles.promptWrap, { borderLeftColor: colors.primary + "50" }]}>
          <Text
            style={[styles.promptText, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {profile.prompts}
          </Text>
        </View>
      ) : null}

      {profile.notes ? (
        <View style={[styles.notesWrap, { backgroundColor: colors.gold + "0D" }]}>
          <Feather name="edit-3" size={11} color={colors.gold} style={{ marginTop: 1 }} />
          <Text style={[styles.notesText, { color: colors.gold }]} numberOfLines={2}>
            {profile.notes}
          </Text>
        </View>
      ) : null}

      {profile.photoCount != null ? (
        <View style={styles.photoRow}>
          <Feather name="image" size={12} color={colors.mutedForeground} />
          <Text style={[styles.photoCountText, { color: colors.mutedForeground }]}>
            {profile.photoCount} {profile.photoCount === 1 ? "photo" : "photos"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface FormState {
  platform: string;
  bio: string;
  prompts: string;
  photoCount: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  platform: "",
  bio: "",
  prompts: "",
  photoCount: "",
  notes: "",
};

export default function ProfilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useListProfiles();
  const createProfile = useCreateProfileWithAnonClaim();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const profiles = data ?? [];
  const showDemo = !isLoading && profiles.length === 0;

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setFormError(null);
  }

  async function handleSave() {
    const platform = form.platform.trim();
    const bio = form.bio.trim();
    if (!platform) {
      setFormError("Platform is required (e.g. Hinge, Bumble).");
      return;
    }
    if (!bio) {
      setFormError("Bio is required.");
      return;
    }
    setFormError(null);
    const photoCount =
      form.photoCount.trim() !== "" ? parseInt(form.photoCount.trim(), 10) : null;
    await createProfile.mutateAsync({
      data: {
        platform,
        bio,
        prompts: form.prompts.trim() || null,
        photoCount: Number.isNaN(photoCount) ? null : photoCount,
        notes: form.notes.trim() || null,
      },
    });
    await queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
    closeModal();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow="Saved Profiles"
          title="Profiles to revisit"
          subtitle="Save any dating profile — yours or a match's — to keep notes and come back later."
        />

        <Pressable
          onPress={openModal}
          accessibilityRole="button"
          accessibilityLabel="Save a dating profile"
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={[styles.addButtonLabel, { color: colors.primaryForeground }]}>
            Save a profile
          </Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Loading…
            </Text>
          </View>
        ) : showDemo ? (
          <View style={styles.listWrap}>
            <View style={[styles.demoNotice, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.demoNoticeText, { color: colors.mutedForeground }]}>
                No saved profiles yet. Here's what they'll look like.
              </Text>
            </View>
            {DEMO_PROFILES.map((p) => (
              <ProfileCard key={p.id} profile={p} isDemo />
            ))}
          </View>
        ) : (
          <View style={styles.listWrap}>
            {profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Save Profile Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
            {/* Modal header */}
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.cardBorder },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Save a profile
              </Text>
              <Pressable
                onPress={closeModal}
                hitSlop={8}
                accessibilityLabel="Close"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Platform */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Platform <Text style={{ color: colors.primary }}>*</Text>
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {PLATFORM_CHIPS.map((chip) => {
                    const active = form.platform === chip;
                    return (
                      <Pressable
                        key={chip}
                        onPress={() => setForm((f) => ({ ...f, platform: chip }))}
                        style={[
                          styles.chip,
                          active
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: active ? colors.primaryForeground : colors.foreground },
                          ]}
                        >
                          {chip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <TextInput
                  value={form.platform}
                  onChangeText={(v) => setForm((f) => ({ ...f, platform: v }))}
                  placeholder="Or type a platform name"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      color: colors.foreground,
                    },
                  ]}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Bio */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Bio <Text style={{ color: colors.primary }}>*</Text>
                </Text>
                <TextInput
                  value={form.bio}
                  onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                  placeholder="Paste the bio here…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={[
                    styles.textarea,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      color: colors.foreground,
                    },
                  ]}
                />
              </View>

              {/* Prompts */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Prompts{" "}
                  <Text style={[styles.optionalLabel, { color: colors.mutedForeground }]}>
                    (optional)
                  </Text>
                </Text>
                <TextInput
                  value={form.prompts}
                  onChangeText={(v) => setForm((f) => ({ ...f, prompts: v }))}
                  placeholder="Paste any prompt answers here…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.textarea,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      color: colors.foreground,
                      minHeight: 72,
                    },
                  ]}
                />
              </View>

              {/* Photo count */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Photo count{" "}
                  <Text style={[styles.optionalLabel, { color: colors.mutedForeground }]}>
                    (optional)
                  </Text>
                </Text>
                <TextInput
                  value={form.photoCount}
                  onChangeText={(v) => setForm((f) => ({ ...f, photoCount: v.replace(/[^0-9]/g, "") }))}
                  placeholder="e.g. 6"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      color: colors.foreground,
                    },
                  ]}
                />
              </View>

              {/* Notes */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Your notes{" "}
                  <Text style={[styles.optionalLabel, { color: colors.mutedForeground }]}>
                    (optional)
                  </Text>
                </Text>
                <TextInput
                  value={form.notes}
                  onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                  placeholder="Anything you want to remember about this profile…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.textarea,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      color: colors.foreground,
                      minHeight: 72,
                    },
                  ]}
                />
              </View>

              {formError ? (
                <View style={[styles.errorWrap, { backgroundColor: colors.rose + "1A", borderColor: colors.rose + "40" }]}>
                  <Feather name="alert-circle" size={14} color={colors.rose} />
                  <Text style={[styles.errorText, { color: colors.rose }]}>{formError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label="Save profile"
                onPress={() => { void handleSave(); }}
                loading={createProfile.isPending}
                disabled={createProfile.isPending}
                icon="bookmark"
              />

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 0 },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  addButtonLabel: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.2,
  },

  emptyWrap: {
    paddingTop: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },

  listWrap: { gap: 12 },

  demoNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 18,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    flexWrap: "wrap",
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  platformBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  platformText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.3,
  },
  demoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  demoText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.3,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },

  bioText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 20,
  },

  promptWrap: {
    borderLeftWidth: 2,
    paddingLeft: 10,
  },
  promptText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    fontStyle: "italic",
    lineHeight: 18,
  },

  notesWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 8,
    padding: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 17,
  },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  photoCountText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },

  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: -0.3,
  },
  modalContent: {
    padding: 20,
    gap: 20,
  },

  fieldWrap: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  optionalLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    textTransform: "none",
    letterSpacing: 0,
  },

  chipRow: { gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    minHeight: 110,
  },

  errorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 18,
  },
});
