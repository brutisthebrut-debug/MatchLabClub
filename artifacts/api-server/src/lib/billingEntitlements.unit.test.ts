import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", async () => await import("./testDb"));

import { inferProduct, isBillingProductLive } from "./billingEntitlements";

const originalPrice = process.env["STRIPE_PRICE_WINGMAN"];
const originalLiveProducts = process.env["BILLING_LIVE_PRODUCTS"];

afterEach(() => {
  if (originalPrice === undefined) delete process.env["STRIPE_PRICE_WINGMAN"];
  else process.env["STRIPE_PRICE_WINGMAN"] = originalPrice;
  if (originalLiveProducts === undefined) delete process.env["BILLING_LIVE_PRODUCTS"];
  else process.env["BILLING_LIVE_PRODUCTS"] = originalLiveProducts;
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

  it("keeps paid products closed until each one is explicitly activated", () => {
    delete process.env["BILLING_LIVE_PRODUCTS"];
    expect(isBillingProductLive("signal-audit")).toBe(false);
    process.env["BILLING_LIVE_PRODUCTS"] = "signal-audit, wingman";
    expect(isBillingProductLive("signal-audit")).toBe(true);
    expect(isBillingProductLive("dating-reset")).toBe(false);
    expect(isBillingProductLive("wingman")).toBe(true);
  });
});
