import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";

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

vi.mock("expo-auth-session", () => ({
  Prompt: { Login: "login" },
  useAutoDiscovery: () => ({ issuer: "https://example.com" }),
  makeRedirectUri: () => "https://example.com/redirect",
  useAuthRequest: () => [{ codeVerifier: "v" }, null, vi.fn()],
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
