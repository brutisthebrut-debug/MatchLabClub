import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A member's real profile photos. We store only the object storage path (the
// normalized `/objects/...` key), never the bytes; the image is served back
// through the storage route. Ordinal drives display order, lowest first, so the
// first photo is the lead. Photos are consent-gated for reveal: they are only
// shared with a counterpart through the reveal card once the member turns on
// reveal consent (match_pool_membership.reveal_consent).
//
// As with the other matching tables, user_id has NO foreign key to users.id;
// account deletion wipes these rows explicitly in the GDPR delete handler
// (artifacts/api-server/src/routes/account.ts), along with the stored objects.

export const MAX_PROFILE_PHOTOS = 6;

export const profilePhotosTable = pgTable(
  "profile_photos",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    // Normalized object path, e.g. "/objects/uploads/<uuid>". Served via the
    // storage route, never returned as a raw GCS URL.
    objectPath: varchar("object_path").notNull(),
    ordinal: integer("ordinal").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("profile_photos_user_idx").on(t.userId, t.ordinal)],
);

export const insertProfilePhotoSchema = createInsertSchema(profilePhotosTable, {
  objectPath: z.string().trim().min(1).max(512),
  ordinal: z.number().int().min(0).max(MAX_PROFILE_PHOTOS).nullish(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type ProfilePhoto = typeof profilePhotosTable.$inferSelect;
export type InsertProfilePhoto = z.infer<typeof insertProfilePhotoSchema>;
