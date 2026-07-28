import { afterEach, describe, expect, it } from "vitest";
import { deriveAppSecret } from "./appSecrets";
const appSecret = process.env.APP_SECRET, nodeEnv = process.env.NODE_ENV;
afterEach(() => {
  if (appSecret === undefined) delete process.env.APP_SECRET; else process.env.APP_SECRET = appSecret;
  if (nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = nodeEnv;
});
describe("deriveAppSecret", () => {
  it("domain-separates one root secret", () => {
    process.env.APP_SECRET = "portable-root-secret";
    const values = [deriveAppSecret("anonymous-handoff"), deriveAppSecret("wingman-invite"), deriveAppSecret("receipts-webhook")];
    expect(new Set(values).size).toBe(3); expect(values.every(v => v.length === 64)).toBe(true);
  });
  it("requires APP_SECRET in production", () => {
    delete process.env.APP_SECRET; process.env.NODE_ENV = "production";
    expect(() => deriveAppSecret("anonymous-handoff")).toThrow("APP_SECRET is required in production");
  });
});
