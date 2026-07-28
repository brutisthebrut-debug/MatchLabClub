import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";

const stripeMock = vi.hoisted(() => ({
  connected: true,
  checkoutCreate: vi.fn(),
  checkoutRetrieve: vi.fn(),
  portalCreate: vi.fn(),
}));

vi.mock("../lib/stripeClient", () => ({
  isStripeConnected: vi.fn(async () => stripeMock.connected),
  getUncachableStripeClient: vi.fn(async () => ({
    checkout: {
      sessions: {
        create: stripeMock.checkoutCreate,
        retrieve: stripeMock.checkoutRetrieve,
      },
    },
    billingPortal: { sessions: { create: stripeMock.portalCreate } },
  })),
}));

vi.mock("../lib/billingEntitlements", () => ({
  loadBillingState: vi.fn(async () => ({
    tier: "wingman",
    status: "active",
    active: true,
    source: "stripe",
    accessUntil: "2026-08-28T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    canManageBilling: true,
  })),
  latestStripeCustomerId: vi.fn(async () => "cus_member_1"),
}));

interface TestApp {
  app: Express;
  setAuthenticated: (value: boolean) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const billingRouter = (await import("./billing")).default;
  const app = express();
  app.use(express.json());
  let authenticated = true;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (authenticated) {
      req.user = {
        id: "member-1",
        email: "member@example.com",
        firstName: "Member",
        lastName: null,
        profileImageUrl: null,
      };
    }
    next();
  });
  app.use("/api", billingRouter);
  return { app, setAuthenticated: (value) => (authenticated = value) };
}

let testApp: TestApp;

beforeAll(async () => {
  testApp = await makeTestApp();
});

beforeEach(() => {
  testApp.setAuthenticated(true);
  stripeMock.connected = true;
  stripeMock.checkoutCreate.mockReset();
  stripeMock.checkoutRetrieve.mockReset();
  stripeMock.portalCreate.mockReset();
  stripeMock.checkoutCreate.mockResolvedValue({
    url: "https://checkout.stripe.test/session",
  });
  stripeMock.portalCreate.mockResolvedValue({
    url: "https://billing.stripe.test/session",
  });
});

describe("billing routes", () => {
  it("requires authentication for billing state and checkout", async () => {
    testApp.setAuthenticated(false);
    expect(
      (await request(testApp.app).get("/api/billing/entitlement")).status,
    ).toBe(401);
    expect(
      (
        await request(testApp.app)
          .post("/api/billing/checkout")
          .send({ product: "wingman" })
      ).status,
    ).toBe(401);
  });

  it("creates a signed-in Wingman subscription checkout with attribution", async () => {
    process.env["STRIPE_PRICE_WINGMAN"] = "price_wingman";
    const res = await request(testApp.app)
      .post("/api/billing/checkout")
      .set("Host", "app.matchlab.club")
      .set("X-Forwarded-Proto", "https")
      .send({ product: "wingman" });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://checkout.stripe.test/session");
    expect(stripeMock.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        client_reference_id: "member-1",
        customer: "cus_member_1",
        metadata: { product: "wingman", userId: "member-1" },
        subscription_data: {
          metadata: { product: "wingman", userId: "member-1" },
        },
        success_url:
          "https://app.matchlab.club/checkout/success?product=wingman&session_id={CHECKOUT_SESSION_ID}",
      }),
    );
  });

  it("fails closed when the requested Stripe price is not configured", async () => {
    delete process.env["STRIPE_PRICE_DATING_RESET"];
    const res = await request(testApp.app)
      .post("/api/billing/checkout")
      .send({ product: "dating-reset" });
    expect(res.status).toBe(503);
    expect(stripeMock.checkoutCreate).not.toHaveBeenCalled();
  });

  it("opens Stripe's customer portal for self-service cancellation", async () => {
    const res = await request(testApp.app)
      .post("/api/billing/portal")
      .set("Host", "app.matchlab.club")
      .set("X-Forwarded-Proto", "https");
    expect(res.status).toBe(200);
    expect(stripeMock.portalCreate).toHaveBeenCalledWith({
      customer: "cus_member_1",
      return_url: "https://app.matchlab.club/account",
    });
  });

  it("confirms checkout from Stripe only for the owning account", async () => {
    stripeMock.checkoutRetrieve.mockResolvedValue({
      payment_status: "paid",
      client_reference_id: "member-1",
      metadata: { product: "dating-reset", userId: "member-1" },
    });
    const owned = await request(testApp.app).get(
      "/api/billing/checkout-session/cs_test_owned1",
    );
    expect(owned.status).toBe(200);
    expect(owned.body).toEqual({
      confirmed: true,
      paymentStatus: "paid",
      product: "dating-reset",
    });

    stripeMock.checkoutRetrieve.mockResolvedValue({
      payment_status: "paid",
      client_reference_id: "someone-else",
      metadata: { product: "dating-reset", userId: "someone-else" },
    });
    const foreign = await request(testApp.app).get(
      "/api/billing/checkout-session/cs_test_foreign1",
    );
    expect(foreign.status).toBe(404);
  });
});
