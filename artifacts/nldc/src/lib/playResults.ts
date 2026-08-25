import type { SavedQuizResult } from "@/lib/quizzes";

export interface DurableQuizResult extends SavedQuizResult {
  id: number;
  dimensions: string[];
  learningConfirmed: boolean;
  echoUseAllowed: boolean;
  matchingUseAllowed: boolean;
  uploadedAt: string;
}

export async function getDurableQuizResults(): Promise<DurableQuizResult[]> {
  const response = await fetch("/api/me/quiz-results", { credentials: "include" });
  const body = (await response.json().catch(() => null)) as { results?: DurableQuizResult[]; error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Saved quiz results could not load.");
  return body?.results ?? [];
}
