import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  profilePhotosTable,
  MAX_PROFILE_PHOTOS,
  type ProfilePhoto,
} from "@workspace/db";
import { z } from "zod/v4";
import { ObjectStorageService } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Build the relative serving URL for a stored object path. The stored path is
// already normalized to "/objects/<id>"; the storage route serves it under
// "/storage/objects/<id>". Returned relative so the proxy base path applies.
function servingUrl(objectPath: string): string {
  const id = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath.replace(/^\/+/, "");
  return `storage/objects/${id}`;
}

function serialize(photo: ProfilePhoto) {
  return {
    id: photo.id,
    url: servingUrl(photo.objectPath),
    ordinal: photo.ordinal,
    createdAt:
      photo.createdAt instanceof Date
        ? photo.createdAt.toISOString()
        : String(photo.createdAt),
  };
}

async function listForUser(userId: string): Promise<ProfilePhoto[]> {
  return db
    .select()
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, userId))
    .orderBy(asc(profilePhotosTable.ordinal), asc(profilePhotosTable.id));
}

// GET /me/photos — the member's photos, lead first.
router.get("/me/photos", async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await listForUser(req.user.id);
  res.json(rows.map(serialize));
});

const AddPhotoBody = z.object({ uploadURL: z.string().trim().min(1).max(2048) });

// POST /me/photos — record a photo after it was uploaded to the presigned URL.
// We normalize the upload URL to the "/objects/..." path, set an ACL owned by
// the member (private by default; reads go through the storage route), and
// append it to the end of the order.
router.post("/me/photos", async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const parsed = AddPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await listForUser(userId);
  if (existing.length >= MAX_PROFILE_PHOTOS) {
    res
      .status(409)
      .json({ error: `You can have at most ${MAX_PROFILE_PHOTOS} photos.` });
    return;
  }

  let objectPath: string;
  try {
    objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
      parsed.data.uploadURL,
      { owner: userId, visibility: "private" },
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to set photo ACL");
    res.status(400).json({ error: "Could not record that upload." });
    return;
  }

  const nextOrdinal =
    existing.length > 0
      ? Math.max(...existing.map((p) => p.ordinal)) + 1
      : 0;
  const [row] = await db
    .insert(profilePhotosTable)
    .values({ userId, objectPath, ordinal: nextOrdinal })
    .returning();
  req.log.info({ photoId: row?.id }, "profile photo added");
  res.status(201).json(serialize(row!));
});

// DELETE /me/photos/:id — permanently remove one of the member's photos.
// Delete the object first and the row second. If storage fails the row stays
// visible and the member can retry. Object deletion ignores a missing object,
// so a retry also repairs the inverse partial failure (object gone, row left).
router.delete(
  "/me/photos/:id",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    const [photo] = await db
      .select({ objectPath: profilePhotosTable.objectPath })
      .from(profilePhotosTable)
      .where(
        and(
          eq(profilePhotosTable.id, id),
          eq(profilePhotosTable.userId, userId),
        ),
      )
      .limit(1);
    if (!photo) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    try {
      await objectStorageService.deleteObjectEntity(photo.objectPath);
    } catch (error) {
      req.log.error({ err: error, photoId: id }, "Failed to delete photo object");
      res.status(503).json({
        error: "We couldn't delete that photo yet. Nothing was removed; please retry.",
      });
      return;
    }

    await db
      .delete(profilePhotosTable)
      .where(
        and(
          eq(profilePhotosTable.id, id),
          eq(profilePhotosTable.userId, userId),
        ),
      );
    const rows = await listForUser(userId);
    req.log.info({ photoId: id }, "profile photo object and row deleted");
    res.json(rows.map(serialize));
  },
);

const ReorderBody = z.object({
  orderedIds: z.array(z.number().int()).max(MAX_PROFILE_PHOTOS),
});

// PUT /me/photos/reorder — set the display order from a full list of ids.
// Ids the member does not own are ignored; any photo not listed keeps its
// relative order after the listed ones.
router.put(
  "/me/photos/reorder",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userId = req.user.id;
    const parsed = ReorderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await listForUser(userId);
    const owned = new Set(existing.map((p) => p.id));
    const ordered = parsed.data.orderedIds.filter((id) => owned.has(id));
    const trailing = existing
      .map((p) => p.id)
      .filter((id) => !ordered.includes(id));
    const finalOrder = [...ordered, ...trailing];
    await db.transaction(async (tx) => {
      for (let i = 0; i < finalOrder.length; i++) {
        await tx
          .update(profilePhotosTable)
          .set({ ordinal: i })
          .where(
            and(
              eq(profilePhotosTable.id, finalOrder[i]!),
              eq(profilePhotosTable.userId, userId),
            ),
          );
      }
    });
    const rows = await listForUser(userId);
    res.json(rows.map(serialize));
  },
);

export default router;
