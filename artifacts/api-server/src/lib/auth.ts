import * as client from "openid-client";
import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";
import {
  getOidcClientId,
  getOidcIssuerUrl,
} from "./runtimeConfig";

export const ISSUER_URL = process.env.ISSUER_URL;
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export interface SessionData {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

let oidcConfig: client.Configuration | null = null;

export async function getOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfig) {
    oidcConfig = await client.discovery(
      new URL(getOidcIssuerUrl()),
      getOidcClientId(),
    );
  }
  return oidcConfig;
}

export interface SessionMetadata {
  userAgent?: string | null;
  ip?: string | null;
  channel?: "web" | "mobile";
}

export async function createSession(
  data: SessionData,
  metadata: SessionMetadata = {},
): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(now.getTime() + SESSION_TTL),
    userId: data.user.id,
    createdAt: now,
    lastSeenAt: now,
    userAgent: metadata.userAgent ?? null,
    ip: metadata.ip ?? null,
    channel: metadata.channel ?? null,
  });
  return sid;
}

const LAST_SEEN_THROTTLE_MS = 60 * 1000;

export async function touchSession(sid: string): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessionsTable.sid, sid));
}

export function shouldTouchSession(
  lastSeenAt: Date | null | undefined,
): boolean {
  if (!lastSeenAt) return true;
  return Date.now() - lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(
  res: Response,
  sid?: string,
): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
