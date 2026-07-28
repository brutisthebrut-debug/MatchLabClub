import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { rememberPendingPlayRead } from "@/lib/onboardingState";
import { PlayConfirmationCard } from "./PlayConfirmationCard";

const mutations = vi.hoisted(() => ({
  create: vi.fn(),
  permissions: vi.fn(),
}));

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetMatchingStateQueryKey: () => ["matching-state"],
  getGetMirrorPortraitQueryKey: () => ["mirror-portrait"],
  getGetMySignalMapQueryKey: () => ["signal-map"],
  getListWellnessAnswersQueryKey: () => ["wellness-answers"],
  useCreateWellnessAnswer: () => ({
    isPending: false,
    mutateAsync: mutations.create,
  }),
  useUpdateWellnessAnswerPermissions: () => ({
    isPending: false,
    mutateAsync: mutations.permissions,
  }),
}));

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlayConfirmationCard />
    </QueryClientProvider>,
  );
}

describe("PlayConfirmationCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mutations.create.mockReset().mockResolvedValue({ id: 42 });
    mutations.permissions.mockReset().mockResolvedValue({ id: 42 });
    rememberPendingPlayRead({
      archetypeKey: "connector",
      archetypeName: "The Connector",
      summary: "You create warmth quickly and need that care returned.",
    });
  });

  it("keeps the derived read only after explicit Mirror and matching choices", async () => {
    renderCard();

    expect(screen.getByText("The Connector")).toBeTruthy();
    fireEvent.click(screen.getByTestId("play-confirmation-matching"));
    fireEvent.click(screen.getByTestId("play-confirmation-keep"));

    await waitFor(() => expect(mutations.permissions).toHaveBeenCalled());
    expect(mutations.create).toHaveBeenCalledWith({
      data: {
        questionId: "quiz:dating-signal-type",
        dimension: "emotional",
        category: "dating_style",
        questionText: "Which Dating Signal Type feels most like me?",
        answer:
          "The Connector: You create warmth quickly and need that care returned.",
      },
    });
    expect(mutations.permissions).toHaveBeenCalledWith({
      id: 42,
      data: { echo: true, mirror: true, matching: true },
    });
    expect(screen.queryByTestId("play-confirmation")).toBeNull();
    expect(screen.getByTestId("play-confirmation-next")).toBeTruthy();
  });

  it("dismisses the read without saving anything", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("play-confirmation-dismiss"));

    expect(mutations.create).not.toHaveBeenCalled();
    expect(mutations.permissions).not.toHaveBeenCalled();
    expect(screen.queryByTestId("play-confirmation")).toBeNull();
  });
});
