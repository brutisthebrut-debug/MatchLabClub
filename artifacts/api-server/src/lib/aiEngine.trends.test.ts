import { describe, it, expect } from "vitest";
import { analyzeAuditTrends, ENGINE_VERSION } from "./aiEngine";

const NOW = new Date("2026-05-22T12:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

describe("analyzeAuditTrends", () => {
  it("Fixture 1 — empty audit history returns a gentle empty state", () => {
    const r = analyzeAuditTrends({ audits: [], now: NOW });
    expect(r.hasEnoughData).toBe(false);
    expect(r.totalAudits).toBe(0);
    expect(r.repeatedStrengths).toEqual([]);
    expect(r.recurringRisks).toEqual([]);
    expect(r.scoreDelta).toEqual({
      first: null,
      latest: null,
      previous: null,
      delta: 0,
      currentVsPrevious: 0,
      rolling30Delta: 0,
      direction: "flat",
    });
    expect(r.readinessScore).toBe(50);
    expect(r.scoreHistory).toEqual([]);
    expect(r.engagementWindow.auditsPerMonth).toBe(0);
    expect(r.engagementWindow.dormancyGapCount).toBe(0);
    expect(r.engagementWindow.firstAuditAt).toBeNull();
    expect(r.headlineInsight).toMatch(/first audit/i);
    expect(r.engineVersion).toBe(ENGINE_VERSION);
  });

  it("Fixture 2 — a single audit reports totalAudits=1 with no false 'enough data' claim", () => {
    const r = analyzeAuditTrends({
      audits: [
        {
          readinessScore: 64,
          strengths: ["Genuine warmth comes through"],
          risks: ["Generic phrases dilute the profile"],
          createdAt: daysAgo(3),
        },
      ],
      now: NOW,
    });
    expect(r.totalAudits).toBe(1);
    expect(r.hasEnoughData).toBe(false);
    expect(r.scoreDelta.first).toBe(64);
    expect(r.scoreDelta.latest).toBe(64);
    expect(r.scoreDelta.delta).toBe(0);
    expect(r.scoreDelta.direction).toBe("flat");
    // With only one audit we should NOT emit theme shifts
    expect(r.themeShifts).toEqual([]);
    expect(r.headlineInsight).toMatch(/one audit/i);
  });

  it("Fixture 3 — score climbing across two audits surfaces a positive lift signal", () => {
    const r = analyzeAuditTrends({
      audits: [
        {
          readinessScore: 58,
          strengths: ["Warmth comes through"],
          risks: ["Opening line lacks a hook"],
          createdAt: daysAgo(20),
        },
        {
          readinessScore: 76,
          strengths: ["Specific, vivid bio detail"],
          risks: ["Photos need work"],
          createdAt: daysAgo(2),
        },
      ],
      now: NOW,
    });
    expect(r.hasEnoughData).toBe(true);
    expect(r.scoreDelta.delta).toBe(18);
    expect(r.scoreDelta.direction).toBe("up");
    expect(r.spanDays).toBe(18);
    expect(r.readinessSignals.some((s) => s.tone === "positive" && /lift/i.test(s.label))).toBe(true);
    expect(r.headlineInsight).toMatch(/up 18 points/);
    // Specificity emerges (in second half, absent from first)
    expect(r.themeShifts.some((s) => s.key === "specificity" && s.direction === "emerged")).toBe(true);
  });

  it("Fixture 4 — three audits with consistent generic-phrasing risk surfaces a recurring pattern", () => {
    const r = analyzeAuditTrends({
      audits: [
        {
          readinessScore: 60,
          strengths: ["Warmth"],
          risks: ["Generic phrases dilute the profile"],
          createdAt: daysAgo(30),
        },
        {
          readinessScore: 62,
          strengths: ["Warmth"],
          risks: ["Vague language throughout — common patterns"],
          createdAt: daysAgo(20),
        },
        {
          readinessScore: 63,
          strengths: ["Warmth"],
          risks: ["Generic opener — first message lacks a hook"],
          createdAt: daysAgo(10),
        },
      ],
      now: NOW,
    });
    expect(r.totalAudits).toBe(3);
    expect(r.recurringRisks[0].key).toBe("generic");
    expect(r.recurringRisks[0].count).toBe(3);
    expect(r.repeatedStrengths.find((s) => s.key === "warmth")?.count).toBe(3);
    expect(r.readinessSignals.some((s) => /Generic phrasing/.test(s.label))).toBe(true);
    expect(r.scoreDelta.direction).toBe("flat");
    expect(r.headlineInsight).toMatch(/generic phrasing/i);
  });

  it("Fixture 5 — theme shift: early generic phrasing fades while specificity emerges over four audits", () => {
    const r = analyzeAuditTrends({
      audits: [
        {
          readinessScore: 55,
          strengths: ["Earnest tone"],
          risks: ["Generic phrasing throughout"],
          createdAt: daysAgo(60),
        },
        {
          readinessScore: 58,
          strengths: ["Earnest tone"],
          risks: ["Vague — common bio language"],
          createdAt: daysAgo(45),
        },
        {
          readinessScore: 71,
          strengths: ["Specific, vivid detail in opener"],
          risks: ["Photos need refresh"],
          createdAt: daysAgo(20),
        },
        {
          readinessScore: 78,
          strengths: ["Concrete, particular bio specifics"],
          risks: ["Confidence signal could be sharper"],
          createdAt: daysAgo(5),
        },
      ],
      now: NOW,
    });
    expect(r.scoreDelta.direction).toBe("up");
    expect(r.spanDays).toBe(55);
    expect(r.engagementWindow.avgGapDays).not.toBeNull();
    const specShift = r.themeShifts.find((s) => s.key === "specificity");
    const genericShift = r.themeShifts.find((s) => s.key === "generic");
    expect(specShift?.direction).toBe("emerged");
    expect(genericShift?.direction).toBe("faded");
    expect(r.engagementWindow.mostActiveDay).not.toBeNull();
  });

  it("Fixture 6 — sendStats + life-pulses enrich readiness signals beyond audit data alone", () => {
    const r = analyzeAuditTrends({
      audits: [
        {
          readinessScore: 70,
          strengths: ["Genuine warmth"],
          risks: ["Opener could be sharper"],
          createdAt: daysAgo(14),
        },
        {
          readinessScore: 80,
          strengths: ["Specific bio detail"],
          risks: ["Photo selection"],
          createdAt: daysAgo(3),
        },
      ],
      sendStats: { totalPrompts: 10, sentCount: 8 },
      lifePulses: [
        { energy: 4, headspace: 4, createdAt: daysAgo(1) },
        { energy: 5, headspace: 4, createdAt: daysAgo(3) },
        { energy: 4, headspace: 5, createdAt: daysAgo(5) },
      ],
      now: NOW,
    });
    expect(r.hasEnoughData).toBe(true);
    expect(r.readinessSignals.some((s) => /80% send-through/.test(s.label) && s.tone === "positive")).toBe(true);
    expect(r.readinessSignals.some((s) => /Energy is trending/.test(s.label))).toBe(true);
    expect(r.readinessSignals.some((s) => s.tone === "positive" && /lift/.test(s.label))).toBe(true);
  });

  it("treats invalid createdAt timestamps as no-ops without throwing", () => {
    const r = analyzeAuditTrends({
      audits: [
        { readinessScore: 60, createdAt: "not-a-date", strengths: ["warmth"], risks: ["generic"] },
        { readinessScore: 70, createdAt: daysAgo(1), strengths: ["specific"], risks: ["photo"] },
      ],
      now: NOW,
    });
    expect(r.totalAudits).toBe(1);
  });
});
