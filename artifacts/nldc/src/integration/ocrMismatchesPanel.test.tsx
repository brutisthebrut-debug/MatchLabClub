import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";

import type { OcrMismatchesResponse } from "@/lib/apiClient";

const getOcrMismatchesMock = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  getOcrMismatches: () => getOcrMismatchesMock(),
}));

import { OcrMismatchesPanel } from "@/components/founder/OcrMismatchesPanel";

const SAMPLE: OcrMismatchesResponse = {
  summary: {
    totalScreenshotAudits: 42,
    auditsWithRawOcr: 30,
    auditsWithCorrections: 18,
    sampleSize: 18,
    windowDays: null,
    since: null,
    sort: "total",
  },
  perField: [
    {
      field: "bio",
      correctionsCount: 11,
      topDiffCount: 5,
      topDiffs: [
        { example: "lovs hiking → loves hiking", count: 5 },
        { example: "atlnta → atlanta", count: 3 },
        { example: "dgs → dogs", count: 2 },
      ],
    },
    {
      field: "firstName",
      correctionsCount: 6,
      topDiffCount: 4,
      topDiffs: [
        { example: "Sanm → Sam", count: 4 },
        { example: "Kte → Kate", count: 2 },
      ],
    },
    {
      field: "age",
      correctionsCount: 4,
      topDiffCount: 4,
      topDiffs: [{ example: "Z9 → 29", count: 4 }],
    },
    {
      field: "sourceApp",
      correctionsCount: 2,
      topDiffCount: 2,
      topDiffs: [{ example: "Hingo → Hinge", count: 2 }],
    },
    {
      field: "prompts",
      correctionsCount: 1,
      topDiffCount: 1,
      topDiffs: [{ example: "favorit hobby → favorite hobby", count: 1 }],
    },
  ],
  recent: [
    {
      auditId: 901,
      field: "bio",
      raw: "lovs hiking",
      corrected: "loves hiking",
      createdAt: "2026-05-19T12:00:00.000Z",
    },
    {
      auditId: 902,
      field: "firstName",
      raw: "Sanm",
      corrected: "Sam",
      createdAt: "2026-05-19T11:00:00.000Z",
    },
    {
      auditId: 903,
      field: "age",
      raw: "Z9",
      corrected: "29",
      createdAt: "2026-05-19T10:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  getOcrMismatchesMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("OcrMismatchesPanel", () => {
  it("renders summary counts, field rankings in order, top diffs, and recent corrections", async () => {
    getOcrMismatchesMock.mockResolvedValueOnce(SAMPLE);

    render(<OcrMismatchesPanel refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByTestId("ocr-mismatches-summary")).toBeTruthy();
    });

    // Summary counts visible
    const summary = screen.getByTestId("ocr-mismatches-summary");
    expect(within(summary).getByText("42")).toBeTruthy();
    expect(within(summary).getByText("30")).toBeTruthy();
    // "18" appears twice (auditsWithCorrections and sampleSize)
    expect(within(summary).getAllByText("18")).toHaveLength(2);

    // Field rankings appear in the order returned by the API (bio > firstName > age > sourceApp > prompts)
    const fieldsContainer = screen.getByTestId("ocr-mismatches-fields");
    const rows = within(fieldsContainer).getAllByTestId(/^ocr-field-row-/);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual([
      "ocr-field-row-bio",
      "ocr-field-row-firstName",
      "ocr-field-row-age",
      "ocr-field-row-sourceApp",
      "ocr-field-row-prompts",
    ]);

    // Numeric counts per field
    expect(screen.getByTestId("ocr-field-count-bio").textContent).toBe("11");
    expect(screen.getByTestId("ocr-field-count-firstName").textContent).toBe(
      "6",
    );
    expect(screen.getByTestId("ocr-field-count-age").textContent).toBe("4");
    expect(screen.getByTestId("ocr-field-count-sourceApp").textContent).toBe(
      "2",
    );
    expect(screen.getByTestId("ocr-field-count-prompts").textContent).toBe(
      "1",
    );

    // Top diffs for the leading field appear in the order returned
    const bioDiffs = screen.getByTestId("ocr-field-diffs-bio");
    const bioItems = within(bioDiffs).getAllByRole("listitem");
    expect(bioItems.map((li) => li.textContent)).toEqual([
      "lovs hiking → loves hiking×5",
      "atlnta → atlanta×3",
      "dgs → dogs×2",
    ]);

    // First-name diff also rendered
    expect(
      within(screen.getByTestId("ocr-field-diffs-firstName")).getByText(
        "Sanm → Sam",
      ),
    ).toBeTruthy();

    // Recent corrections appear in API order
    const recent = screen.getByTestId("ocr-mismatches-recent");
    const recentRows = within(recent).getAllByTestId(/^ocr-recent-row-/);
    expect(recentRows.map((r) => r.getAttribute("data-testid"))).toEqual([
      "ocr-recent-row-0",
      "ocr-recent-row-1",
      "ocr-recent-row-2",
    ]);
    expect(recentRows[0].textContent).toContain("#901");
    expect(recentRows[0].textContent).toContain("Bio");
    expect(recentRows[0].textContent).toContain("lovs hiking → loves hiking");
    expect(recentRows[1].textContent).toContain("#902");
    expect(recentRows[1].textContent).toContain("First name");
    expect(recentRows[1].textContent).toContain("Sanm → Sam");
    expect(recentRows[2].textContent).toContain("#903");
    expect(recentRows[2].textContent).toContain("Age");
    expect(recentRows[2].textContent).toContain("Z9 → 29");
  });

  it("renders empty states when there are no corrections", async () => {
    getOcrMismatchesMock.mockResolvedValueOnce({
      summary: {
        totalScreenshotAudits: 0,
        auditsWithRawOcr: 0,
        auditsWithCorrections: 0,
        sampleSize: 0,
        windowDays: null,
        since: null,
        sort: "total",
      },
      perField: [],
      recent: [],
    } satisfies OcrMismatchesResponse);

    render(<OcrMismatchesPanel refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("No corrections recorded yet.")).toBeTruthy();
    });
    expect(screen.getByText("No recent corrections.")).toBeTruthy();
  });

  it("shows an error message when the API call fails", async () => {
    getOcrMismatchesMock.mockRejectedValueOnce(new Error("boom"));

    render(<OcrMismatchesPanel refreshKey={0} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Could not load OCR mismatches: boom/),
      ).toBeTruthy();
    });
  });
});
