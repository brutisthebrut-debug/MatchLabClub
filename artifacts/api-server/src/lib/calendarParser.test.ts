import { describe, it, expect } from "vitest";
import { parseCalendarIcs } from "./calendarParser";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
DTSTART:20260105T190000Z
DTEND:20260105T200000Z
SUMMARY:Dinner with Alex
END:VEVENT
BEGIN:VEVENT
DTSTART:20260110T100000
SUMMARY:Saturday gym
RRULE:FREQ=WEEKLY;BYDAY=SA
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260112
SUMMARY:All day offsite
END:VEVENT
END:VCALENDAR`;

describe("parseCalendarIcs", () => {
  it("counts events, timed, all-day, and recurring", () => {
    const s = parseCalendarIcs(SAMPLE_ICS);
    expect(s.source).toBe("calendar-ics");
    expect(s.counts.totalEvents).toBe(3);
    expect(s.counts.timedEvents).toBe(2);
    expect(s.counts.allDayEvents).toBe(1);
    expect(s.counts.recurringEvents).toBe(1);
  });

  it("derives weekend and evening shares from wall-clock times", () => {
    const s = parseCalendarIcs(SAMPLE_ICS);
    // 1 of 3 events on a weekend (Sat Jan 10)
    expect(s.rhythm.weekendShare).toBe(33);
    // 1 of 2 timed events starts after 5pm (Mon 19:00)
    expect(s.rhythm.eveningShare).toBe(50);
  });

  it("identifies the busiest day and recurring rituals", () => {
    const s = parseCalendarIcs(SAMPLE_ICS);
    // Jan 5 and Jan 12 2026 are both Mondays => Monday is busiest
    expect(s.rhythm.busiestDay).toBe("Monday");
    expect(s.topRecurring).toContain("Saturday gym");
  });

  it("produces voice-clean reads with no em dashes", () => {
    const s = parseCalendarIcs(SAMPLE_ICS);
    expect(s.reads.length).toBeGreaterThan(0);
    for (const line of s.reads) {
      expect(line).not.toContain("\u2014");
    }
  });

  it("handles RFC 5545 line folding", () => {
    const folded = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260106T120000Z
SUMMARY:A very long event title that has been
  folded across two lines
END:VEVENT
END:VCALENDAR`;
    const s = parseCalendarIcs(folded);
    expect(s.counts.totalEvents).toBe(1);
  });

  it("returns zeroed summary for input with no events", () => {
    const s = parseCalendarIcs("not a calendar at all");
    expect(s.counts.totalEvents).toBe(0);
    expect(s.rhythm.busiestDay).toBeNull();
    expect(s.reads).toEqual([]);
  });
});
