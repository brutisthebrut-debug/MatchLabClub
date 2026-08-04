import * as client from "openid-client";
import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for authentication`);
  return value;
}
export function getIssuerUrl(): string { return requiredEnv("OIDC_ISSUER_URL"); }
export function getWebClientId(): string { return requiredEnv("OIDC_WEB_CLIENT_ID"); }
export function getMobileClientId(): string {
  return process.env.OIDC_MOBILE_CLIENT_ID?.trim() || getWebClientId();
}
export interface SessionData {
  user: AuthUser; access_token: string; refresh_token?: string;
  expires_at?: number; client_id?: string;
}
const oidcConfigs = new Map<string, client.Configuration>();
export async function getOidcConfig(clientId: string = getWebClientId()): Promise<client.Configuration> {
  const cached = oidcConfigs.get(clientId);
  if (cached) return cached;
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim();
  const config = await client.discovery(
    new URL(getIssuerUrl()), clientId,
    clientSecret ? { client_secret: clientSecret } : undefined,
  );
  oidcConfigs.set(clientId, config);
  return config;
}
export interface SessionMetadata {
  userAgent?: string | null; ip?: string | null; channel?: "web" | "mobile";
}
export async function createSession(data: SessionData, metadata: SessionMetadata = {}): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex"); const now = new Date();
  await db.insert(sessionsTable).values({
    sid, sess: data as unknown as Record<string, unknown>,
    expire: new Date(now.getTime() + SESSION_TTL), userId: data.user.id,
    createdAt: now, lastSeenAt: now, userAgent: metadata.userAgent ?? null,
    ip: metadata.ip ?? null, channel: metadata.channel ?? null,
  }); return sid;
}
const LAST_SEEN_THROTTLE_MS = 60 * 1000;
export async function touchSession(sid: string): Promise<void> {
  await db.update(sessionsTable).set({ lastSeenAt: new Date() }).where(eq(sessionsTable.sid, sid));
}
export function shouldTouchSession(lastSeenAt: Date | null | undefined): boolean {
  return !lastSeenAt || Date.now() - lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;
}
export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid));
  if (!row || row.expire < new Date()) { if (row) await deleteSession(sid); return null; }
  return row.sess as unknown as SessionData;
}
export async function updateSession(sid: string, data: SessionData): Promise<void> {
  await db.update(sessionsTable).set({
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  }).where(eq(sessionsTable.sid, sid));
}
export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}
export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid); res.clearCookie(SESSION_COOKIE, { path: "/" });
}
export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.[SESSION_COOKIE];
}
