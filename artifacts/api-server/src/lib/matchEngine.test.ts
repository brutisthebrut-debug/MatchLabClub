import { describe, it, expect } from "vitest";
import {
  scoreCompatibility,
  rankCandidates,
  gatesPass,
  type MatchCandidate,
} from "./matchEngine";

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    userId: "u",
    age: 30,
    gender: "woman",
    prefs: {
      ageMin: null,
      ageMax: null,
      genderPreference: null,
      cityHint: null,
    },
    readinessScore: 60,
    breakdown: {},
    ...overrides,
  };
}

describe("scoreCompatibility", () => {
  it("is symmetric", () => {
    const a = candidate({
      userId: "a",
      age: 28,
      gender: "woman",
      readinessScore: 70,
      breakdown: { compass: 80, journal: 40 },
      prefs: {
        ageMin: 25,
        ageMax: 40,
        genderPreference: "men",
        cityHint: "Austin",
      },
    });
    const b = candidate({
      userId: "b",
      age: 34,
      gender: "man",
      readinessScore: 65,
      breakdown: { compass: 50, wellness: 30 },
      prefs: {
        ageMin: 24,
        ageMax: 36,
        genderPreference: "women",
        cityHint: "austin",
      },
    });
    const ab = scoreCompatibility(a, b);
    const ba = scoreCompatibility(b, a);
    expect(ab.score).toBe(ba.score);
    expect(ab.summary).toBe(ba.summary);
  });

  it("returns a 0-100 integer score", () => {
    const a = candidate({ userId: "a" });
    const b = candidate({ userId: "b" });
    const { score } = scoreCompatibility(a, b);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("rewards same area, shared lanes, and high mutual readiness", () => {
    const near = scoreCompatibility(
      candidate({
        userId: "a",
        readinessScore: 90,
        breakdown: { compass: 80, journal: 70, wellness: 60 },
        prefs: {
          ageMin: null,
          ageMax: null,
          genderPreference: null,
          cityHint: "Denver",
        },
      }),
      candidate({
        userId: "b",
        readinessScore: 88,
        breakdown: { compass: 50, journal: 40, wellness: 30 },
        prefs: {
          ageMin: null,
          ageMax: null,
          genderPreference: null,
          cityHint: "Denver",
        },
      }),
    );
    const far = scoreCompatibility(
      candidate({
        userId: "a",
        readinessScore: 20,
        breakdown: { compass: 10 },
        prefs: {
          ageMin: null,
          ageMax: null,
          genderPreference: null,
          cityHint: "Denver",
        },
      }),
      candidate({
        userId: "b",
        readinessScore: 85,
        breakdown: { wellness: 10 },
        prefs: {
          ageMin: null,
          ageMax: null,
          genderPreference: null,
          cityHint: "Seattle",
        },
      }),
    );
    expect(near.score).toBeGreaterThan(far.score);
  });

  it("notes missing profile data instead of hard-failing", () => {
    const { reasons } = scoreCompatibility(
      candidate({ userId: "a", age: null, gender: null }),
      candidate({ userId: "b" }),
    );
    expect(reasons.some((r) => r.includes("profile audit"))).toBe(true);
  });
});

describe("gatesPass", () => {
  it("passes when both preferences admit each other", () => {
    const a = candidate({
      userId: "a",
      age: 30,
      gender: "woman",
      prefs: {
        ageMin: 28,
        ageMax: 40,
        genderPreference: "men",
        cityHint: null,
      },
    });
    const b = candidate({
      userId: "b",
      age: 35,
      gender: "man",
      prefs: {
        ageMin: 25,
        ageMax: 33,
        genderPreference: "women",
        cityHint: null,
      },
    });
    expect(gatesPass(a, b)).toBe(true);
  });

  it("fails on a gender preference mismatch", () => {
    const a = candidate({
      userId: "a",
      gender: "woman",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: "women",
        cityHint: null,
      },
    });
    const b = candidate({ userId: "b", gender: "man" });
    expect(gatesPass(a, b)).toBe(false);
  });

  it("fails when one age falls outside the other's range", () => {
    const a = candidate({
      userId: "a",
      age: 30,
      prefs: {
        ageMin: 40,
        ageMax: 50,
        genderPreference: null,
        cityHint: null,
      },
    });
    const b = candidate({ userId: "b", age: 30 });
    expect(gatesPass(a, b)).toBe(false);
  });

  it("treats unset preferences and unknown attributes as open", () => {
    const a = candidate({
      userId: "a",
      age: null,
      gender: null,
      prefs: {
        ageMin: 25,
        ageMax: 35,
        genderPreference: "women",
        cityHint: null,
      },
    });
    const b = candidate({ userId: "b", age: null, gender: null });
    expect(gatesPass(a, b)).toBe(true);
  });

  it("admits an unreadable gender preference value as open", () => {
    const a = candidate({
      userId: "a",
      gender: "woman",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: "everyone",
        cityHint: null,
      },
    });
    const b = candidate({ userId: "b", gender: "man" });
    expect(gatesPass(a, b)).toBe(true);
  });

  it("maps a trans-women preference onto the women umbrella", () => {
    const seeker = candidate({
      userId: "seeker",
      gender: "man",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: "trans-women",
        cityHint: null,
      },
    });
    // A woman is admitted by a trans-women preference; a man is not.
    const woman = candidate({ userId: "w", gender: "woman" });
    const man = candidate({ userId: "m", gender: "man" });
    expect(gatesPass(seeker, woman)).toBe(true);
    expect(gatesPass(seeker, man)).toBe(false);
  });

  it("maps a trans-men preference onto the men umbrella", () => {
    const seeker = candidate({
      userId: "seeker",
      gender: "woman",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: "trans-men",
        cityHint: null,
      },
    });
    const man = candidate({ userId: "m", gender: "man" });
    const woman = candidate({ userId: "w", gender: "woman" });
    expect(gatesPass(seeker, man)).toBe(true);
    expect(gatesPass(seeker, woman)).toBe(false);
  });

  it("hard-fails a pair whose measured distance exceeds the tighter radius", () => {
    // New York and Los Angeles resolve to real coordinates ~2400 miles apart.
    const a = candidate({
      userId: "a",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 25,
      },
    });
    const b = candidate({
      userId: "b",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "Los Angeles",
        radiusMiles: 25,
      },
    });
    expect(gatesPass(a, b)).toBe(false);
  });

  it("admits a pair within the tighter radius", () => {
    const a = candidate({
      userId: "a",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 50,
      },
    });
    const b = candidate({
      userId: "b",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 50,
      },
    });
    expect(gatesPass(a, b)).toBe(true);
  });

  it("uses the MIN of the two radii, so one tight radius blocks the pair", () => {
    const tight = candidate({
      userId: "tight",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 10,
      },
    });
    const loose = candidate({
      userId: "loose",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "Philadelphia",
        radiusMiles: 500,
      },
    });
    // NYC to Philadelphia is ~80 miles: inside the loose radius, outside tight.
    expect(gatesPass(tight, loose)).toBe(false);
  });

  it("degrades gracefully when a city cannot be resolved (no hard block)", () => {
    const a = candidate({
      userId: "a",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "Somewhereville",
        radiusMiles: 5,
      },
    });
    const b = candidate({
      userId: "b",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 5,
      },
    });
    expect(gatesPass(a, b)).toBe(true);
  });

  it("blocks a far pair when neither opted into relocation", () => {
    const ny = candidate({
      userId: "ny",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 50,
      },
    });
    const sf = candidate({
      userId: "sf",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "San Francisco",
        radiusMiles: 50,
      },
    });
    expect(gatesPass(ny, sf)).toBe(false);
  });

  it("bridges a far pair when one opted in and the other lives on a love line", () => {
    const ny = candidate({
      userId: "ny",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 50,
        relocationOpen: true,
        loveLineCities: ["san francisco"],
      },
    });
    const sf = candidate({
      userId: "sf",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "San Francisco",
        radiusMiles: 50,
      },
    });
    expect(gatesPass(ny, sf)).toBe(true);
    // Symmetric: the order of the pair does not matter.
    expect(gatesPass(sf, ny)).toBe(true);
  });

  it("does not bridge when the opted-in side's love lines miss the other city", () => {
    const ny = candidate({
      userId: "ny",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 50,
        relocationOpen: true,
        loveLineCities: ["denver"],
      },
    });
    const sf = candidate({
      userId: "sf",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "San Francisco",
        radiusMiles: 50,
      },
    });
    expect(gatesPass(ny, sf)).toBe(false);
  });

  it("does not bridge when love lines are set but relocation is off", () => {
    const ny = candidate({
      userId: "ny",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "New York",
        radiusMiles: 50,
        relocationOpen: false,
        loveLineCities: ["san francisco"],
      },
    });
    const sf = candidate({
      userId: "sf",
      prefs: {
        ageMin: null,
        ageMax: null,
        genderPreference: null,
        cityHint: "San Francisco",
        radiusMiles: 50,
      },
    });
    expect(gatesPass(ny, sf)).toBe(false);
  });
});

describe("rankCandidates", () => {
  const me = candidate({
    userId: "me",
    age: 30,
    gender: "woman",
    readinessScore: 70,
    breakdown: { compass: 60 },
    prefs: {
      ageMin: null,
      ageMax: null,
      genderPreference: "men",
      cityHint: "Austin",
    },
  });

  it("excludes self and pairs that fail the gates", () => {
    const others = [
      me,
      candidate({ userId: "wrong-gender", gender: "woman" }),
      candidate({
        userId: "good",
        gender: "man",
        readinessScore: 68,
        breakdown: { compass: 50 },
        prefs: {
          ageMin: null,
          ageMax: null,
          genderPreference: "women",
          cityHint: "Austin",
        },
      }),
    ];
    const ranked = rankCandidates(me, others, 10);
    const ids = ranked.map((r) => r.candidate.userId);
    expect(ids).toContain("good");
    expect(ids).not.toContain("me");
    expect(ids).not.toContain("wrong-gender");
  });

  it("orders by score desc with a deterministic userId tiebreak", () => {
    const make = (id: string) =>
      candidate({
        userId: id,
        gender: "man",
        readinessScore: 70,
        breakdown: { compass: 60 },
        prefs: {
          ageMin: null,
          ageMax: null,
          genderPreference: "women",
          cityHint: "Austin",
        },
      });
    const ranked = rankCandidates(me, [make("zed"), make("alpha")], 10);
    expect(ranked[0]?.candidate.userId).toBe("alpha");
    expect(ranked[1]?.candidate.userId).toBe("zed");
  });

  it("respects the limit", () => {
    const others = ["a", "b", "c", "d"].map((id) =>
      candidate({
        userId: id,
        gender: "man",
        prefs: {
          ageMin: null,
          ageMax: null,
          genderPreference: "women",
          cityHint: null,
        },
      }),
    );
    expect(rankCandidates(me, others, 2)).toHaveLength(2);
  });
});
