import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mutable refs for clipboard mock control
// ---------------------------------------------------------------------------

const clipboardRef = {
  hasImage: false,
  imageData: null as string | null,
};

// ---------------------------------------------------------------------------
// React Native mocks — must be registered before any import of the screen.
// ---------------------------------------------------------------------------

vi.mock("react-native", () => ({
  View: ({
    children,
    testID,
    style: _s,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    style?: unknown;
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
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    style?: unknown;
    numberOfLines?: number;
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
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    contentContainerStyle?: unknown;
    style?: unknown;
  }) => (
    <div data-testid={testID} {...rest}>
      {children}
    </div>
  ),
  Image: ({
    source,
    testID,
    style: _s,
  }: {
    source?: { uri?: string };
    testID?: string;
    style?: unknown;
  }) => (
    <img
      data-testid={testID ?? "scan-preview-image"}
      src={source?.uri ?? ""}
      alt="preview"
    />
  ),
  Pressable: ({
    children,
    testID,
    onPress,
    disabled,
    style: _s,
    accessibilityLabel,
    accessibilityRole: _ar,
    accessibilityState: _as,
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
    accessibilityState?: unknown;
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
    placeholder: _ph,
    placeholderTextColor: _ptc,
    multiline: _ml,
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
    keyboardType?: string;
  }) => (
    <input
      data-testid={testID}
      value={value ?? ""}
      disabled={editable === false}
      onChange={(e) => onChangeText?.(e.target.value)}
      {...rest}
    />
  ),
  ActivityIndicator: () => null,
  Alert: { alert: vi.fn() },
  Platform: { OS: "web" },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(s: T): T => s,
  },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: ({
    name: _n,
    size: _s,
    color: _c,
  }: {
    name: string;
    size?: number;
    color?: string;
  }) => null,
}));

vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: vi.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: vi.fn(async () => ({ canceled: true, assets: [] })),
}));

vi.mock("expo-clipboard", () => ({
  hasImageAsync: vi.fn(async () => clipboardRef.hasImage),
  getImageAsync: vi.fn(async (_opts: unknown) =>
    clipboardRef.imageData ? { data: clipboardRef.imageData } : null,
  ),
}));

vi.mock("@/components/PrimaryButton", () => ({
  PrimaryButton: ({
    label,
    onPress,
    loading: _l,
    icon: _i,
  }: {
    label: string;
    onPress?: () => void;
    loading?: boolean;
    icon?: string;
  }) => <button onClick={onPress}>{label}</button>,
}));

vi.mock("@/components/ScoreRing", () => ({
  ScoreRing: ({ score: _s }: { score: number }) => null,
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
    background: "#000",
    card: "#111",
    cardBorder: "#222",
    border: "#333",
    foreground: "#fff",
    mutedForeground: "#999",
    primary: "#8b5cf6",
    primaryForeground: "#fff",
    destructive: "#ef4444",
    success: "#22c55e",
    gold: "#f59e0b",
    violet: "#8b5cf6",
    teal: "#14b8a6",
    rose: "#f43f5e",
    input: "#222",
  }),
}));

vi.mock("@/lib/anonymousIds", () => ({
  rememberAnonymousId: vi.fn(async () => {}),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useExtractScreenshot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAuditFromScreenshot: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// ---------------------------------------------------------------------------
// Import AFTER all vi.mock() calls.
// ---------------------------------------------------------------------------

import ScanScreen from "@/app/(tabs)/scan";
import * as Clipboard from "expo-clipboard";

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  clipboardRef.hasImage = false;
  clipboardRef.imageData = null;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests: Paste button (native clipboard path via expo-clipboard)
// ---------------------------------------------------------------------------

describe("Scan screen — Paste button (expo-clipboard path)", () => {
  it("shows an error when the clipboard has no image", async () => {
    clipboardRef.hasImage = false;

    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    const pasteBtn = await screen.findByTestId("button-paste-clipboard");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(
        screen.getByText("No image on the clipboard. Copy a screenshot first, then paste."),
      ).toBeTruthy();
    });
  });

  it("fills the preview when the clipboard has a plain base64 image", async () => {
    clipboardRef.hasImage = true;
    clipboardRef.imageData = "abc123base64data";

    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    const pasteBtn = await screen.findByTestId("button-paste-clipboard");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(screen.getByText("Replace")).toBeTruthy();
    });

    expect(Clipboard.getImageAsync).toHaveBeenCalledWith({ format: "png" });

    const img = screen.getByAltText("preview") as HTMLImageElement;
    expect(img.src).toContain("abc123base64data");
  });

  it("fills the preview when clipboard returns a data-URI (strips the prefix)", async () => {
    clipboardRef.hasImage = true;
    clipboardRef.imageData = "data:image/png;base64,XYZ789";

    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    const pasteBtn = await screen.findByTestId("button-paste-clipboard");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(screen.getByText("Replace")).toBeTruthy();
    });

    const img = screen.getByAltText("preview") as HTMLImageElement;
    expect(img.src).toContain("data:image/png;base64,XYZ789");
  });

  it("shows 'Read this screenshot' button after a successful paste", async () => {
    clipboardRef.hasImage = true;
    clipboardRef.imageData = "data:image/png;base64,VALID";

    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    const pasteBtn = await screen.findByTestId("button-paste-clipboard");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(screen.getByText("Read this screenshot")).toBeTruthy();
    });
  });

  it("shows an error when getImageAsync returns null", async () => {
    clipboardRef.hasImage = true;
    clipboardRef.imageData = null;

    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    const pasteBtn = await screen.findByTestId("button-paste-clipboard");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't read that image from the clipboard."),
      ).toBeTruthy();
    });
  });

  it("replaces a previously picked image when Paste is called after Replace", async () => {
    clipboardRef.hasImage = true;
    clipboardRef.imageData = "data:image/png;base64,FIRST";

    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    const pasteBtn = await screen.findByTestId("button-paste-clipboard");
    fireEvent.click(pasteBtn);

    await waitFor(() => expect(screen.getByText("Replace")).toBeTruthy());

    const replaceBtn = screen.getByText("Replace");
    fireEvent.click(replaceBtn);

    await waitFor(() => expect(screen.getByTestId("button-paste-clipboard")).toBeTruthy());

    clipboardRef.imageData = "data:image/png;base64,SECOND";
    fireEvent.click(screen.getByTestId("button-paste-clipboard"));

    await waitFor(() => {
      const img = screen.getByAltText("preview") as HTMLImageElement;
      expect(img.src).toContain("SECOND");
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Web paste event (window "paste" listener)
// ---------------------------------------------------------------------------

describe("Scan screen — window paste event (web path)", () => {
  it("fills the preview when an image is pasted via Ctrl+V / window paste event", async () => {
    const fakeBase64 = "R0lGODlhAQABAAAAACw=";
    const fakeDataUrl = `data:image/png;base64,${fakeBase64}`;

    vi.stubGlobal(
      "FileReader",
      class MockFileReader {
        result: string | null = null;
        onload: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        readAsDataURL(_blob: Blob) {
          const self = this;
          setTimeout(() => {
            self.result = fakeDataUrl;
            self.onload?.({});
          }, 0);
        }
      },
    );

    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    await screen.findByTestId("button-paste-clipboard");

    const fakeFile = new File(["(png)"], "screenshot.png", { type: "image/png" });
    const fakeItem = {
      kind: "file",
      type: "image/png",
      getAsFile: () => fakeFile,
    };
    const pasteEvent = new Event("paste", { bubbles: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { items: [fakeItem] },
      writable: false,
    });
    Object.defineProperty(pasteEvent, "target", {
      value: document.body,
      writable: false,
    });
    Object.defineProperty(pasteEvent, "preventDefault", {
      value: vi.fn(),
      writable: false,
    });

    await act(async () => {
      window.dispatchEvent(pasteEvent);
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => {
      expect(screen.getByText("Replace")).toBeTruthy();
    });

    const img = screen.getByAltText("preview") as HTMLImageElement;
    expect(img.src).toContain(fakeBase64);
  });

  it("does NOT intercept paste events targeting a text input", async () => {
    render(
      <Wrap>
        <ScanScreen />
      </Wrap>,
    );

    await screen.findByTestId("button-paste-clipboard");

    const inputEl = document.createElement("input");
    document.body.appendChild(inputEl);

    const fakeFile = new File(["(png)"], "screenshot.png", { type: "image/png" });
    const fakeItem = {
      kind: "file",
      type: "image/png",
      getAsFile: () => fakeFile,
    };
    const pasteEvent = new Event("paste", { bubbles: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { items: [fakeItem] },
      writable: false,
    });
    Object.defineProperty(pasteEvent, "target", {
      value: inputEl,
      writable: false,
    });

    window.dispatchEvent(pasteEvent);

    await new Promise((r) => setTimeout(r, 20));

    expect(screen.queryByText("Replace")).toBeNull();

    inputEl.remove();
  });
});
