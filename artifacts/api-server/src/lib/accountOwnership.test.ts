import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import * as schema from "@workspace/db/schema";
import {
  ACCOUNT_DELETE_USER_ID_TABLES,
  ACCOUNT_EXPORT_DIRECT_USER_ID_TABLES,
  ACCOUNT_EXPORT_REDACTED_USER_ID_TABLES,
  ACCOUNT_EXPORT_SPECIAL_USER_ID_TABLES,
} from "./accountOwnership";

describe("account ownership inventory", () => {
  it("registers every schema table with a user_id column for deletion", () => {
    const schemaTables = Object.values(schema)
      .filter((value) => is(value, Table))
      .filter((table) => "userId" in getTableColumns(table))
      .map((table) => getTableName(table))
      .sort();

    expect([...ACCOUNT_DELETE_USER_ID_TABLES].sort()).toEqual(schemaTables);
  });

  it("classifies every user_id table for direct, special, or redacted export", () => {
    const classified = [
      ...ACCOUNT_EXPORT_DIRECT_USER_ID_TABLES,
      ...ACCOUNT_EXPORT_SPECIAL_USER_ID_TABLES,
      ...ACCOUNT_EXPORT_REDACTED_USER_ID_TABLES,
    ].sort();

    expect(classified).toEqual([...ACCOUNT_DELETE_USER_ID_TABLES].sort());
    expect(new Set(classified).size).toBe(classified.length);
  });
});
