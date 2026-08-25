import { describe, expect, it } from "vitest";
import { GUIDED_DEBRIEF_HREF, shouldOpenGuidedDebrief } from "./journeyRoutes";

describe("Journey compatibility routes", () => {
  it("keeps the old guided debrief entry pointed at Journey", () => {
    expect(GUIDED_DEBRIEF_HREF).toBe("/journey?capture=guided-date");
    expect(shouldOpenGuidedDebrief(GUIDED_DEBRIEF_HREF)).toBe(true);
  });

  it("recognizes routers that expose the query through window.search", () => {
    expect(shouldOpenGuidedDebrief("/journey", "?capture=guided-date")).toBe(true);
    expect(shouldOpenGuidedDebrief("/journey", "")).toBe(false);
  });
});
