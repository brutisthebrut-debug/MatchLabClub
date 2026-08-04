import { afterEach, describe, expect, it } from "vitest";
import { normalizeIdentityClaims, roleForIdentity } from "./identityClaims";
const founderEmails = process.env.FOUNDER_EMAILS;
afterEach(() => { if (founderEmails === undefined) delete process.env.FOUNDER_EMAILS; else process.env.FOUNDER_EMAILS = founderEmails; });
describe("portable OIDC identity", () => {
  it("normalizes standard claims", () => {
    expect(normalizeIdentityClaims({
      sub: "provider|daniel", email: "daniel@example.com", email_verified: true,
      given_name: "Daniel", family_name: "Marlin", picture: "https://example.com/d.jpg",
    })).toEqual({
      id: "provider|daniel", email: "daniel@example.com", emailVerified: true,
      firstName: "Daniel", lastName: "Marlin", profileImageUrl: "https://example.com/d.jpg",
    });
  });
  it("requires a verified founder email", () => {
    process.env.FOUNDER_EMAILS = "daniel@example.com";
    expect(roleForIdentity({ email: "daniel@example.com", emailVerified: false })).toBe("member");
    expect(roleForIdentity({ email: "DANIEL@example.com", emailVerified: true })).toBe("founder");
  });
});
