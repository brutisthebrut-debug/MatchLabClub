import { describe, expect, it } from "vitest";
import {
  resolveMatchListReadState,
  resolveMatchMessagesReadState,
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


describe("resolveMatchMessagesReadState", () => {
  it("never turns an authenticated message failure into an empty thread", () => {
    expect(resolveMatchMessagesReadState({
      isLoading: false,
      isError: true,
      hasData: false,
      messageCount: 0,
    })).toBe("error");
  });

  it("keeps previously loaded messages visible but marks the read stale", () => {
    expect(resolveMatchMessagesReadState({
      isLoading: false,
      isError: true,
      hasData: true,
      messageCount: 2,
    })).toBe("stale");
  });

  it("returns empty only after a successful account read", () => {
    expect(resolveMatchMessagesReadState({
      isLoading: false,
      isError: false,
      hasData: true,
      messageCount: 0,
    })).toBe("empty");
  });
});
