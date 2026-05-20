import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DatingProfile } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Hoisted mutable refs — must be declared before vi.mock() so factories
// can close over them.
// ---------------------------------------------------------------------------

const profilesRef = vi.hoisted(() => ({
  current: {
    data: [] as DatingProfile[],
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  },
}));

const createRef = vi.hoisted(() => ({
  current: {
    mutateAsync: vi.fn<
      [{ data: Omit<DatingProfile, "id" | "createdAt"> }],
      Promise<DatingProfile>
    >(),
    isPending: false,
  },
}));

const updateRef = vi.hoisted(() => ({
  current: {
    mutateAsync: vi.fn<
      [{ id: number; data: Partial<Omit<DatingProfile, "id" | "createdAt">> }],
      Promise<DatingProfile>
    >(),
    isPending: false,
  },
}));

const deleteRef = vi.hoisted(() => ({
  current: {
    mutateAsync: vi.fn<[{ id: number }], Promise<void>>(),
    isPending: false,
  },
}));

// ---------------------------------------------------------------------------
// React Native mocks — registered before any screen import.
// ---------------------------------------------------------------------------

vi.mock("react-native", () => ({
  View: ({
    children,
    testID,
    style: _s,
    pointerEvents: _pe,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    style?: unknown;
    pointerEvents?: string;
  }) => (
    <div data-testid={testID} {...rest}>
      {children}
    </div>
  ),
  Text: ({
    children,
    testID,
    style: _s,
    numberOfLines: _nl,
    accessibilityLiveRegion: _alr,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    style?: unknown;
    numberOfLines?: number;
    accessibilityLiveRegion?: string;
  }) => (
    <span data-testid={testID} {...rest}>
      {children}
    </span>
  ),
  ScrollView: ({
    children,
    testID,
    contentContainerStyle: _ccs,
    style: _s,
    horizontal: _h,
    showsHorizontalScrollIndicator: _shi,
    keyboardShouldPersistTaps: _kspt,
    refreshControl: _rc,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    contentContainerStyle?: unknown;
    style?: unknown;
    horizontal?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    keyboardShouldPersistTaps?: string;
    refreshControl?: React.ReactNode;
  }) => (
    <div data-testid={testID} {...rest}>
      {children}
    </div>
  ),
  Modal: ({
    children,
    visible,
    onRequestClose: _orc,
    animationType: _at,
    presentationStyle: _ps,
  }: {
    children?: React.ReactNode;
    visible?: boolean;
    onRequestClose?: () => void;
    animationType?: string;
    presentationStyle?: string;
  }) => (visible ? <div data-testid="modal-sheet">{children}</div> : null),
  KeyboardAvoidingView: ({
    children,
    style: _s,
    behavior: _b,
  }: {
    children?: React.ReactNode;
    style?: unknown;
    behavior?: string;
  }) => <div>{children}</div>,
  Pressable: ({
    children,
    testID,
    onPress,
    disabled,
    style: _s,
    accessibilityLabel,
    accessibilityRole: _ar,
    hitSlop: _hs,
    ...rest
  }: {
    children?: React.ReactNode | ((s: { pressed: boolean }) => React.ReactNode);
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
    style?: unknown | ((s: { pressed: boolean }) => unknown);
    accessibilityLabel?: string;
    accessibilityRole?: string;
    hitSlop?: number;
  }) => (
    <button
      data-testid={testID}
      onClick={() => !disabled && onPress?.()}
      disabled={disabled}
      aria-label={accessibilityLabel}
      {...rest}
    >
      {typeof children === "function" ? children({ pressed: false }) : children}
    </button>
  ),
  TextInput: ({
    testID,
    value,
    onChangeText,
    editable,
    style: _s,
    placeholder,
    placeholderTextColor: _ptc,
    multiline,
    numberOfLines: _nl,
    textAlignVertical: _tav,
    autoCapitalize: _ac,
    returnKeyType: _rkt,
    keyboardType: _kt,
    ...rest
  }: {
    testID?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    editable?: boolean;
    style?: unknown;
    placeholder?: string;
    placeholderTextColor?: string;
    multiline?: boolean;
    numberOfLines?: number;
    textAlignVertical?: string;
    autoCapitalize?: string;
    returnKeyType?: string;
    keyboardType?: string;
  }) =>
    multiline ? (
      <textarea
        data-testid={testID}
        value={value ?? ""}
        disabled={editable === false}
        placeholder={placeholder}
        onChange={(e) => onChangeText?.(e.target.value)}
        {...rest}
      />
    ) : (
      <input
        data-testid={testID}
        value={value ?? ""}
        disabled={editable === false}
        placeholder={placeholder}
        onChange={(e) => onChangeText?.(e.target.value)}
        {...rest}
      />
    ),
  Animated: {
    View: ({
      children,
      style: _s,
      pointerEvents: _pe,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      pointerEvents?: string;
    }) => <div>{children}</div>,
    Value: class {
      constructor(_v: number) {}
      interpolate() {
        return "0%";
      }
    },
    timing: (_v: unknown, _cfg: unknown) => ({ start: (_cb?: () => void) => {} }),
  },
  RefreshControl: () => null,
  ActivityIndicator: () => null,
  Platform: { OS: "web" },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(s: T): T => s,
  },
}));

vi.mock("react-native-gesture-handler", () => ({
  Swipeable: ({
    children,
    renderRightActions,
    onSwipeableWillOpen: _oswo,
    friction: _f,
    rightThreshold: _rt,
    overshootRight: _or,
  }: {
    children?: React.ReactNode;
    renderRightActions?: () => React.ReactNode;
    onSwipeableWillOpen?: () => void;
    friction?: number;
    rightThreshold?: number;
    overshootRight?: boolean;
  }) => (
    <div>
      {children}
      {renderRightActions?.()}
    </div>
  ),
  RectButton: ({
    children,
    onPress,
    style: _s,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    style?: unknown;
  }) => <button onClick={onPress}>{children}</button>,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: ({
    name: _n,
    size: _s,
    color: _c,
    style: _st,
  }: {
    name: string;
    size?: number;
    color?: string;
    style?: unknown;
  }) => null,
}));

vi.mock("@workspace/api-client-react", () => ({
  useListProfiles: () => profilesRef.current,
  useCreateProfile: (_opts?: unknown) => createRef.current,
  useUpdateProfile: () => updateRef.current,
  useDeleteProfile: () => deleteRef.current,
  getListProfilesQueryKey: () => ["list-profiles"],
}));

vi.mock("@/lib/useCreateAnonymousAware", () => ({
  useCreateProfileWithAnonClaim: () => createRef.current,
}));

vi.mock("@/lib/anonymousIds", () => ({
  rememberAnonymousId: vi.fn(async () => {}),
}));

vi.mock("@/components/PrimaryButton", () => ({
  PrimaryButton: ({
    label,
    onPress,
    loading,
    disabled,
    icon: _i,
  }: {
    label: string;
    onPress?: () => void;
    loading?: boolean;
    disabled?: boolean;
    icon?: string;
  }) => (
    <button
      data-testid="button-primary"
      onClick={onPress}
      disabled={disabled ?? loading}
    >
      {label}
    </button>
  ),
}));

vi.mock("@/components/ScreenHeader", () => ({
  ScreenHeader: ({
    title,
  }: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
  }) => <h1>{title}</h1>,
}));

vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0B0F1D",
    card: "#111827",
    cardBorder: "#1F2937",
    border: "#374151",
    foreground: "#F9FAFB",
    mutedForeground: "#9CA3AF",
    primary: "#8B5CF6",
    primaryForeground: "#fff",
    destructive: "#EF4444",
    success: "#22C55E",
    gold: "#F59E0B",
    violet: "#8B5CF6",
    teal: "#14B8A6",
    rose: "#F43F5E",
    input: "#1F2937",
  }),
}));

// ---------------------------------------------------------------------------
// Import AFTER all vi.mock() calls.
// ---------------------------------------------------------------------------

import ProfilesScreen from "@/app/(tabs)/profiles";

// ---------------------------------------------------------------------------
// Test lifecycle helpers
// ---------------------------------------------------------------------------

let qc: QueryClient;

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeProfile(overrides: Partial<DatingProfile> = {}): DatingProfile {
  return {
    id: 1,
    platform: "Hinge",
    bio: "Brooklyn designer, sourdough hobbyist.",
    prompts: null,
    photoCount: null,
    notes: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  profilesRef.current = {
    data: [],
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  };
  createRef.current = {
    mutateAsync: vi.fn(),
    isPending: false,
  };
  updateRef.current = {
    mutateAsync: vi.fn(),
    isPending: false,
  };
  deleteRef.current = {
    mutateAsync: vi.fn(),
    isPending: false,
  };
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: initial render
// ---------------------------------------------------------------------------

describe("Profiles screen — initial render", () => {
  it("shows the screen header and 'Save a profile' button", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    expect(screen.getByText("Profiles to revisit")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save a dating profile" }),
    ).toBeTruthy();
  });

  it("shows demo cards when there are no saved profiles", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    expect(
      screen.getByText("No saved profiles yet. Here's what they'll look like."),
    ).toBeTruthy();
    expect(screen.getByText("Hinge")).toBeTruthy();
    expect(screen.getByText("Bumble")).toBeTruthy();
  });

  it("shows a loading state while profiles are fetching", async () => {
    profilesRef.current = {
      data: [],
      isLoading: true,
      isRefetching: false,
      refetch: vi.fn(),
    };

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    expect(screen.getByText("Loading…")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: open / close modal
// ---------------------------------------------------------------------------

describe("Profiles screen — modal open/close", () => {
  it("opens the modal when 'Save a profile' is pressed", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    expect(screen.queryByTestId("modal-sheet")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save a dating profile" }));

    await waitFor(() => {
      expect(screen.getByTestId("modal-sheet")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Save profile" })).toBeTruthy();
  });

  it("closes the modal when the Close button is pressed", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save a dating profile" }));

    await waitFor(() => {
      expect(screen.getByTestId("modal-sheet")).toBeTruthy();
    });

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("modal-sheet")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: form validation
// ---------------------------------------------------------------------------

describe("Profiles screen — form validation", () => {
  async function openModal() {
    fireEvent.click(screen.getByRole("button", { name: "Save a dating profile" }));
    await waitFor(() => expect(screen.getByTestId("modal-sheet")).toBeTruthy());
  }

  it("shows a platform error when submitting with no platform selected", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(
        screen.getByText("Platform is required (e.g. Hinge, Bumble)."),
      ).toBeTruthy();
    });
  });

  it("shows a bio error when platform is set but bio is empty", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "Hinge" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(screen.getByText("Bio is required.")).toBeTruthy();
    });
  });

  it("does not call the API when required fields are missing", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(
        screen.getByText("Platform is required (e.g. Hinge, Bumble)."),
      ).toBeTruthy();
    });

    expect(createRef.current.mutateAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: successful save flow
// ---------------------------------------------------------------------------

describe("Profiles screen — successful save flow", () => {
  async function openModal() {
    fireEvent.click(screen.getByRole("button", { name: "Save a dating profile" }));
    await waitFor(() => expect(screen.getByTestId("modal-sheet")).toBeTruthy());
  }

  it("calls createProfile with the entered platform and bio", async () => {
    const newProfile = makeProfile({ platform: "Bumble", bio: "Just a test bio." });
    createRef.current.mutateAsync = vi.fn().mockResolvedValue(newProfile);

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "Bumble" }));

    const bioInput = screen.getByPlaceholderText("Paste the bio here…");
    fireEvent.change(bioInput, { target: { value: "Just a test bio." } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    });

    await waitFor(() => {
      expect(createRef.current.mutateAsync).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: "Bumble",
          bio: "Just a test bio.",
        }),
      });
    });
  });

  it("closes the modal after a successful save", async () => {
    const newProfile = makeProfile({ platform: "Hinge", bio: "Bio here." });
    createRef.current.mutateAsync = vi.fn().mockResolvedValue(newProfile);

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "Hinge" }));

    const bioInput = screen.getByPlaceholderText("Paste the bio here…");
    fireEvent.change(bioInput, { target: { value: "Bio here." } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("modal-sheet")).toBeNull();
    });
  });

  it("shows the new profile card in the list after saving", async () => {
    const newProfile = makeProfile({
      id: 42,
      platform: "Tinder",
      bio: "Adventurous soul who loves hiking.",
    });

    createRef.current.mutateAsync = vi.fn().mockImplementation(async () => {
      profilesRef.current = {
        ...profilesRef.current,
        data: [newProfile],
      };
      return newProfile;
    });

    const { rerender } = render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "Tinder" }));

    const bioInput = screen.getByPlaceholderText("Paste the bio here…");
    fireEvent.change(bioInput, { target: { value: "Adventurous soul who loves hiking." } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("modal-sheet")).toBeNull();
    });

    rerender(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByText("Adventurous soul who loves hiking.")).toBeTruthy();
    });

    expect(screen.getByText("Tinder")).toBeTruthy();
  });

  it("includes optional fields (prompts, notes) in the API call when provided", async () => {
    const newProfile = makeProfile({
      platform: "OkCupid",
      bio: "A decent bio.",
      prompts: "My green flag is…",
      notes: "Great energy",
    });
    createRef.current.mutateAsync = vi.fn().mockResolvedValue(newProfile);

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "OkCupid" }));

    fireEvent.change(screen.getByPlaceholderText("Paste the bio here…"), {
      target: { value: "A decent bio." },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste any prompt answers here…"), {
      target: { value: "My green flag is…" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Anything you want to remember about this profile…"),
      { target: { value: "Great energy" } },
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    });

    await waitFor(() => {
      expect(createRef.current.mutateAsync).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: "OkCupid",
          bio: "A decent bio.",
          prompts: "My green flag is…",
          notes: "Great energy",
        }),
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: platform chip selection
// ---------------------------------------------------------------------------

describe("Profiles screen — platform chips", () => {
  async function openModal() {
    fireEvent.click(screen.getByRole("button", { name: "Save a dating profile" }));
    await waitFor(() => expect(screen.getByTestId("modal-sheet")).toBeTruthy());
  }

  it("selects a platform chip and populates the platform field", async () => {
    const newProfile = makeProfile({ platform: "Hinge", bio: "Some bio." });
    createRef.current.mutateAsync = vi.fn().mockResolvedValue(newProfile);

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    fireEvent.click(screen.getByRole("button", { name: "Hinge" }));

    fireEvent.change(screen.getByPlaceholderText("Paste the bio here…"), {
      target: { value: "Some bio." },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    });

    await waitFor(() => {
      expect(createRef.current.mutateAsync).toHaveBeenCalledWith({
        data: expect.objectContaining({ platform: "Hinge" }),
      });
    });
  });

  it("allows typing a custom platform name", async () => {
    const newProfile = makeProfile({ platform: "FishMeet", bio: "Bio content." });
    createRef.current.mutateAsync = vi.fn().mockResolvedValue(newProfile);

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );
    await openModal();

    const platformInput = screen.getByPlaceholderText("Or type a platform name");
    fireEvent.change(platformInput, { target: { value: "FishMeet" } });

    fireEvent.change(screen.getByPlaceholderText("Paste the bio here…"), {
      target: { value: "Bio content." },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    });

    await waitFor(() => {
      expect(createRef.current.mutateAsync).toHaveBeenCalledWith({
        data: expect.objectContaining({ platform: "FishMeet" }),
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: existing profiles list
// ---------------------------------------------------------------------------

describe("Profiles screen — profile list", () => {
  it("renders real profile cards when profiles are loaded", async () => {
    profilesRef.current = {
      data: [
        makeProfile({
          id: 10,
          platform: "Bumble",
          bio: "Marketing manager, runs half marathons.",
        }),
      ],
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    };

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    expect(screen.getByText("Marketing manager, runs half marathons.")).toBeTruthy();
    expect(screen.getByText("Bumble")).toBeTruthy();
    expect(
      screen.queryByText("No saved profiles yet. Here's what they'll look like."),
    ).toBeNull();
  });

  it("shows 'No bio saved' placeholder when the profile has an empty bio", async () => {
    profilesRef.current = {
      data: [makeProfile({ id: 11, platform: "Hinge", bio: "" })],
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    };

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    expect(screen.getByText("No bio saved")).toBeTruthy();
    expect(screen.queryByText("Marketing manager, runs half marathons.")).toBeNull();
  });

  it("shows 'No bio saved' placeholder when the profile bio is null", async () => {
    profilesRef.current = {
      data: [makeProfile({ id: 12, platform: "Tinder", bio: null as unknown as string })],
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    };

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    expect(screen.getByText("No bio saved")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: edit profile flow
// ---------------------------------------------------------------------------

describe("Profiles screen — edit profile", () => {
  const savedProfile = makeProfile({
    id: 20,
    platform: "Hinge",
    bio: "Brooklyn designer, sourdough hobbyist.",
    prompts: "The way to win me over is… good taste in film.",
    notes: "Really liked this one",
  });

  beforeEach(() => {
    profilesRef.current = {
      data: [savedProfile],
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    };
  });

  it("tapping a profile card opens the edit modal pre-filled with saved values", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Edit ${savedProfile.platform} profile` }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-sheet")).toBeTruthy();
    });

    expect(screen.getByText("Edit profile")).toBeTruthy();

    const bioInput = screen.getByPlaceholderText("Paste the bio here…") as HTMLTextAreaElement;
    expect(bioInput.value).toBe(savedProfile.bio);

    const promptsInput = screen.getByPlaceholderText("Paste any prompt answers here…") as HTMLTextAreaElement;
    expect(promptsInput.value).toBe(savedProfile.prompts);

    const notesInput = screen.getByPlaceholderText(
      "Anything you want to remember about this profile…",
    ) as HTMLTextAreaElement;
    expect(notesInput.value).toBe(savedProfile.notes);

    const platformInput = screen.getByPlaceholderText("Or type a platform name") as HTMLInputElement;
    expect(platformInput.value).toBe(savedProfile.platform);
  });

  it("changing the bio and saving calls updateProfile with the new data", async () => {
    updateRef.current.mutateAsync = vi.fn().mockResolvedValue({
      ...savedProfile,
      bio: "Updated bio text.",
    });

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Edit ${savedProfile.platform} profile` }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-sheet")).toBeTruthy();
    });

    const bioInput = screen.getByPlaceholderText("Paste the bio here…");
    fireEvent.change(bioInput, { target: { value: "Updated bio text." } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });

    await waitFor(() => {
      expect(updateRef.current.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: savedProfile.id,
          data: expect.objectContaining({
            platform: savedProfile.platform,
            bio: "Updated bio text.",
          }),
        }),
      );
    });

    expect(createRef.current.mutateAsync).not.toHaveBeenCalled();
  });

  it("closes the modal after a successful edit save", async () => {
    updateRef.current.mutateAsync = vi.fn().mockResolvedValue(savedProfile);

    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Edit ${savedProfile.platform} profile` }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-sheet")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("modal-sheet")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: swipe-to-delete + undo toast
// ---------------------------------------------------------------------------

describe("Profiles screen — swipe-to-delete and undo", () => {
  const profileToDelete = makeProfile({
    id: 30,
    platform: "Tinder",
    bio: "Adventurous soul who loves hiking.",
  });

  beforeEach(() => {
    profilesRef.current = {
      data: [profileToDelete],
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    };
    deleteRef.current.mutateAsync = vi.fn().mockResolvedValue(undefined);
  });

  it("shows the undo toast after pressing the swipe-delete action button", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(
        screen.getByText(`Removed ${profileToDelete.platform} profile`),
      ).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Undo delete" })).toBeTruthy();
  });

  it("dismisses the undo toast after pressing Undo", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo delete" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo delete" }));

    await waitFor(() => {
      expect(
        screen.queryByText(`Removed ${profileToDelete.platform} profile`),
      ).toBeNull();
    });

    expect(screen.queryByRole("button", { name: "Undo delete" })).toBeNull();
  });

  it("does not call deleteProfile.mutateAsync while the undo window is open", async () => {
    render(
      <Wrap>
        <ProfilesScreen />
      </Wrap>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo delete" })).toBeTruthy();
    });

    expect(deleteRef.current.mutateAsync).not.toHaveBeenCalled();
  });
});
