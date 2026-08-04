export interface PortableIdentity {
  id: string; email: string | null; emailVerified: boolean;
  firstName: string | null; lastName: string | null; profileImageUrl: string | null;
}
function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
export function normalizeIdentityClaims(claims: Record<string, unknown>): PortableIdentity {
  const id = optionalString(claims.sub);
  if (!id) throw new Error("OIDC identity is missing a subject");
  return {
    id, email: optionalString(claims.email), emailVerified: claims.email_verified === true,
    firstName: optionalString(claims.given_name) ?? optionalString(claims.first_name),
    lastName: optionalString(claims.family_name) ?? optionalString(claims.last_name),
    profileImageUrl: optionalString(claims.picture) ?? optionalString(claims.profile_image_url),
  };
}
export function roleForIdentity(identity: Pick<PortableIdentity, "email" | "emailVerified">): "member" | "founder" {
  if (!identity.email || !identity.emailVerified) return "member";
  const founders = new Set((process.env.FOUNDER_EMAILS ?? "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean));
  return founders.has(identity.email.toLowerCase()) ? "founder" : "member";
}
