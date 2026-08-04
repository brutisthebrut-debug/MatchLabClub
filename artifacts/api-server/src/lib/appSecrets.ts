import crypto from "crypto";
export type AppSecretPurpose = "anonymous-handoff" | "wingman-invite" | "receipts-webhook";
function rootSecret(): string {
  const value = process.env.APP_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET is required in production");
  return "matchlab-development-secret-not-for-production";
}
export function deriveAppSecret(purpose: AppSecretPurpose): string {
  return crypto.createHmac("sha256", rootSecret()).update(`matchlab:${purpose}:v1`).digest("hex");
}
