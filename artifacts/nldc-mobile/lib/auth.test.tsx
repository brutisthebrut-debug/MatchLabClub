import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, act, fireEvent } from "@testing-library/react";

const secureStore = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => secureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStore.delete(key);
  }),
}));

vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
}));

vi.mock("./signInPushToken", () => ({
  getSigningInDevicePushToken: vi.fn(async () => null),
}));

// auth.tsx pulls in ./auditTrashNotifications, which transitively imports
// expo-notifications -> expo -> ./ImportMetaRegistry. That import chain is
// unresolvable under vitest's jsdom env. We don't exercise push registration
// here, so stub it out to avoid loading the expo runtime.
vi.mock("./auditTrashNotifications", () => ({
  registerPushTokenWithServer: vi.fn(async () => {}),
  deregisterPushTokenFromServer: vi.fn(async () => {}),
}));

// Module-level variables controlling the useAuthRequest mock.
// The factory captures them by closure; they are initialised before any test runs.
let mockAuthRequest: { codeVerifier: string } | null = { codeVerifier: "v" };
let mockAuthResponse: Record<string, unknown> | null = null;
let mockPromptAsync = vi.fn();

vi.mock("expo-auth-session", () => ({
  Prompt: { Login: "login" },
  useAutoDiscovery: () => ({ issuer: "https://example.com" }),
  makeRedirectUri: () => "https://example.com/redirect",
  useAuthRequest: () => [mockAuthRequest, mockAuthResponse, mockPromptAsync],
}));

// Import AFTER mocks are registered.
import * as SecureStore from "expo-secure-store";
import {
  customFetch,
  setAuthTokenGetter,
  setUnauthorizedHandler,
  ApiError,
} from "@workspace/api-client-react";
import { AUTH_TOKEN_KEY, AuthProvider, useAuth } from "./auth";

// A small DOM consumer that mirrors the account screen's auth-driven UI
// (matching the testIDs the screen uses in artifacts/nldc-mobile/app/(tabs)/account.tsx).
function AccountAuthView() {
  const { user, isAuthenticated, isLoading, error } = useAuth();
  return (
    <div>
      {error ? <div data-testid="account-auth-error">{error}</div> : null}
      {isLoading ? (
        <div data-testid="account-auth-loading" />
      ) : isAuthenticated ? (
        <div data-testid="account-identity-card">{user?.email ?? ""}</div>
      ) : (
        <div data-testid="account-signin-card">Sign in to your account</div>
      )}
    </div>
  );
}

type FetchHandler = (
  url: string,
  init: RequestInit | undefined,
) => Promise<Response> | Response;

let fetchHandler: FetchHandler = () => {
  throw new Error("fetch handler not configured");
};

function setFetchHandler(handler: FetchHandler) {
  fetchHandler = handler;
}

beforeEach(() => {
  secureStore.clear();
  setAuthTokenGetter(null);
  setUnauthorizedHandler(null);
  // Reset controllable useAuthRequest mock state to safe defaults.
  mockAuthRequest = { codeVerifier: "v" };
  mockAuthResponse = null;
  mockPromptAsync = vi.fn();
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
    return await fetchHandler(url, init);
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("mobile session expiration UX", () => {
  it("shows the expired-session banner and clears the stored token when /api/auth/user returns 401", async () => {
    secureStore.set(AUTH_TOKEN_KEY, "stale-token");

    const authUserCalls: Array<{ url: string; auth: string | null }> = [];
    setFetchHandler((url, init) => {
      authUserCalls.push({
        url,
        auth:
          (init?.headers as Record<string, string> | undefined)?.["Authorization"] ??
          null,
      });
      if (url.endsWith("/api/auth/user")) {
        return jsonResponse(401, { message: "Unauthorized" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(
      <AuthProvider>
        <AccountAuthView />
      </AuthProvider>,
    );

    // The expired-session banner should appear, the sign-in card should be visible,
    // and the stored token should have been wiped from SecureStore.
    await waitFor(() => {
      expect(screen.getByTestId("account-auth-error").textContent).toBe(
        "Your session expired. Please sign in again.",
      );
    });
    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    expect(screen.queryByTestId("account-identity-card")).toBeNull();
    expect(await SecureStore.getItemAsync(AUTH_TOKEN_KEY)).toBeNull();
    // Confirm the stale token was attached to the probing /api/auth/user call.
    expect(authUserCalls[0]?.auth).toBe("Bearer stale-token");
  });

  it("shows the expired-session banner when an authenticated API call returns 401", async () => {
    // A "fresh" /api/auth/user call so the provider settles into authenticated state first.
    secureStore.set(AUTH_TOKEN_KEY, "live-token");
    setAuthTokenGetter(() => secureStore.get(AUTH_TOKEN_KEY) ?? null);

    setFetchHandler((url) => {
      if (url.endsWith("/api/auth/user")) {
        return jsonResponse(200, {
          user: {
            id: "u1",
            email: "user@example.com",
            firstName: "Pat",
            lastName: "Q",
            profileImageUrl: null,
          },
        });
      }
      if (url.endsWith("/api/audits")) {
        return jsonResponse(401, { message: "Unauthorized" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(
      <AuthProvider>
        <AccountAuthView />
      </AuthProvider>,
    );

    // First settle into authenticated state.
    await waitFor(() => {
      expect(screen.getByTestId("account-identity-card").textContent).toBe(
        "user@example.com",
      );
    });
    expect(screen.queryByTestId("account-auth-error")).toBeNull();

    // Now an authenticated API call returns 401. The shared custom-fetch
    // should invoke the unauthorized handler the AuthProvider registered.
    await act(async () => {
      await expect(customFetch("/api/audits")).rejects.toBeInstanceOf(ApiError);
    });

    await waitFor(() => {
      expect(screen.getByTestId("account-auth-error").textContent).toBe(
        "Your session expired. Please sign in again.",
      );
    });
    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    expect(screen.queryByTestId("account-identity-card")).toBeNull();
    expect(await SecureStore.getItemAsync(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("does NOT show the expired-session banner when a 401 comes from an anonymous (no auth header) request", async () => {
    // No token in SecureStore, no auth getter — this models an anonymous client.
    setFetchHandler((url) => {
      if (url.endsWith("/api/auth/user")) {
        // The provider should short-circuit before this is hit (no token), but
        // be defensive if it ever does call.
        return jsonResponse(200, { user: null });
      }
      if (url.endsWith("/api/anon-thing")) {
        return jsonResponse(401, { message: "Unauthorized" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(
      <AuthProvider>
        <AccountAuthView />
      </AuthProvider>,
    );

    // No token → provider settles into the unauthenticated sign-in state with NO error.
    await waitFor(() => {
      expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    });
    expect(screen.queryByTestId("account-auth-error")).toBeNull();

    // An anonymous 401 must NOT trigger the expired-session banner.
    await act(async () => {
      await expect(customFetch("/api/anon-thing")).rejects.toBeInstanceOf(ApiError);
    });

    // Wait a tick to make sure no async handler flips the state.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByTestId("account-auth-error")).toBeNull();
    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
  });

  it("also surfaces the expired-session banner when /api/auth/user returns 200 but user:null", async () => {
    // Task #85 also covers the soft-expired case where the server says "no user"
    // with a 200, so the test suite locks that down too.
    secureStore.set(AUTH_TOKEN_KEY, "soft-stale-token");

    setFetchHandler((url) => {
      if (url.endsWith("/api/auth/user")) {
        return jsonResponse(200, { user: null });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(
      <AuthProvider>
        <AccountAuthView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("account-auth-error").textContent).toBe(
        "Your session expired. Please sign in again.",
      );
    });
    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    expect(await SecureStore.getItemAsync(AUTH_TOKEN_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// A minimal consumer that exposes sign-in state for the failure-path tests.
// ---------------------------------------------------------------------------
function SignInView() {
  const { isSigningIn, error, login } = useAuth();
  return (
    <div>
      {error ? <div data-testid="signin-error">{error}</div> : null}
      {isSigningIn ? <div data-testid="signing-in" /> : null}
      <button data-testid="signin-btn" onClick={() => void login()} />
    </div>
  );
}

describe("mobile sign-in failure paths", () => {
  // All token-exchange tests need a domain so getApiBaseUrl() returns a value.
  beforeEach(() => {
    process.env["EXPO_PUBLIC_DOMAIN"] = "test.example.com";
    // No stored token → fetchUser short-circuits without hitting the network.
    setFetchHandler(() => {
      throw new Error("unexpected fetch — configure a handler per test");
    });
  });

  afterEach(() => {
    delete process.env["EXPO_PUBLIC_DOMAIN"];
  });

  // Helper: make promptAsync resolve as a successful OIDC redirect so that
  // login() sets isSigningIn=true and leaves it there — the response effect
  // (triggered by rerender below) is what drives the exchange and final reset.
  function setupPromptAsyncSuccess() {
    mockPromptAsync = vi.fn().mockResolvedValue({
      type: "success",
      params: { code: "prompt-code", state: "prompt-state" },
    });
  }

  // Helper: click sign-in, confirm isSigningIn flips to true, then inject the
  // OIDC response that triggers the token-exchange path.
  async function startSignInAndTriggerExchange(
    rerender: (ui: React.ReactElement) => void,
  ) {
    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });
    // isSigningIn should be true while the exchange is in-flight.
    await waitFor(() => {
      expect(screen.getByTestId("signing-in")).toBeTruthy();
    });
    // Inject the OIDC response and rerender to fire the response effect.
    mockAuthResponse = {
      type: "success",
      params: { code: "test-code", state: "test-state" },
    };
    rerender(
      <AuthProvider>
        <SignInView />
      </AuthProvider>,
    );
  }

  it("shows an error and resets isSigningIn when token-exchange returns a 4xx", async () => {
    setupPromptAsyncSuccess();
    setFetchHandler((url) => {
      if (url.includes("/api/mobile-auth/token-exchange")) {
        return jsonResponse(400, { message: "Bad request" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { rerender } = render(
      <AuthProvider>
        <SignInView />
      </AuthProvider>,
    );

    await startSignInAndTriggerExchange(rerender);

    await waitFor(() => {
      expect(screen.getByTestId("signin-error").textContent).toBe(
        "Couldn't complete sign-in (HTTP 400). Try again.",
      );
    });
    // isSigningIn must be reset to false after the failure.
    expect(screen.queryByTestId("signing-in")).toBeNull();
  });

  it("shows an error and resets isSigningIn when token-exchange returns a 5xx", async () => {
    setupPromptAsyncSuccess();
    setFetchHandler((url) => {
      if (url.includes("/api/mobile-auth/token-exchange")) {
        return jsonResponse(503, { message: "Service unavailable" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { rerender } = render(
      <AuthProvider>
        <SignInView />
      </AuthProvider>,
    );

    await startSignInAndTriggerExchange(rerender);

    await waitFor(() => {
      expect(screen.getByTestId("signin-error").textContent).toBe(
        "Couldn't complete sign-in (HTTP 503). Try again.",
      );
    });
    expect(screen.queryByTestId("signing-in")).toBeNull();
  });

  it("shows an error and resets isSigningIn when token-exchange returns no token", async () => {
    setupPromptAsyncSuccess();
    setFetchHandler((url) => {
      if (url.includes("/api/mobile-auth/token-exchange")) {
        return jsonResponse(200, {});
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { rerender } = render(
      <AuthProvider>
        <SignInView />
      </AuthProvider>,
    );

    await startSignInAndTriggerExchange(rerender);

    await waitFor(() => {
      expect(screen.getByTestId("signin-error").textContent).toBe(
        "Sign-in didn't return a session. Try again.",
      );
    });
    expect(screen.queryByTestId("signing-in")).toBeNull();
  });

  it("shows an error and resets isSigningIn when a network error is thrown during token-exchange", async () => {
    setupPromptAsyncSuccess();
    setFetchHandler((url) => {
      if (url.includes("/api/mobile-auth/token-exchange")) {
        throw new Error("Network request failed");
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { rerender } = render(
      <AuthProvider>
        <SignInView />
      </AuthProvider>,
    );

    await startSignInAndTriggerExchange(rerender);

    await waitFor(() => {
      expect(screen.getByTestId("signin-error").textContent).toBe(
        "Network request failed",
      );
    });
    expect(screen.queryByTestId("signing-in")).toBeNull();
  });

  it("shows an error immediately when login() is called before useAuthRequest is ready", async () => {
    // Null request simulates the hook not yet having initialised (e.g. OIDC
    // discovery still in flight).
    mockAuthRequest = null;

    render(
      <AuthProvider>
        <SignInView />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("signin-btn"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("signin-error").textContent).toBe(
        "Sign-in isn't ready yet. Try again in a moment.",
      );
    });
    // isSigningIn must never have been set — there is no pending flow.
    expect(screen.queryByTestId("signing-in")).toBeNull();
  });
});
