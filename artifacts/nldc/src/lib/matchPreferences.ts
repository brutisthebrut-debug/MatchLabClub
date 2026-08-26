export const MATCH_RADIUS_PRESETS = [
  { value: "any", label: "Any distance" },
  { value: "40", label: "Within 25 miles" },
  { value: "56", label: "Within 35 miles" },
  { value: "72", label: "Within 45 miles" },
] as const;

export const MATCH_GENDER_OPTIONS = [
  "any",
  "women",
  "men",
  "nonbinary",
  "trans-women",
  "trans-men",
] as const;

export function snapMatchRadiusKm(km: number | null | undefined): string {
  if (km == null) return "any";

  let nearest: (typeof MATCH_RADIUS_PRESETS)[number] = MATCH_RADIUS_PRESETS[1];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const preset of MATCH_RADIUS_PRESETS) {
    if (preset.value === "any") continue;
    const distance = Math.abs(Number(preset.value) - km);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = preset;
    }
  }
  return nearest.value;
}

export function normalizeMatchGenderPreference(
  value: string | null | undefined,
): string {
  if (!value) return "any";
  return (MATCH_GENDER_OPTIONS as readonly string[]).includes(value)
    ? value
    : "any";
}

export function parseMatchPreferenceLines(value: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const part of value.split(/[\n,]+/)) {
    const item = part.trim().slice(0, 120);
    const key = item.toLocaleLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length === 50) break;
  }

  return items;
}

export function isValidMatchAgeRange(ageMin: number, ageMax: number): boolean {
  return (
    Number.isInteger(ageMin) &&
    Number.isInteger(ageMax) &&
    ageMin >= 18 &&
    ageMax <= 120 &&
    ageMin <= ageMax
  );
}
