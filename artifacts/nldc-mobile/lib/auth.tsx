import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { setUnauthorizedHandler } from "@workspace/api-client-react";

WebBrowser.maybeCompleteAuthSession();

export const AUTH_TOKEN_KEY = "auth_session_token";
const ISSUER_URL =
  process.env.EXPO_PUBLIC_ISSUER_URL ?? "https://replit.com/oidc";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSigningIn: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isSigningIn: false,
  error: null,
  login: async () => {},
  logout: async () => {},
});

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

function getClientId(): string {
  return process.env.EXPO_PUBLIC_REPL_ID || "";
}

export async function getStoredAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({
  children,
  onAuthChange,
}: {
  children: ReactNode;
  onAuthChange?: () => void;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discovery = AuthSession.useAutoDiscovery(ISSUER_URL);
  const redirectUri = AuthSession.makeRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: getClientId(),
      scopes: ["openid", "email", "profile", "offline_access"],
      redirectUri,
      prompt: AuthSession.Prompt.Login,
    },
    discovery,
  );

  const sessionExpiredRef = useRef(false);

  const handleSessionExpired = useCallback(async () => {
    // Only surface the "session expired" message once per stale token.
    if (sessionExpiredRef.current) return;
    sessionExpiredRef.current = true;
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    } catch {
      // best-effort — always clear local state
    }
    setUser(null);
    setError("Your session expired. Please sign in again.");
    setIsLoading(false);
    onAuthChange?.();
  }, [onAuthChange]);

  const fetchUser = useCallback(async () => {
    try {
      const token = await getStoredAuthToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        await handleSessionExpired();
        return;
      }

      if (!res.ok) {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        setUser(null);
        return;
      }

      const data = (await res.json()) as { user: AuthUser | null };
      if (data.user) {
        // A successful authenticated call clears any prior expired state.
        sessionExpiredRef.current = false;
        setUser(data.user);
      } else {
        // Server says "no user" with a 200 — treat the token as stale and
        // surface the same expired message so the user knows to sign in again.
        await handleSessionExpired();
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    setUnauthorizedHandler(({ hadAuthToken }) => {
      // Ignore 401s on unauthenticated calls (e.g. anonymous endpoints) —
      // they don't mean the user's session expired.
      if (!hadAuthToken) return;
      void handleSessionExpired();
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [handleSessionExpired]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!response) return;

    if (response.type !== "success" || !request?.codeVerifier) {
      if (response.type === "error" || response.type === "cancel") {
        setIsSigningIn(false);
        if (response.type === "error") {
          setError(
            response.error?.message ?? "Couldn't complete sign-in. Try again.",
          );
        }
      }
      return;
    }

    const { code, state } = response.params;

    void (async () => {
      try {
        const apiBase = getApiBaseUrl();
        if (!apiBase) {
          setError("API base URL is not configured.");
          setIsSigningIn(false);
          return;
        }

        const exchangeRes = await fetch(
          `${apiBase}/api/mobile-auth/token-exchange`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              code_verifier: request.codeVerifier,
              redirect_uri: redirectUri,
              state,
            }),
          },
        );

        if (!exchangeRes.ok) {
          setError(
            `Couldn't complete sign-in (HTTP ${exchangeRes.status}). Try again.`,
          );
          setIsSigningIn(false);
          return;
        }

        const data = (await exchangeRes.json()) as { token?: string };
        if (data.token) {
          await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
          sessionExpiredRef.current = false;
          setError(null);
          setIsLoading(true);
          await fetchUser();
          onAuthChange?.();
        } else {
          setError("Sign-in didn't return a session. Try again.");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't complete sign-in. Try again.",
        );
      } finally {
        setIsSigningIn(false);
      }
    })();
  }, [response, request, redirectUri, fetchUser, onAuthChange]);

  const login = useCallback(async () => {
    setError(null);
    if (!request) {
      setError("Sign-in isn't ready yet. Try again in a moment.");
      return;
    }
    setIsSigningIn(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        setIsSigningIn(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't open sign-in. Try again.",
      );
      setIsSigningIn(false);
    }
  }, [promptAsync, request]);

  const logout = useCallback(async () => {
    try {
      const token = await getStoredAuthToken();
      if (token) {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // best-effort — always clear local state
    } finally {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      sessionExpiredRef.current = false;
      setUser(null);
      setError(null);
      onAuthChange?.();
    }
  }, [onAuthChange]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isSigningIn,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
