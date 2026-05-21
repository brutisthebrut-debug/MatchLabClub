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
import { eq } from "drizzle-orm";

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
  jobHeartbeatsTable,
  geoipAlertStateTable,
  GEOIP_ALERT_STATE_SINGLETON_ID,
} from "@workspace/db";
import { checkGeoipKeyMissingAlert } from "./geoipUpdateJob";

const GEOIP_UPDATE_JOB = "geoip_update";

async function setLastSuccessAt(at: Date | null): Promise<void> {
  await db
    .delete(jobHeartbeatsTable)
    .where(eq(jobHeartbeatsTable.jobName, GEOIP_UPDATE_JOB));
  if (at) {
    await db
      .insert(jobHeartbeatsTable)
      .values({ jobName: GEOIP_UPDATE_JOB, lastSuccessAt: at });
  }
}

async function clearAlertState(): Promise<void> {
  await db
    .delete(geoipAlertStateTable)
    .where(eq(geoipAlertStateTable.id, GEOIP_ALERT_STATE_SINGLETON_ID));
}

async function readAlertState() {
  const rows = await db
    .select()
    .from(geoipAlertStateTable)
    .where(eq(geoipAlertStateTable.id, GEOIP_ALERT_STATE_SINGLETON_ID));
  return rows[0] ?? null;
}

beforeAll(() => {
  process.env.FOUNDER_ALERT_EMAIL = "founder@example.com";
});

beforeEach(() => {
  sendMailMock.mockClear();
  delete process.env.MAXMIND_LICENSE_KEY;
});

afterEach(async () => {
  await clearAlertState();
  await setLastSuccessAt(null);
});

afterAll(async () => {
  delete process.env.FOUNDER_ALERT_EMAIL;
  await pool.end();
});

describe("checkGeoipKeyMissingAlert", () => {
  it("does nothing while the key is set", async () => {
    process.env.MAXMIND_LICENSE_KEY = "fake-key";
    await setLastSuccessAt(new Date(Date.now() - 100 * 24 * 60 * 60 * 1000));

    const result = await checkGeoipKeyMissingAlert();

    expect(result).toBe("not_due");
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(await readAlertState()).toBeNull();
  });

  it("does nothing when there is no heartbeat (fresh install)", async () => {
    const result = await checkGeoipKeyMissingAlert();
    expect(result).toBe("no_heartbeat");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("does nothing when the last update is within the alert window", async () => {
    await setLastSuccessAt(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000));
    const result = await checkGeoipKeyMissingAlert();
    expect(result).toBe("not_due");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("sends a one-time alert when key is missing and update is stale", async () => {
    await setLastSuccessAt(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));

    const result = await checkGeoipKeyMissingAlert();

    expect(result).toBe("alerted");
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
    };
    expect(call.to).toBe("founder@example.com");
    expect(call.subject).toContain("GeoIP");

    const state = await readAlertState();
    expect(state?.breached).toBe(true);
    expect(state?.lastNotifiedAt).toBeTruthy();
  });

  it("does not re-notify while already breached", async () => {
    await setLastSuccessAt(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));

    const first = await checkGeoipKeyMissingAlert();
    expect(first).toBe("alerted");
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    sendMailMock.mockClear();

    const second = await checkGeoipKeyMissingAlert();
    expect(second).toBe("suppressed_breached");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("suppresses a re-breach inside the cooldown window", async () => {
    process.env.GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES = "60";
    try {
      await setLastSuccessAt(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));
      // Simulate a recently cleared alert: lastClearedAt = just now.
      await db.insert(geoipAlertStateTable).values({
        id: GEOIP_ALERT_STATE_SINGLETON_ID,
        breached: false,
        lastClearedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkGeoipKeyMissingAlert();

      expect(result).toBe("suppressed_cooldown");
      expect(sendMailMock).not.toHaveBeenCalled();

      // State still flips to breached so we don't keep re-evaluating cooldown.
      const state = await readAlertState();
      expect(state?.breached).toBe(true);
    } finally {
      delete process.env.GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES;
    }
  });

  it("re-alerts once cooldown has elapsed since recovery", async () => {
    process.env.GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES = "0.0000001";
    try {
      await setLastSuccessAt(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));
      await db.insert(geoipAlertStateTable).values({
        id: GEOIP_ALERT_STATE_SINGLETON_ID,
        breached: false,
        lastClearedAt: new Date(Date.now() - 1000),
        updatedAt: new Date(),
      });

      const result = await checkGeoipKeyMissingAlert();

      expect(result).toBe("alerted");
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES;
    }
  });
});
