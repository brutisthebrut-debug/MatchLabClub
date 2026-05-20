import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";
import {
  RegisterPushTokenBody,
  RegisterPushTokenResponse,
  UnregisterPushTokenResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/push-tokens", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = RegisterPushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token } = parsed.data;
  const userId = req.user.id;

  // Upsert: if this device token was previously registered to another account
  // (e.g. a different user logged in on the same device), reassign it so the
  // old owner stops receiving notifications on this device.
  await db
    .insert(pushTokensTable)
    .values({ userId, token })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId },
    });

  res.json(RegisterPushTokenResponse.parse({ success: true }));
});

router.delete("/push-tokens", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const rawToken =
    typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!rawToken) {
    res.status(400).json({ error: "token query parameter is required" });
    return;
  }

  const userId = req.user.id;

  // Token is globally unique; verify ownership before deleting to prevent
  // cross-user deletions.
  await db
    .delete(pushTokensTable)
    .where(and(eq(pushTokensTable.token, rawToken), eq(pushTokensTable.userId, userId)));

  res.json(UnregisterPushTokenResponse.parse({ success: true }));
});

export default router;
