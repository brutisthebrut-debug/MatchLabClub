export type SourceApp = "Hinge" | "Bumble" | "Tinder" | "CoffeeMeetsBagel";

export interface ParsedProfile {
  firstName: string | null;
  age: number | null;
  sourceApp: SourceApp | null;
  bio: string;
  prompts: string[];
}

/**
 * Rules learned from aggregated user OCR corrections. Optional input to
 * `parseProfileText` — when provided, the parser uses them to fix common
 * OCR mistakes before returning (so future scans don't re-record the same
 * mismatch). See `ocrLearning.ts` for how these are derived and persisted.
 */
export interface ParserLearnedRules {
  nameSubstitutions: Map<string, string>;
  sourceAppOverrides: Map<SourceApp, SourceApp>;
  promptAdditions: Set<string>;
}

const NO_RULES: ParserLearnedRules = {
  nameSubstitutions: new Map(),
  sourceAppOverrides: new Map(),
  promptAdditions: new Set(),
};

// ---------------------------------------------------------------------------
// Prompt dictionaries
// ---------------------------------------------------------------------------

const HINGE_PROMPTS = [
  "the way to win me over is",
  "i'm looking for",
  "a green flag i look for",
  "my simple pleasures",
  "we'll get along if",
  "i go crazy for",
  "the key to my heart is",
  "my most irrational fear",
  "two truths and a lie",
  "dating me is like",
  "my love language is",
  "i quote too much from",
  "i'll know i've found the one when",
  "the best way to ask me out is by",
  "what makes a good relationship great",
  "first round is on me if",
  "the dorkiest thing about me is",
  "fact about me that surprises people",
  "i'm convinced that",
  "my favorite quality in a person",
  "all i ask is that you",
  "a shower thought i recently had",
  "i won't shut up about",
  "the hallmark of a good relationship",
  "typical sunday",
  "my therapist would say",
  "my greatest strength",
  "change my mind about",
  "the one thing i'd love to know about you",
  "give me travel tips for",
  "i'm weirdly attracted to",
  "best travel story",
  "biggest risk i've taken",
  "unusual skills",
  "the world would be a better place with more",
];

const BUMBLE_PROMPTS = [
  "my ideal first date",
  "my most controversial opinion is",
  "i get along best with people who",
  "the secret to getting to know me is",
  "after work you can find me",
  "perfect first date",
  "what i'm looking for",
  "i'll fall for you if",
  "a boundary of mine is",
  "i'm hoping you",
  "we're the same type of weird if",
  "i'll brag about you to my friends if",
  "this year i really want to",
  "my self-care",
  "the way to my heart is",
  "i quote way too much from",
  "you should leave a comment if",
  "my pet peeve",
  "a random fact i love is",
];

const TINDER_PROMPTS = [
  "looking for",
  "the way to win me over",
  "my anthem",
  "anthem",
  "my interests",
  "interests",
  "passions",
  "i'm a sucker for",
  "you should know that i",
  "my unusual skill",
  "i recently discovered that",
  "the key to my heart",
];

const ALL_PROMPTS = [...HINGE_PROMPTS, ...BUMBLE_PROMPTS, ...TINDER_PROMPTS];

// Lines that mark the start of the bio paragraph but aren't prompts themselves.
// We drop them and continue collecting subsequent text into the bio.
const BIO_HEADERS: RegExp[] = [
  /^about me$/i,
  /^about [A-Z][a-zA-Z'’\-]+$/, // "About Mia" — Tinder name header
];

function isBioHeader(line: string): boolean {
  return BIO_HEADERS.some((rx) => rx.test(line));
}

const UI_NOISE_PATTERNS: RegExp[] = [
  /^send like$/i,
  /^send a like$/i,
  /^send a compliment$/i,
  /^like$/i,
  /^pass$/i,
  /^nope$/i,
  /^super ?like$/i,
  /^message$/i,
  /^reply$/i,
  /^say something nice/i,
  /^add a comment/i,
  /^report$/i,
  /^block$/i,
  /^unmatch$/i,
  /^it'?s a match/i,
  /^view profile$/i,
  /^edit profile$/i,
  /^\d{1,2}:\d{2}\s*(am|pm)?$/i,
  /^[•·●○◆■\s]+$/,
  /^[©®™@#]+$/,
  /^[\d\s%]+$/,
  /^[a-z]{1,2}$/i,
];

const APP_NAME_RX = /\b(hinge|bumble|tinder)\b/i;
const CMB_RX = /coffee\s+meets\s+bagel/i;

function normalize(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function isNoise(line: string): boolean {
  if (line.length < 2) return true;
  return UI_NOISE_PATTERNS.some((rx) => rx.test(line));
}

function startsWithAnyPrompt(line: string, dict: readonly string[]): boolean {
  const l = line.toLowerCase();
  return dict.some((p) => l.startsWith(p));
}

function isPromptQuestion(line: string, learned: ReadonlySet<string>): boolean {
  if (line.length > 90) return false;
  const l = line.toLowerCase();
  for (const p of learned) {
    if (l.startsWith(p)) return true;
  }
  // Require the prompt phrase to anchor at the start of the line so a bio
  // sentence like "Just moved here. Looking for someone..." isn't misread.
  return startsWithAnyPrompt(line, ALL_PROMPTS);
}

export function detectSourceApp(lines: string[]): SourceApp | null {
  const text = lines.join("\n");
  const lower = text.toLowerCase();
  const scores: Record<SourceApp, number> = { Hinge: 0, Bumble: 0, Tinder: 0, CoffeeMeetsBagel: 0 };

  const named = APP_NAME_RX.exec(text);
  if (named) {
    const cap = (named[1][0].toUpperCase() + named[1].slice(1).toLowerCase()) as SourceApp;
    scores[cap] += 4;
  }

  if (/send (a )?like/i.test(text)) scores.Hinge += 3;
  if (/\bhinge\b/i.test(text)) scores.Hinge += 3;
  for (const p of HINGE_PROMPTS) if (lower.includes(p)) scores.Hinge += 1;

  if (/send a compliment/i.test(text)) scores.Bumble += 3;
  if (/^about me$/im.test(text)) scores.Bumble += 2;
  if (/\bbumble\b/i.test(text)) scores.Bumble += 3;
  for (const p of BUMBLE_PROMPTS) if (lower.includes(p)) scores.Bumble += 1;

  if (/\btinder\b/i.test(text)) scores.Tinder += 3;
  if (/it'?s a match/i.test(text)) scores.Tinder += 2;
  if (/^anthem$/im.test(text)) scores.Tinder += 2;
  if (/^passions$/im.test(text)) scores.Tinder += 2;
  if (/^my interests$/im.test(text)) scores.Tinder += 2;
  for (const p of TINDER_PROMPTS) if (lower.includes(p)) scores.Tinder += 1;

  if (CMB_RX.test(text)) scores.CoffeeMeetsBagel += 5;
  if (/\bcmb\b/.test(text)) scores.CoffeeMeetsBagel += 3;
  if (/\bbagel\b/i.test(text)) scores.CoffeeMeetsBagel += 3;
  if (/^connect$/im.test(text)) scores.CoffeeMeetsBagel += 2;
  if (/bagel of the day/i.test(text)) scores.CoffeeMeetsBagel += 3;

  const metaLine = /^(\d['′][\s]?\d{1,2}["″]?|\d{1,3}\s?cm|\d+\s?mi(les)?\s?away|located in)/i;
  const metaCount = lines.filter((l) => metaLine.test(l)).length;
  if (metaCount >= 2) scores.Hinge += 1;

  let best: SourceApp | null = null;
  let bestScore = 0;
  for (const k of Object.keys(scores) as SourceApp[]) {
    if (scores[k] > bestScore) {
      bestScore = scores[k];
      best = k;
    }
  }
  return bestScore >= 2 ? best : null;
}

const NAME_RX = /^([A-Z][a-zA-Z'’\-]{1,20})(?:\s+([A-Z][a-zA-Z'’\-]{1,20}))?$/;
const NAME_AGE_RX = /^([A-Z][a-zA-Z'’\-]{1,20})[,\s]+(\d{2})\b/;
const STANDALONE_AGE_RX = /^(\d{2})$/;

const NAME_BLOCKLIST = new Set([
  "About", "Hinge", "Bumble", "Tinder", "Like", "Pass", "Match", "Send",
  "Looking", "My", "The", "What", "Why", "How", "When", "Home", "Profile",
  "Settings", "Edit", "View", "Photos", "Photo", "Reply", "Message",
  "Likes", "Compliment", "Anthem", "Passions", "Bagel", "Connect", "Coffee",
]);

function isPlausibleAge(n: number): boolean {
  return n >= 18 && n <= 75;
}

function extractNameAndAge(lines: string[]): { firstName: string | null; age: number | null } {
  const head = lines.slice(0, 8);

  for (let i = 0; i < head.length; i++) {
    const line = head[i];
    const both = NAME_AGE_RX.exec(line);
    if (both) {
      const name = both[1];
      const age = parseInt(both[2], 10);
      if (!NAME_BLOCKLIST.has(name) && isPlausibleAge(age)) {
        return { firstName: name, age };
      }
    }
    const nameOnly = NAME_RX.exec(line);
    if (nameOnly && !NAME_BLOCKLIST.has(nameOnly[1])) {
      const next = head[i + 1];
      if (next) {
        const ageMatch = STANDALONE_AGE_RX.exec(next);
        if (ageMatch) {
          const age = parseInt(ageMatch[1], 10);
          if (isPlausibleAge(age)) {
            return { firstName: nameOnly[1], age };
          }
        }
      }
    }
  }

  for (const line of head) {
    const nameOnly = NAME_RX.exec(line);
    if (nameOnly && !NAME_BLOCKLIST.has(nameOnly[1])) {
      return { firstName: nameOnly[1], age: null };
    }
  }
  return { firstName: null, age: null };
}

function isMetadataLine(line: string): boolean {
  if (/^\d['′]\s?\d{1,2}["″]?$/.test(line)) return true;
  if (/^\d{1,3}\s?cm$/i.test(line)) return true;
  if (/^\d+\s?mi(les)?\s?away$/i.test(line)) return true;
  if (/^\d+\s?km\s?away$/i.test(line)) return true;
  if (/^(located in|lives in)\b/i.test(line)) return true;
  if (/^(non[- ]?monogamy|monogamy|relationship|short[- ]term|long[- ]term|life ?partner)$/i.test(line)) return true;
  if (/^(straight|gay|bisexual|queer|pansexual|lesbian)$/i.test(line)) return true;
  if (/^(woman|man|non[- ]?binary|nb)$/i.test(line)) return true;
  return false;
}

function splitBioAndPrompts(
  lines: string[],
  skipHead: number,
  learnedPrompts: ReadonlySet<string>,
): { bio: string; prompts: string[] } {
  const bioLines: string[] = [];
  const prompts: string[] = [];
  const body = lines.slice(skipHead);

  let i = 0;
  while (i < body.length) {
    const line = body[i];
    if (isNoise(line) || isMetadataLine(line) || isBioHeader(line)) {
      i++;
      continue;
    }

    if (isPromptQuestion(line, learnedPrompts)) {
      let j = i + 1;
      while (j < body.length && (isNoise(body[j]) || isMetadataLine(body[j]))) j++;
      const answer = j < body.length && !isPromptQuestion(body[j], learnedPrompts) ? body[j] : null;
      prompts.push(answer ? `${line} ${answer}` : line);
      i = answer ? j + 1 : i + 1;
      continue;
    }

    const colonPrompt = /^(looking for|anthem|passions|my interests|about me|height|job title|education)\s*[:\-]/i;
    if (colonPrompt.test(line)) {
      prompts.push(line);
      i++;
      continue;
    }

    if (line.length >= 8) {
      bioLines.push(line);
    }
    i++;
  }

  const cleanedBio = bioLines
    .filter((l) => !/^about me$/i.test(l))
    .filter((l) => !/^about [A-Z][a-zA-Z'’\-]+$/.test(l)) // "About Mia" Tinder header
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { bio: cleanedBio, prompts };
}

export function parseProfileText(
  rawText: string,
  learnedRules: ParserLearnedRules = NO_RULES,
): ParsedProfile {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalize)
    .filter((l) => l.length > 0);

  let sourceApp = detectSourceApp(lines);
  let { firstName, age } = extractNameAndAge(lines);

  // Apply learned rules: fix common OCR mistakes captured from prior
  // user corrections, so the parser produces the corrected value on the
  // first try and no mismatch is recorded downstream.
  if (firstName) {
    const sub = learnedRules.nameSubstitutions.get(firstName.toLowerCase());
    if (sub) firstName = sub;
  }
  if (sourceApp) {
    const override = learnedRules.sourceAppOverrides.get(sourceApp);
    if (override) sourceApp = override;
  }

  let skipHead = 0;
  if (firstName) {
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      if (lines[i].toLowerCase().includes(firstName.toLowerCase())) {
        skipHead = i + 1;
        if (age !== null && i + 1 < lines.length && STANDALONE_AGE_RX.test(lines[i + 1])) {
          skipHead = i + 2;
        }
        break;
      }
    }
  }

  const { bio, prompts } = splitBioAndPrompts(
    lines,
    skipHead,
    learnedRules.promptAdditions,
  );
  return { firstName, age, sourceApp, bio, prompts };
}
