import { describe, expect, it } from "vitest";
import { datesCompatibilityHref, experimentsCompatibilityHref, followUpsCompatibilityHref, GUIDED_DEBRIEF_HREF, journalCompatibilityHref, readJourneyConnectionId, readJourneyRouteState, shouldOpenGuidedDebrief, winsCompatibilityHref } from "./journeyRoutes";

describe("Journey compatibility routes", () => {
  it("keeps the old guided debrief entry pointed at Journey", () => {
    expect(GUIDED_DEBRIEF_HREF).toBe("/journey?capture=guided-date");
    expect(shouldOpenGuidedDebrief(GUIDED_DEBRIEF_HREF)).toBe(true);
  });

  it("recognizes routers that expose the query through window.search", () => {
    expect(shouldOpenGuidedDebrief("/journey", "?capture=guided-date")).toBe(true);
    expect(shouldOpenGuidedDebrief("/journey", "")).toBe(false);
  });

  it("carries only valid match connection ids into the guided debrief", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(readJourneyConnectionId(`${GUIDED_DEBRIEF_HREF}&connectionId=${id}`)).toBe(id);
    expect(readJourneyConnectionId("/journey", `?capture=guided-date&connectionId=${id}`)).toBe(id);
    expect(readJourneyConnectionId("/journey?connectionId=not-a-uuid")).toBeNull();
  });

  it("preserves journal and date list state through compatibility redirects", () => {
    expect(journalCompatibilityHref("/mirror/journal?view=trash&q=boundaries")).toBe("/journey?kind=reflection&view=trash&q=boundaries");
    expect(datesCompatibilityHref("/mirror/dates", "?q=coffee&note=42")).toBe("/journey?kind=date&q=coffee&date=42");
    expect(datesCompatibilityHref("/mirror/dates?view=trash&note=9")).toBe("/journey?kind=date&view=trash&date=9");
  });

  it("reopens exact durable source ids and rejects invalid ids", () => {
    expect(readJourneyRouteState("/journey?reflection=12").source).toEqual({ type: "journal_entry", id: 12 });
    expect(readJourneyRouteState("/journey?date=-2").source).toBeNull();
    expect(readJourneyRouteState("/journey?win=7")).toMatchObject({ kind: "all", source: { type: "dating_win", id: 7 } });
    expect(readJourneyRouteState("/journey?experiment=8")).toMatchObject({ source: { type: "journey_experiment", id: 8 } });
    expect(readJourneyRouteState("/journey?followUp=9")).toMatchObject({ source: { type: "journey_follow_up", id: 9 } });
  });

  it("keeps old wins links focused on the canonical Journey view", () => {
    expect(winsCompatibilityHref("/progress/wins?q=courage&win=5")).toBe("/journey?kind=win&q=courage&win=5");
  });

  it("keeps old experiment links focused on the canonical Journey view", () => {
    expect(experimentsCompatibilityHref("/progress/experiments?q=space&experiment=6")).toBe("/journey?kind=experiment&q=space&experiment=6");
  });

  it("keeps old follow-up links focused on the canonical Journey view", () => {
    expect(followUpsCompatibilityHref("/progress/followup?q=clarity&followUp=11")).toBe("/journey?kind=follow-up&q=clarity&followUp=11");
  });
});
