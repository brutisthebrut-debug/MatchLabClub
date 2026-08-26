export type MatchListReadState = "demo" | "loading" | "error" | "empty" | "ready";
export type MatchThreadReadState = "demo" | "loading" | "error" | "not-found" | "ready";

export function resolveMatchListReadState(input: {
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  connectionCount: number;
}): MatchListReadState {
  if (!input.isAuthenticated) return "demo";
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  return input.connectionCount === 0 ? "empty" : "ready";
}

export function resolveMatchThreadReadState(input: {
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  hasConnection: boolean;
}): MatchThreadReadState {
  if (!input.isAuthenticated) return "demo";
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  return input.hasConnection ? "ready" : "not-found";
}
