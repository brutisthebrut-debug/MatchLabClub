export interface AuditEvidenceInput {
  age?: number | null;
  bio?: string | null;
  prompts?: string | null;
}

export type AuditEvidenceResult =
  | { sufficient: true; reasons: []; fields: [] }
  | { sufficient: false; reasons: string[]; fields: string[] };

const PLACEHOLDER_ONLY =
  /^(?:n\/?a|none|nothing|test(?:ing)?|sample|placeholder|bio|asdf+|todo|tbd|unknown|skip|no bio)[.!\s]*$/i;

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

/**
 * Evidence gate shared by every audit-generation path. Saving a source and
 * generating an inference are intentionally different actions: weak input may
 * exist as a source record, but it must never produce a confident profile read.
 */
export function assessAuditEvidence(
  input: AuditEvidenceInput,
): AuditEvidenceResult {
  const reasons: string[] = [];
  const fields = new Set<string>();
  const bio = input.bio?.trim() ?? "";
  const words = normalizedWords(bio);
  const uniqueWords = new Set(words);
  const alphaCount = (bio.match(/[a-z]/gi) ?? []).length;

  if (
    bio.length < 40 ||
    words.length < 8 ||
    uniqueWords.size < 6 ||
    alphaCount < 30
  ) {
    fields.add("bio");
    reasons.push(
      "Add a real bio with at least a couple of specific sentences so the read has enough evidence.",
    );
  }

  if (
    PLACEHOLDER_ONLY.test(bio) ||
    /^https?:\/\/\S+$/i.test(bio) ||
    (bio.length > 0 && alphaCount / bio.length < 0.45)
  ) {
    fields.add("bio");
    reasons.push(
      "The bio looks like placeholder text or the wrong format. Paste the words a person would actually read on the profile.",
    );
  }

  const age = input.age;
  if (!Number.isInteger(age) || (age ?? 0) < 18 || (age ?? 0) > 100) {
    fields.add("age");
    reasons.push("Use an adult age between 18 and 100.");
  }

  const statedAge = /\b(?:i(?:'m| am)\s+)(\d{1,3})\b/i.exec(bio);
  if (
    statedAge &&
    Number.isInteger(age) &&
    Number(statedAge[1]) >= 18 &&
    Number(statedAge[1]) <= 100 &&
    Number(statedAge[1]) !== age
  ) {
    fields.add("age");
    fields.add("bio");
    reasons.push(
      "The age in the bio conflicts with the age field. Correct one before generating the read.",
    );
  }

  if (reasons.length > 0) {
    return {
      sufficient: false,
      reasons: Array.from(new Set(reasons)),
      fields: Array.from(fields),
    };
  }

  return { sufficient: true, reasons: [], fields: [] };
}
