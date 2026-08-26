import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { execute: mocks.execute },
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings.join("?"),
    values,
  }),
}));

import { loadActivityDays } from "./activityDays";

describe("loadActivityDays consent boundaries", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue({ rows: [] });
  });

  it("only lets explicitly approved sources feed consistency readiness", async () => {
    await loadActivityDays("member-1", "2026-08-01");

    const query = mocks.execute.mock.calls[0]?.[0] as
      | { text?: string }
      | undefined;
    expect(query?.text).toContain(
      "FROM wyr_answers WHERE user_id = ? AND matching_use_allowed = true",
    );
    expect(query?.text).toContain(
      "FROM imported_sources WHERE user_id = ? AND matching_use_allowed = true AND deleted_at IS NULL",
    );
    expect(query?.text).toContain(
      "FROM scenario_responses WHERE user_id = ? AND matching_use_allowed = true",
    );
    expect(query?.text).toContain(
      "FROM prediction_responses WHERE user_id = ? AND matching_use_allowed = true",
    );
  });
});
