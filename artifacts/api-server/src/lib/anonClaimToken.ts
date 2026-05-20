import crypto from "crypto";
import type { Request, Response } from "express";

export const ANON_CLAIM_COOKIE = "anon_claim";
const ANON_CLAIM_TTL = 30 * 24 * 60 * 60 * 1000;

function setCookie(res: Response, value: string): void {
  res.cookie(ANON_CLAIM_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ANON_CLAIM_TTL,
  });
}

export function getAnonClaimToken(req: Request): string | undefined {
  const raw = req.cookies?.[ANON_CLAIM_COOKIE];
  if (typeof raw !== "string") return undefined;
  return /^[a-f0-9]{32,128}$/.test(raw) ? raw : undefined;
}

export function getOrCreateAnonClaimToken(req: Request, res: Response): string {
  const existing = getAnonClaimToken(req);
  if (existing) return existing;
  const token = crypto.randomBytes(32).toString("hex");
  setCookie(res, token);
  return token;
}

export function clearAnonClaimToken(res: Response): void {
  res.clearCookie(ANON_CLAIM_COOKIE, { path: "/" });
}
