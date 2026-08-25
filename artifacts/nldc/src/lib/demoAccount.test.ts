import { describe, expect, it } from "vitest";
import { isDemoAccountId } from "./demoAccount";

describe("demo account identity", () => {
  it("recognizes only the server-seeded development accounts", () => {
    expect(isDemoAccountId("dev-test-power")).toBe(true);
    expect(isDemoAccountId("dev-test-new")).toBe(true);
    expect(isDemoAccountId("member-123")).toBe(false);
    expect(isDemoAccountId(null)).toBe(false);
  });
});
