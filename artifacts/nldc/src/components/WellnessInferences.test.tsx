import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false },
  list: {
    data: { inferences: [] as Array<Record<string, unknown>> },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  generate: { isPending: false, mutateAsync: vi.fn() },
  confirm: { isPending: false, mutateAsync: vi.fn() },
  dismiss: { isPending: false, mutateAsync: vi.fn() },
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@workspace/api-client-react", () => ({
  useListWellnessInferences: () => mocks.list,
  getListWellnessInferencesQueryKey: () => ["inferences"],
  useGenerateWellnessInferences: () => mocks.generate,
  useConfirmWellnessInference: () => mocks.confirm,
  useDismissWellnessInference: () => mocks.dismiss,
  getGetWellnessDailyQueryKey: () => ["wellness-daily"],
  getGetMatchingStateQueryKey: () => ["matching-state"],
  getGetCompanionQueryKey: () => ["companion"],
  getGetMyJourneySummaryQueryKey: () => ["journey-summary"],
}));

vi.mock("@/lib/wellnessQuestionBank", () => ({
  DIMENSION_META: {
    emotional: { label: "Emotional" },
  },
}));

import { WellnessInferences } from "./WellnessInferences";

const INFERENCE = {
  id: 7,
  dimension: "emotional",
  inferredQuestionId: "inferred:emotional:1",
  questionText: "What helps you feel emotionally safe?",
  suggestedAnswer: "I need steadiness and room to explain myself.",
  sourceKind: "journal",
  rationale: "Noticed in your journal writing.",
  mode: "deterministic",
  status: "pending",
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

beforeEach(() => {
  mocks.auth.isAuthenticated = true;
  mocks.auth.isLoading = false;
  mocks.list.data = { inferences: [] };
  mocks.list.isLoading = false;
  mocks.list.isError = false;
  mocks.list.refetch.mockReset();
  mocks.generate.isPending = false;
  mocks.generate.mutateAsync.mockReset().mockResolvedValue({});
  mocks.confirm.isPending = false;
  mocks.confirm.mutateAsync.mockReset().mockResolvedValue({});
  mocks.dismiss.isPending = false;
  mocks.dismiss.mutateAsync.mockReset().mockResolvedValue({});
  mocks.invalidateQueries.mockReset();
});

afterEach(() => cleanup());

describe("WellnessInferences", () => {
  it("shows an honest loading state instead of sample learnings", () => {
    mocks.list.isLoading = true;
    render(<WellnessInferences />);

    expect(screen.getByTestId("inferences-loading")).toBeTruthy();
    expect(screen.queryByTestId("inference-example")).toBeNull();
  });

  it("shows an honest empty state for a signed-in member", () => {
    render(<WellnessInferences />);

    expect(screen.getByTestId("inferences-empty")).toBeTruthy();
    expect(screen.getByText(/Nothing is waiting for your review/i)).toBeTruthy();
    expect(screen.queryByTestId("inference-example")).toBeNull();
  });

  it("does not replace a failed account read with sample data", () => {
    mocks.list.isError = true;
    render(<WellnessInferences />);

    expect(screen.getByTestId("inferences-error")).toBeTruthy();
    expect(screen.getByText(/Nothing from your account/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mocks.list.refetch).toHaveBeenCalledTimes(1);
  });

  it("saves the member's correction and refreshes every learning surface", async () => {
    mocks.list.data = { inferences: [INFERENCE] };
    render(<WellnessInferences />);

    fireEvent.change(screen.getByTestId("inference-input-7"), {
      target: { value: "I need consistency, and I also need direct communication." },
    });
    expect(
      screen.getByRole("button", { name: /save my correction/i }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /save my correction/i }),
    );

    await waitFor(() => {
      expect(mocks.confirm.mutateAsync).toHaveBeenCalledWith({
        id: 7,
        data: {
          answer:
            "I need consistency, and I also need direct communication.",
        },
      });
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["companion"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["matching-state"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["journey-summary"],
    });
  });
});
