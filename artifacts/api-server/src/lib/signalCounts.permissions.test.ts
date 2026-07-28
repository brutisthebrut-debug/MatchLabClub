import crypto from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool, wellnessAnswersTable } from "@workspace/db";
import { collectSignalCounts } from "./signalCounts";

const USER = `signal-permissions-${crypto.randomBytes(6).toString("hex")}`;

afterAll(async () => {
  await db
    .delete(wellnessAnswersTable)
    .where(eq(wellnessAnswersTable.userId, USER));
  await pool.end();
});

describe("matching signal permission boundary", () => {
  it("counts only live wellness dimensions explicitly approved for matching", async () => {
    await db.insert(wellnessAnswersTable).values([
      {
        userId: USER,
        questionId: "values.approved",
        dimension: "values",
        questionText: "What matters?",
        answer: "Candor and care.",
        mirrorConfirmed: true,
        matchingUseApproved: true,
      },
      {
        userId: USER,
        questionId: "communication.saved_only",
        dimension: "communication",
        questionText: "How do you communicate?",
        answer: "Directly.",
        matchingUseApproved: false,
      },
      {
        userId: USER,
        questionId: "conflict.deleted",
        dimension: "conflict",
        questionText: "How do you repair?",
        answer: "I come back to the conversation.",
        mirrorConfirmed: true,
        matchingUseApproved: true,
        deletedAt: new Date(),
      },
    ]);

    const counts = await collectSignalCounts(USER);
    expect(counts.wellnessDistinct).toBe(1);
  });
});
