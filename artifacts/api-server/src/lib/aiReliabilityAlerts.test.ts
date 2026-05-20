import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(async () => ({
    delivered: true,
    transport: "log" as const,
  })),
}));

vi.mock("./mailer", () => ({
  sendMail: sendMailMock,
}));

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  db,
  pool,
  aiRequestMetricsTable,
  aiToolAlertStateTable,
} from "@workspace/db";
import {
  ALERT_MIN_SAMPLE,
  ALERT_WINDOW,
  checkAiReliabilityAlerts,
} from "./aiReliabilityAlerts";

const usedToolNames: string[] = [];

function uniqueTool(label: string): string {
  const name = `test-tool-${label}-${crypto.randomBytes(6).toString("hex")}`;
  usedToolNames.push(name);
  return name;
}

interface SeedOptions {
  total: number;
  firstTryOk: number;
}

async function seedMetrics(
  toolName: string,
  { total, firstTryOk }: SeedOptions,
): Promise<void> {
  const rows = Array.from({ length: total }, (_, i) => ({
    toolName,
    mode: "live",
    attempts: i < firstTryOk ? 1 : 2,
    isFallback: false,
    validated: true,
    durationMs: 100,
  }));
  if (rows.length === 0) return;
  await db.insert(aiRequestMetricsTable).values(rows);
}

beforeAll(() => {
  process.env.FOUNDER_ALERT_EMAIL = "founder@example.com";
});

beforeEach(() => {
  sendMailMock.mockClear();
});

afterEach(async () => {
  if (usedToolNames.length === 0) return;
  await db
    .delete(aiRequestMetricsTable)
    .where(inArray(aiRequestMetricsTable.toolName, usedToolNames));
  await db
    .delete(aiToolAlertStateTable)
    .where(inArray(aiToolAlertStateTable.toolName, usedToolNames));
  usedToolNames.length = 0;
});

afterAll(async () => {
  delete process.env.FOUNDER_ALERT_EMAIL;
  await pool.end();
});

describe("checkAiReliabilityAlerts", () => {
  it("first breach inserts state, sends one email, reports tool in breached", async () => {
    const toolName = uniqueTool("first-breach");
    // 20 samples, only 5 first-try ok → 25% rate, well below 70% threshold
    await seedMetrics(toolName, { total: 20, firstTryOk: 5 });

    const result = await checkAiReliabilityAlerts();

    expect(result.breached).toContain(toolName);
    expect(result.cleared).not.toContain(toolName);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const call = sendMailMock.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
    };
    expect(call.to).toBe("founder@example.com");
    expect(call.subject).toContain(toolName);

    const states = await db
      .select()
      .from(aiToolAlertStateTable)
      .where(eq(aiToolAlertStateTable.toolName, toolName));
    expect(states).toHaveLength(1);
    expect(states[0]?.breached).toBe(true);
    expect(states[0]?.firstBreachedAt).toBeTruthy();
    expect(states[0]?.lastNotifiedAt).toBeTruthy();
  });

  it("does not re-notify while a tool is still degraded", async () => {
    const toolName = uniqueTool("still-degraded");
    await seedMetrics(toolName, { total: 20, firstTryOk: 5 });

    const first = await checkAiReliabilityAlerts();
    expect(first.breached).toContain(toolName);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    sendMailMock.mockClear();

    // Second run, still degraded — no new email, no new transition reported.
    const second = await checkAiReliabilityAlerts();
    expect(second.breached).not.toContain(toolName);
    expect(second.cleared).not.toContain(toolName);
    expect(sendMailMock).not.toHaveBeenCalled();

    const states = await db
      .select()
      .from(aiToolAlertStateTable)
      .where(eq(aiToolAlertStateTable.toolName, toolName));
    expect(states[0]?.breached).toBe(true);
  });

  it("recovery clears the breached flag", async () => {
    const toolName = uniqueTool("recovery");
    // Start with a breach.
    await seedMetrics(toolName, { total: 20, firstTryOk: 5 });
    await checkAiReliabilityAlerts();
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    sendMailMock.mockClear();

    // Pile on a large run of healthy results so the recent window is
    // dominated by good rows and the rate goes back above threshold.
    await seedMetrics(toolName, { total: ALERT_WINDOW, firstTryOk: ALERT_WINDOW });

    const result = await checkAiReliabilityAlerts();
    expect(result.cleared).toContain(toolName);
    expect(result.breached).not.toContain(toolName);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("recovered") }),
    );

    const states = await db
      .select()
      .from(aiToolAlertStateTable)
      .where(eq(aiToolAlertStateTable.toolName, toolName));
    expect(states[0]?.breached).toBe(false);
    expect(states[0]?.lastClearedAt).toBeTruthy();
  });

  it("never alerts when sample size is below ALERT_MIN_SAMPLE", async () => {
    const toolName = uniqueTool("low-sample");
    // Fewer than ALERT_MIN_SAMPLE rows, all failing — should still not alert.
    const lowTotal = ALERT_MIN_SAMPLE - 1;
    await seedMetrics(toolName, { total: lowTotal, firstTryOk: 0 });

    const result = await checkAiReliabilityAlerts();

    expect(result.breached).not.toContain(toolName);
    expect(result.cleared).not.toContain(toolName);
    expect(sendMailMock).not.toHaveBeenCalled();

    const states = await db
      .select()
      .from(aiToolAlertStateTable)
      .where(eq(aiToolAlertStateTable.toolName, toolName));
    expect(states).toHaveLength(0);
  });
});
