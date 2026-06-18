import { beforeEach, describe, expect, it, vi } from "vitest";

// Controllable db mock so we can drive resolveCapForUser through the public
// checkAndIncrementDailyCap entry point (it returns the resolved capForUser).
const selectMock = vi.fn();
const executeMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    execute: (...args: unknown[]) => executeMock(...args),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
  usersTable: { id: "id", tier: "tier" },
  aiRequestMetricsTable: {},
  aiUsageCountersTable: {},
}));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Pin the founder-tunable caps so the test asserts the tier branch, not config.
vi.mock("./brainConfig", () => ({
  effectiveAiCaps: vi.fn(async () => ({ anon: 5, free: 30 })),
}));

function tierLookup(tier: string | null) {
  // Mirrors db.select({...}).from(...).where(...).limit(1) resolving to rows.
  return {
    from: () => ({
      where: () => ({
        limit: async () => (tier === undefined ? [] : [{ tier }]),
      }),
    }),
  };
}

describe("resolveCapForUser (via checkAndIncrementDailyCap)", () => {
  beforeEach(() => {
    selectMock.mockReset();
    executeMock.mockReset();
    // One increment succeeds; the cap value under test comes from the tier read,
    // which is computed before this runs, so the exact counts here do not matter.
    executeMock.mockResolvedValue({ rows: [{ call_count: 1, incremented: true }] });
  });

  it("gives anonymous callers the anon cap and never reads a tier", async () => {
    const { checkAndIncrementDailyCap } = await import("./aiService");
    const result = await checkAndIncrementDailyCap(null, "anthropic");
    expect(result.capForUser).toBe(5);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("gives a free-tier authed user the free cap", async () => {
    selectMock.mockReturnValue(tierLookup(null));
    const { checkAndIncrementDailyCap } = await import("./aiService");
    const result = await checkAndIncrementDailyCap("free-user", "anthropic");
    expect(result.capForUser).toBe(30);
  });

  it("raises the cap for a granted paid tier (reset)", async () => {
    selectMock.mockReturnValue(tierLookup("reset"));
    const { checkAndIncrementDailyCap } = await import("./aiService");
    const result = await checkAndIncrementDailyCap("reset-user", "anthropic");
    expect(result.capForUser).toBe(200);
  });

  it("raises the cap for a granted paid tier (wingman)", async () => {
    selectMock.mockReturnValue(tierLookup("wingman"));
    const { checkAndIncrementDailyCap } = await import("./aiService");
    const result = await checkAndIncrementDailyCap("wingman-user", "anthropic");
    expect(result.capForUser).toBe(200);
  });

  it("treats an explicit 'free' tier string as free, not paid", async () => {
    selectMock.mockReturnValue(tierLookup("free"));
    const { checkAndIncrementDailyCap } = await import("./aiService");
    const result = await checkAndIncrementDailyCap("free-string-user", "anthropic");
    expect(result.capForUser).toBe(30);
  });

  it("does not unlock the paid cap for an unknown/stale tier value", async () => {
    selectMock.mockReturnValue(tierLookup("cancelled"));
    const { checkAndIncrementDailyCap } = await import("./aiService");
    const result = await checkAndIncrementDailyCap("stale-tier-user", "anthropic");
    expect(result.capForUser).toBe(30);
  });

  it("fails open to the free cap when the tier read throws", async () => {
    selectMock.mockImplementation(() => {
      throw new Error("db down");
    });
    const { checkAndIncrementDailyCap } = await import("./aiService");
    const result = await checkAndIncrementDailyCap("err-user", "anthropic");
    expect(result.capForUser).toBe(30);
  });
});
