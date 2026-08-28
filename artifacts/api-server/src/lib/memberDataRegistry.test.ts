import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import * as schema from "@workspace/db/schema";
import {
  MEMBER_DATA_REGISTRY,
  MEMBER_DATA_TABLE_NAMES,
} from "./memberDataRegistry";

const MEMBER_OWNER_COLUMNS = new Set([
  "user_id",
  "inviter_user_id",
  "invitee_user_id",
  "proposed_to_user_id",
  "user_low_id",
  "user_high_id",
  "sender_user_id",
  "reporter_user_id",
  "reported_user_id",
  "blocker_user_id",
  "blocked_user_id",
]);

describe("member data registry", () => {
  it("has one explicit disposition per registered table", () => {
    expect(new Set(MEMBER_DATA_TABLE_NAMES).size).toBe(
      MEMBER_DATA_TABLE_NAMES.length,
    );
    for (const entry of MEMBER_DATA_REGISTRY) {
      expect(entry.export).toMatch(
        /^(current-contract|sanitized|omit-security-secret)$/,
      );
      expect(entry.retention).toMatch(
        /^(account-lifetime|short-lived-security)$/,
      );
      expect(entry.consent).toMatch(/^(member-record|ai-derived)$/);
    }
  });

  it("rejects schema drift for every directly user-linked table", () => {
    const discovered = new Set<string>();

    for (const value of Object.values(schema)) {
      try {
        const tableName = getTableName(value as never);
        const columns = Object.values(getTableColumns(value as never));
        if (columns.some((column) => MEMBER_OWNER_COLUMNS.has(column.name))) {
          discovered.add(tableName);
        }
      } catch {
        // The schema barrel also exports enums and helpers.
      }
    }

    const registered = new Set(MEMBER_DATA_TABLE_NAMES);
    expect([...discovered].filter((name) => !registered.has(name))).toEqual([]);
    expect(registered.has("journey_experiments")).toBe(true);
    expect(registered.has("mirror_learnings")).toBe(true);
    expect(registered.has("billing_entitlements")).toBe(true);
  });
});
