import { Feather } from "@expo/vector-icons";
import {
  getListAuditsQueryKey,
  useBulkDeleteAudits,
  useDeleteAudit,
  useListAudits,
  type Audit,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";

interface DemoMatch {
  id: number;
  firstName: string;
  readinessScore: number | null;
  bio: string;
  createdAt: string;
  isDemo: true;
}

const DEMO_MATCHES: DemoMatch[] = [
  {
    id: -1,
    firstName: "Hinge match",
    readinessScore: 78,
    bio: "29 · designer in Brooklyn. Sourdough hobbyist, big into film photography, recovering perfectionist. Looking for someone curious and kind.",
    createdAt: new Date().toISOString(),
    isDemo: true,
  },
  {
    id: -2,
    firstName: "Bumble match",
    readinessScore: 64,
    bio: "Marketing manager, runs half marathons on weekends. Trying to read 30 books this year. Dog mom to a very dramatic corgi.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isDemo: true,
  },
  {
    id: -3,
    firstName: "Tinder match",
    readinessScore: 52,
    bio: "Just here for a good time. Love travel, food, and dogs. Ask me about my last trip.",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isDemo: true,
  },
];

type SortOrder = "newest" | "topScore";
type ScoreRange = "all" | "low" | "medium" | "high";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

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

function scoreColor(
  score: number | null,
  colors: ReturnType<typeof useColors>,
): string {
  if (score === null) return colors.mutedForeground;
  if (score >= 75) return colors.success;
  if (score >= 55) return colors.gold;
  return colors.rose;
}

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortOrder>("newest");
  const [range, setRange] = React.useState<ScoreRange>("all");
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const listParams = React.useMemo(
    () => ({
      source: "screenshot" as const,
      sort,
      ...(debouncedQuery.length > 0 ? { q: debouncedQuery } : {}),
      ...(range !== "all" ? { scoreRange: range } : {}),
    }),
    [sort, debouncedQuery, range],
  );
  const { data, isLoading, isRefetching, refetch, error } = useListAudits(listParams);
  const queryClient = useQueryClient();
  const listKey = getListAuditsQueryKey(listParams);
  const deleteAudit = useDeleteAudit({
    mutation: {
      onError: (_err, _vars, _ctx) => {
        if (Platform.OS !== "web") {
          Alert.alert("Couldn't delete", "Something went wrong. Try again.");
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: listKey });
      },
    },
  });

  const [pendingDelete, setPendingDelete] = React.useState<{
    audit: Audit;
    expiresAt: number;
  } | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAuditRef = useRef<Audit | null>(null);
  const UNDO_WINDOW_MS = 5000;

  const removeFromCache = (id: number) => {
    const previous = queryClient.getQueryData<Audit[]>(listKey);
    if (previous) {
      queryClient.setQueryData<Audit[]>(
        listKey,
        previous.filter((a) => a.id !== id),
      );
    }
  };

  const restoreToCache = (audit: Audit) => {
    const previous = queryClient.getQueryData<Audit[]>(listKey) ?? [];
    if (previous.some((a) => a.id === audit.id)) return;
    queryClient.setQueryData<Audit[]>(listKey, [...previous, audit]);
  };

  const finalizePendingDelete = React.useCallback(() => {
    const audit = pendingAuditRef.current;
    if (!audit) return;
    pendingAuditRef.current = null;
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    setPendingDelete(null);
    deleteAudit.mutate({ id: audit.id });
  }, [deleteAudit]);

  const undoPendingDelete = () => {
    const audit = pendingAuditRef.current;
    if (!audit) return;
    pendingAuditRef.current = null;
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    restoreToCache(audit);
    setPendingDelete(null);
  };

  const beginUndoableDelete = (audit: Audit) => {
    if (pendingAuditRef.current) {
      finalizePendingDelete();
    }
    pendingAuditRef.current = audit;
    removeFromCache(audit.id);
    setPendingDelete({ audit, expiresAt: Date.now() + UNDO_WINDOW_MS });
    pendingTimerRef.current = setTimeout(() => {
      finalizePendingDelete();
    }, UNDO_WINDOW_MS);
  };

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      if (pendingAuditRef.current) {
        deleteAudit.mutate({ id: pendingAuditRef.current.id });
        pendingAuditRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bulkDeleteAudits = useBulkDeleteAudits({
    mutation: {
      onMutate: async ({ data }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData<Audit[]>(listKey);
        const ids = new Set(data.ids);
        if (previous) {
          queryClient.setQueryData<Audit[]>(
            listKey,
            previous.filter((a) => !ids.has(a.id)),
          );
        }
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) {
          queryClient.setQueryData(listKey, ctx.previous);
        }
        if (Platform.OS !== "web") {
          Alert.alert("Couldn't delete", "Something went wrong. Try again.");
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: listKey });
      },
    },
  });

  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(
    () => new Set(),
  );
  const selectionMode = selectedIds.size > 0;

  const openSwipeRef = useRef<Swipeable | null>(null);

  const toggleSelected = React.useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelection = React.useCallback((id: number) => {
    if (openSwipeRef.current) {
      openSwipeRef.current.close();
      openSwipeRef.current = null;
    }
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const askBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const message =
      ids.length === 1
        ? "Remove 1 match? This can't be undone."
        : `Remove ${ids.length} matches? This can't be undone.`;
    const run = () => {
      bulkDeleteAudits.mutate({ data: { ids } });
      clearSelection();
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) run();
      return;
    }
    Alert.alert("Delete matches?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: run },
    ]);
  };

  const askDelete = (audit: Audit) => {
    const message = `Remove ${audit.firstName} from your matches?`;
    const run = () => beginUndoableDelete(audit);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) run();
      return;
    }
    Alert.alert("Delete match?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: run },
    ]);
  };

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;
  const bottomInset =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) + 84 : insets.bottom + 80;

  const audits = React.useMemo(() => data ?? [], [data]);

  const hasFilters = query.trim().length > 0 || sort !== "newest" || range !== "all";
  const showDemo = !isLoading && audits.length === 0 && !hasFilters;
  const showNoResults =
    !isLoading && audits.length === 0 && hasFilters;

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
          eyebrow="My Matches"
          title="Profiles you've scanned"
          subtitle="Every screenshot you audit lands here. Tap one to re-open its mini-report."
        />

        {!showDemo ? (
          <View style={styles.controls}>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or bio"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.searchInput, { color: colors.foreground }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                >
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label="Newest"
                icon="clock"
                active={sort === "newest"}
                onPress={() => setSort("newest")}
              />
              <Chip
                label="Top score"
                icon="award"
                active={sort === "topScore"}
                onPress={() => setSort("topScore")}
              />
              <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
              <Chip
                label="All"
                active={range === "all"}
                onPress={() => setRange("all")}
              />
              <Chip
                label="High 75+"
                tone="success"
                active={range === "high"}
                onPress={() => setRange("high")}
              />
              <Chip
                label="Medium 55–74"
                tone="gold"
                active={range === "medium"}
                onPress={() => setRange("medium")}
              />
              <Chip
                label="Low <55"
                tone="rose"
                active={range === "low"}
                onPress={() => setRange("low")}
              />
            </ScrollView>
          </View>
        ) : null}

        {isLoading ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading your matches…
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: `${colors.destructive}22`,
                borderColor: colors.destructive,
              },
            ]}
          >
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              Couldn't load your matches. Pull down to retry.
            </Text>
          </View>
        ) : null}

        {showDemo ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={[styles.iconBubble, { backgroundColor: `${colors.violet}22` }]}>
              <Feather name="camera" size={18} color={colors.violet} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No scans yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Audit a profile from the Scan tab and it'll show up here so you
              can flick back through it later.
            </Text>
            <View style={styles.demoLabelRow}>
              <View
                style={[
                  styles.demoChip,
                  { backgroundColor: `${colors.gold}22`, borderColor: colors.gold },
                ]}
              >
                <Text style={[styles.demoChipText, { color: colors.gold }]}>
                  Sample
                </Text>
              </View>
              <Text style={[styles.demoLabel, { color: colors.mutedForeground }]}>
                What it'll look like
              </Text>
            </View>
            {DEMO_MATCHES.map((m) => (
              <MatchRow
                key={`demo-${m.id}`}
                firstName={m.firstName}
                readinessScore={m.readinessScore}
                bio={m.bio}
                createdAt={m.createdAt}
                disabled
              />
            ))}
          </View>
        ) : null}

        {showNoResults ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={[styles.iconBubble, { backgroundColor: `${colors.violet}22` }]}>
              <Feather name="filter" size={18} color={colors.violet} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No matches fit those filters
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Try a different search, score range, or sort order.
            </Text>
            {hasFilters ? (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setSort("newest");
                  setRange("all");
                }}
                style={({ pressed }) => [
                  styles.resetBtn,
                  {
                    borderColor: colors.cardBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.resetBtnText, { color: colors.foreground }]}>
                  Reset filters
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!showDemo && audits.length > 0 ? (
          <>
            {selectionMode ? (
              <View
                style={[
                  styles.selectionBar,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Pressable
                  onPress={clearSelection}
                  hitSlop={8}
                  accessibilityLabel="Cancel selection"
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>
                <Text
                  style={[styles.selectionCount, { color: colors.foreground }]}
                >
                  {selectedIds.size} selected
                </Text>
                <Pressable
                  onPress={askBulkDelete}
                  accessibilityLabel="Delete selected matches"
                  style={({ pressed }) => [
                    styles.selectionDelete,
                    {
                      backgroundColor: colors.destructive,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="trash-2" size={14} color="#fff" />
                  <Text style={styles.selectionDeleteText}>Delete</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.list}>
              {audits.map((audit) => {
                const isSelected = selectedIds.has(audit.id);
                const onRowPress = () => {
                  if (selectionMode) {
                    toggleSelected(audit.id);
                  } else {
                    router.push(`/audit/${audit.id}` as never);
                  }
                };
                const onRowLongPress = () => enterSelection(audit.id);

                if (selectionMode) {
                  return (
                    <MatchRow
                      key={audit.id}
                      firstName={audit.firstName}
                      readinessScore={audit.readinessScore ?? null}
                      bio={audit.bio}
                      createdAt={audit.createdAt}
                      onPress={onRowPress}
                      onLongPress={onRowLongPress}
                      selected={isSelected}
                    />
                  );
                }

                let swipeRef: Swipeable | null = null;
                return (
                  <Swipeable
                    key={audit.id}
                    ref={(r) => {
                      swipeRef = r;
                    }}
                    friction={2}
                    rightThreshold={40}
                    overshootRight={false}
                    onSwipeableWillOpen={() => {
                      if (
                        openSwipeRef.current &&
                        openSwipeRef.current !== swipeRef
                      ) {
                        openSwipeRef.current.close();
                      }
                      openSwipeRef.current = swipeRef;
                    }}
                    renderRightActions={() => (
                      <RectButton
                        style={[
                          styles.deleteAction,
                          { backgroundColor: colors.destructive },
                        ]}
                        onPress={() => {
                          swipeRef?.close();
                          askDelete(audit);
                        }}
                      >
                        <Feather name="trash-2" size={18} color="#fff" />
                        <Text style={styles.deleteActionText}>Delete</Text>
                      </RectButton>
                    )}
                  >
                    <MatchRow
                      firstName={audit.firstName}
                      readinessScore={audit.readinessScore ?? null}
                      bio={audit.bio}
                      createdAt={audit.createdAt}
                      onPress={onRowPress}
                      onLongPress={onRowLongPress}
                    />
                  </Swipeable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      {pendingDelete ? (
        <UndoToast
          key={pendingDelete.audit.id}
          name={pendingDelete.audit.firstName}
          durationMs={UNDO_WINDOW_MS}
          bottomOffset={bottomInset - 60}
          onUndo={undoPendingDelete}
        />
      ) : null}
    </View>
  );
}

function UndoToast({
  name,
  durationMs,
  bottomOffset,
  onUndo,
}: {
  name: string;
  durationMs: number;
  bottomOffset: number;
  onUndo: () => void;
}) {
  const colors = useColors();
  const progress = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    Animated.timing(progress, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [durationMs, opacity, progress]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.toastWrap, { bottom: Math.max(bottomOffset, 16), opacity }]}
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          styles.toast,
          { backgroundColor: colors.foreground, borderColor: colors.cardBorder },
        ]}
      >
        <Feather name="trash-2" size={14} color={colors.background} />
        <Text
          style={[styles.toastText, { color: colors.background }]}
          numberOfLines={1}
        >
          Removed {name}
        </Text>
        <Pressable
          onPress={onUndo}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Undo removing ${name}`}
          style={({ pressed }) => [
            styles.toastUndo,
            {
              borderColor: colors.background,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[styles.toastUndoText, { color: colors.background }]}>
            Undo
          </Text>
        </Pressable>
        <Animated.View
          style={[
            styles.toastProgress,
            { backgroundColor: colors.primary, width: barWidth },
          ]}
        />
      </View>
    </Animated.View>
  );
}

function Chip({
  label,
  icon,
  active,
  tone,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
  active: boolean;
  tone?: "success" | "gold" | "rose";
  onPress: () => void;
}) {
  const colors = useColors();
  const toneColor =
    tone === "success"
      ? colors.success
      : tone === "gold"
        ? colors.gold
        : tone === "rose"
          ? colors.rose
          : colors.primary;
  const bg = active ? `${toneColor}22` : colors.card;
  const border = active ? toneColor : colors.cardBorder;
  const fg = active ? toneColor : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon ? <Feather name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function MatchRow({
  firstName,
  readinessScore,
  bio,
  createdAt,
  onPress,
  onLongPress,
  disabled,
  selected,
}: {
  firstName: string;
  readinessScore: number | null;
  bio: string;
  createdAt: string;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const colors = useColors();
  const thumbnail = bio.trim().slice(0, 110);
  const ring = scoreColor(readinessScore, colors);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      disabled={disabled}
      accessibilityRole={selected !== undefined ? "checkbox" : "button"}
      accessibilityState={
        selected !== undefined ? { checked: selected } : undefined
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: selected ? colors.primary : colors.cardBorder,
          borderWidth: selected ? 2 : 1,
          opacity: disabled ? 0.85 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {selected !== undefined ? (
        <View
          style={[
            styles.checkbox,
            selected
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: "transparent", borderColor: colors.cardBorder },
          ]}
        >
          {selected ? <Feather name="check" size={14} color="#fff" /> : null}
        </View>
      ) : null}
      <View style={[styles.scoreBubble, { borderColor: ring }]}>
        <Text style={[styles.scoreText, { color: ring }]}>
          {readinessScore ?? "—"}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text
            style={[styles.rowName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {firstName}
          </Text>
          <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>
            {formatDate(createdAt)}
          </Text>
        </View>
        <Text
          style={[styles.rowBio, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {thumbnail || "No bio text extracted."}
        </Text>
      </View>
      {!disabled && selected === undefined ? (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  controls: { gap: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    padding: 0,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  divider: {
    width: 1,
    height: 18,
    marginHorizontal: 2,
  },
  loadingCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  loadingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
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
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_500Medium",
    marginBottom: 6,
  },
  resetBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetBtnText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  demoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
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
  demoLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  list: { gap: 10 },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectionCount: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  selectionDelete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  selectionDeleteText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  scoreBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  rowBody: { flex: 1, gap: 4 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  rowDate: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  rowBio: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    borderRadius: 16,
    marginLeft: 8,
    gap: 4,
  },
  deleteActionText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "stretch",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  toastUndo: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toastUndoText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  toastProgress: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 2,
  },
});
