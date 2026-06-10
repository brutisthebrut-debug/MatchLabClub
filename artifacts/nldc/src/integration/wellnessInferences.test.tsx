import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface Inference {
  id: number;
  dimension: string;
  inferredQuestionId: string;
  questionText: string;
  suggestedAnswer: string;
  sourceKind: string;
  rationale: string | null;
  mode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const now = new Date().toISOString();

const PENDING: Inference[] = [
  {
    id: 11,
    dimension: "emotional",
    inferredQuestionId: "inferred:emotional:1",
    questionText: "What helps you feel emotionally safe with someone?",
    suggestedAnswer: "I feel safest when someone is steady and gives me time.",
    sourceKind: "journal",
    rationale: "Noticed in your journal writing.",
    mode: "deterministic",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  },
];

let listData: { inferences: Inference[] } | undefined = { inferences: PENDING };

const generateMutate = vi.fn(async () => ({ created: 0, mode: "deterministic", inferences: [] }));
const confirmMutate = vi.fn(async (_args: { id: number; data?: { answer?: string } }) => ({
  confirmed: true,
}));
const dismissMutate = vi.fn(async (_args: { id: number }) => ({ dismissed: true }));

vi.mock("@workspace/api-client-react", () => ({
  useListWellnessInferences: () => ({ data: listData, isLoading: false }),
  getListWellnessInferencesQueryKey: () => ["wellness-inferences"],
  useGenerateWellnessInferences: () => ({ mutateAsync: generateMutate, isPending: false }),
  useConfirmWellnessInference: () => ({ mutateAsync: confirmMutate, isPending: false }),
  useDismissWellnessInference: () => ({ mutateAsync: dismissMutate, isPending: false }),
  getGetWellnessDailyQueryKey: () => ["wellness-daily"],
  getGetMatchingStateQueryKey: () => ["matching-state"],
}));

let authState = { isAuthenticated: true, isLoading: false, user: { id: "u1" } as unknown };

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => authState,
}));

// Import component AFTER mocks are registered.
import { WellnessInferences } from "@/components/WellnessInferences";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  listData = { inferences: structuredClone(PENDING) };
  authState = { isAuthenticated: true, isLoading: false, user: { id: "u1" } };
  generateMutate.mockClear();
  confirmMutate.mockClear();
  dismissMutate.mockClear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WellnessInferences (confirm-before-write)", () => {
  it("prefills the suggested answer and never writes without an explicit confirm", () => {
    render(
      <Wrap>
        <WellnessInferences />
      </Wrap>,
    );

    const input = screen.getByTestId("inference-input-11") as HTMLTextAreaElement;
    expect(input.value).toBe(PENDING[0]!.suggestedAnswer);
    // The mere act of rendering must not write anything.
    expect(confirmMutate).not.toHaveBeenCalled();
    expect(dismissMutate).not.toHaveBeenCalled();
  });

  it("confirm sends the edited answer and invalidates list + daily + matching", async () => {
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    render(
      <Wrap>
        <WellnessInferences />
      </Wrap>,
    );

    const input = screen.getByTestId("inference-input-11");
    fireEvent.change(input, { target: { value: "I feel safest with quiet steadiness." } });

    fireEvent.click(screen.getByTestId("inference-confirm-11"));

    await waitFor(() => {
      expect(confirmMutate).toHaveBeenCalledTimes(1);
    });
    expect(confirmMutate).toHaveBeenCalledWith({
      id: 11,
      data: { answer: "I feel safest with quiet steadiness." },
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0]);
    expect(invalidatedKeys).toContain("wellness-inferences");
    expect(invalidatedKeys).toContain("wellness-daily");
    expect(invalidatedKeys).toContain("matching-state");
  });

  it("dismiss sends only the id and does not write an answer", async () => {
    render(
      <Wrap>
        <WellnessInferences />
      </Wrap>,
    );

    fireEvent.click(screen.getByTestId("inference-dismiss-11"));

    await waitFor(() => {
      expect(dismissMutate).toHaveBeenCalledTimes(1);
    });
    expect(dismissMutate).toHaveBeenCalledWith({ id: 11 });
    expect(confirmMutate).not.toHaveBeenCalled();
  });

  it("generate looks for reflections without writing any answer", async () => {
    render(
      <Wrap>
        <WellnessInferences />
      </Wrap>,
    );

    fireEvent.click(screen.getByTestId("inferences-generate"));

    await waitFor(() => {
      expect(generateMutate).toHaveBeenCalledTimes(1);
    });
    expect(confirmMutate).not.toHaveBeenCalled();
  });

  it("shows non-actionable demo examples when there is nothing pending", () => {
    listData = { inferences: [] };

    render(
      <Wrap>
        <WellnessInferences />
      </Wrap>,
    );

    // Never empty: demo examples render, but they are not confirmable.
    expect(screen.getAllByTestId("inference-example").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("inference-input-11")).toBeNull();
  });

  it("anon sees a sign-in hint and the generate button is disabled", () => {
    authState = { isAuthenticated: false, isLoading: false, user: null };
    listData = undefined;

    render(
      <Wrap>
        <WellnessInferences />
      </Wrap>,
    );

    expect((screen.getByTestId("inferences-generate") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByTestId("inference-example").length).toBeGreaterThan(0);
  });
});
