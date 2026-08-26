import { describe, expect, it } from "vitest";
import {
  resolveMatchListReadState,
  resolveMatchThreadReadState,
} from "./matchLifecycleReadState";

describe("resolveMatchListReadState", () => {
  it("keeps signed-out samples separate from account state", () => {
    expect(resolveMatchListReadState({
      isAuthenticated: false,
      isLoading: false,
      isError: true,
      connectionCount: 0,
    })).toBe("demo");
  });

  it("never turns an authenticated read failure into an empty list", () => {
    expect(resolveMatchListReadState({
      isAuthenticated: true,
      isLoading: false,
      isError: true,
      connectionCount: 0,
    })).toBe("error");
  });

  it("returns empty only after a successful authenticated read", () => {
    expect(resolveMatchListReadState({
      isAuthenticated: true,
      isLoading: false,
      isError: false,
      connectionCount: 0,
    })).toBe("empty");
  });
});

describe("resolveMatchThreadReadState", () => {
  it("never turns an authenticated read failure into not found", () => {
    expect(resolveMatchThreadReadState({
      isAuthenticated: true,
      isLoading: false,
      isError: true,
      hasConnection: false,
    })).toBe("error");
  });

  it("returns not found only after a successful authenticated read", () => {
    expect(resolveMatchThreadReadState({
      isAuthenticated: true,
      isLoading: false,
      isError: false,
      hasConnection: false,
    })).toBe("not-found");
  });
});
