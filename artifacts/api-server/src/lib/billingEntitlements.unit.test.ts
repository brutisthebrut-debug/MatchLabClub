import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", async () => await import("./testDb"));

import { inferProduct } from "./billingEntitlements";

const originalPrice = process.env["STRIPE_PRICE_WINGMAN"];

afterEach(() => {
  if (originalPrice === undefined) delete process.env["STRIPE_PRICE_WINGMAN"];
  else process.env["STRIPE_PRICE_WINGMAN"] = originalPrice;
});

describe("billing product authority", () => {
  it("accepts only canonical server products from metadata", () => {
    expect(inferProduct({ product: "dating-reset" })).toBe("dating-reset");
    expect(inferProduct({ product: "admin" })).toBeNull();
    expect(inferProduct(null)).toBeNull();
  });

  it("maps only configured server-side Stripe price ids", () => {
    process.env["STRIPE_PRICE_WINGMAN"] = "price_wingman_authoritative";
    expect(inferProduct(null, "price_wingman_authoritative")).toBe("wingman");
    expect(inferProduct(null, "price_forged_client_value")).toBeNull();
  });
});
