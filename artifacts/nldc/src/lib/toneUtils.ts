export type ConfidenceLevel = "strong" | "moderate" | "limited";

export function getConfidenceLevel(charCount: number, fieldsFilled: number): ConfidenceLevel {
  if (charCount > 250 && fieldsFilled >= 2) return "strong";
  if (charCount > 100 || fieldsFilled >= 1) return "moderate";
  return "limited";
}
