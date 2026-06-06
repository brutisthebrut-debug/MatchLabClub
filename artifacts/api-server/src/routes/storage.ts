import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { and, eq } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import {
  db,
  profilePhotosTable,
  matchConnectionsTable,
  matchPoolMembershipTable,
  orderConnectionPair,
} from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// A stored profile photo is readable by its owner, and by a counterpart who is
// in an active connection with the owner once the owner turned reveal consent
// on. This mirrors the reveal-card gate in routes/connections.ts so a private
// photo never leaks by path knowledge, while a consented match can still load
// the photos surfaced on the reveal card.
async function canViewStoredObject(
  viewerId: string,
  objectPath: string,
): Promise<boolean> {
  const [photo] = await db
    .select({ ownerId: profilePhotosTable.userId })
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.objectPath, objectPath))
    .limit(1);
  if (!photo) {
    return false;
  }
  if (photo.ownerId === viewerId) {
    return true;
  }
  const pair = orderConnectionPair(viewerId, photo.ownerId);
  const [connection] = await db
    .select({ id: matchConnectionsTable.id })
    .from(matchConnectionsTable)
    .where(
      and(
        eq(matchConnectionsTable.userLowId, pair.userLowId),
        eq(matchConnectionsTable.userHighId, pair.userHighId),
        eq(matchConnectionsTable.status, "active"),
      ),
    )
    .limit(1);
  if (!connection) {
    return false;
  }
  const [membership] = await db
    .select({ revealConsent: matchPoolMembershipTable.revealConsent })
    .from(matchPoolMembershipTable)
    .where(eq(matchPoolMembershipTable.userId, photo.ownerId))
    .limit(1);
  return membership?.revealConsent === true;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // Authorize before streaming. The object ACL covers owner and any explicit
    // grants; the profile-photo reveal gate covers a consented match viewing the
    // counterpart's photos. Either path grants read; otherwise the object is
    // private and we refuse, so private photos never leak by path knowledge.
    const aclAllows = await objectStorageService.canAccessObjectEntity({
      userId: viewerId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!aclAllows && !(await canViewStoredObject(viewerId, objectPath))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
