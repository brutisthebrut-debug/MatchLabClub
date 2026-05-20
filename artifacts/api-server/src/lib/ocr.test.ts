import { test } from "vitest";
import assert from "node:assert/strict";
import { parseProfileText } from "./profileParser.ts";

// ---------------------------------------------------------------------------
// Fixtures: representative OCR transcripts. These mimic what tesseract.js
// actually produces for the top three dating apps, including the usual noise
// (clock, battery, UI chrome, stray fragments).
// ---------------------------------------------------------------------------

const HINGE_FIXTURE_1 = `
9:41
Sarah
28
5'7"
Brooklyn, NY
Marketing Manager
I'm looking for
Someone who takes me on adventures but also loves a quiet Sunday morning.
Send Like
My simple pleasures
Cold brew on a sunny patio and bookstore browsing for hours.
Send Like
Two truths and a lie
I've climbed Kilimanjaro, I'm fluent in French, I hate chocolate.
Send Like
`;

const HINGE_FIXTURE_2 = `
James, 32
6'1"
Software Engineer
3 miles away
Hinge
Dating me is like
Trying every taco truck in the city and arguing about which is best.
Send a Like
The way to win me over is
Bringing your dog along.
Send a Like
A green flag I look for
Someone who texts back without games.
Send a Like
`;

const HINGE_FIXTURE_3 = `
Priya
26
Designer
Located in Austin
First round is on me if
You can name three movies Wes Anderson made.
My most irrational fear
Escalators going down.
I'll know I've found the one when
We can do nothing together and it still feels like everything.
Send Like
`;

const BUMBLE_FIXTURE_1 = `
Bumble
Emma, 29
5'6"
Yoga Instructor
About me
Sun-chaser, dog-mom, weekend hiker. I make a mean breakfast burrito.
My ideal first date
A walk through the farmers market and then coffee somewhere quiet.
What I'm looking for
Long-term
Send a Compliment
`;

const BUMBLE_FIXTURE_2 = `
Daniel
31
2 miles away
Bumble
About me
Architect by day, amateur baker by night. Always planning the next trip.
The way to my heart is
Trying new restaurants and disagreeing about the wine.
A boundary of mine is
No phones at dinner.
Send a Compliment
`;

const BUMBLE_FIXTURE_3 = `
Aaliyah, 27
Bumble
About me
Just moved here from Atlanta. Looking for someone to explore the city with.
After work you can find me
At a pottery class or rewatching The Office.
My pet peeve
People who don't use turn signals.
Send a Compliment
`;

const TINDER_FIXTURE_1 = `
Tinder
Mia 24
2 mi away
About Mia
I take my coffee black and my mornings slow.
Looking for: Long-term, open to short
Anthem
Mr. Brightside — The Killers
Passions
Hiking
Coffee
Live Music
`;

const TINDER_FIXTURE_2 = `
Carlos, 30
Tinder
5 km away
About me
Salsa dancer, dog dad, terrible at chess. Trying anyway.
My anthem
Despacito — Luis Fonsi
My interests
Cooking
Travel
Soccer
Looking for: Something casual
`;

const TINDER_FIXTURE_3 = `
Tinder
Zoe
22
About Zoe
Art student. Sketching strangers on the subway is my hobby.
Passions
Painting
Museums
Vintage shops
The key to my heart
Bring me a really good croissant.
`;

// ---------------------------------------------------------------------------
// Hinge
// ---------------------------------------------------------------------------

test("Hinge — extracts name, age, app and pairs prompt with answer", () => {
  const out = parseProfileText(HINGE_FIXTURE_1);
  assert.equal(out.firstName, "Sarah");
  assert.equal(out.age, 28);
  assert.equal(out.sourceApp, "Hinge");
  assert.ok(out.prompts.length >= 3, `expected >=3 prompts, got ${out.prompts.length}`);
  assert.ok(
    out.prompts.some((p) => /i'm looking for/i.test(p) && /adventures/i.test(p)),
    "prompt should be paired with its answer",
  );
  assert.ok(!/Send Like/i.test(out.bio), "UI chrome should not leak into bio");
});

test("Hinge — name+age on a single line, ignores UI chrome", () => {
  const out = parseProfileText(HINGE_FIXTURE_2);
  assert.equal(out.firstName, "James");
  assert.equal(out.age, 32);
  assert.equal(out.sourceApp, "Hinge");
  assert.ok(out.prompts.some((p) => /dating me is like/i.test(p) && /taco/i.test(p)));
  assert.ok(out.prompts.some((p) => /green flag/i.test(p)));
  assert.ok(!/Send a Like/i.test(out.bio));
});

test("Hinge — handles name and age on separate lines", () => {
  const out = parseProfileText(HINGE_FIXTURE_3);
  assert.equal(out.firstName, "Priya");
  assert.equal(out.age, 26);
  assert.equal(out.sourceApp, "Hinge");
  assert.ok(out.prompts.length >= 3);
  assert.ok(out.prompts.some((p) => /first round/i.test(p) && /wes anderson/i.test(p.toLowerCase())));
});

// ---------------------------------------------------------------------------
// Bumble
// ---------------------------------------------------------------------------

test("Bumble — explicit app name + Send a Compliment is recognized", () => {
  const out = parseProfileText(BUMBLE_FIXTURE_1);
  assert.equal(out.firstName, "Emma");
  assert.equal(out.age, 29);
  assert.equal(out.sourceApp, "Bumble");
  assert.ok(/breakfast burrito/i.test(out.bio), "About me text becomes bio");
  assert.ok(!/about me/i.test(out.bio), "About me header itself is stripped");
  assert.ok(out.prompts.some((p) => /ideal first date/i.test(p) && /farmers market/i.test(p)));
});

test("Bumble — separate-line name/age + multiple prompts", () => {
  const out = parseProfileText(BUMBLE_FIXTURE_2);
  assert.equal(out.firstName, "Daniel");
  assert.equal(out.age, 31);
  assert.equal(out.sourceApp, "Bumble");
  assert.ok(/architect by day/i.test(out.bio));
  assert.ok(out.prompts.some((p) => /way to my heart/i.test(p)));
  assert.ok(out.prompts.some((p) => /boundary of mine/i.test(p)));
});

test("Bumble — short profile with two prompts", () => {
  const out = parseProfileText(BUMBLE_FIXTURE_3);
  assert.equal(out.firstName, "Aaliyah");
  assert.equal(out.age, 27);
  assert.equal(out.sourceApp, "Bumble");
  assert.ok(/just moved here/i.test(out.bio));
  assert.ok(out.prompts.some((p) => /after work/i.test(p) && /pottery/i.test(p)));
  assert.ok(out.prompts.some((p) => /pet peeve/i.test(p)));
});

// ---------------------------------------------------------------------------
// Tinder
// ---------------------------------------------------------------------------

test("Tinder — detects app + name/age + colon-style prompts", () => {
  const out = parseProfileText(TINDER_FIXTURE_1);
  assert.equal(out.firstName, "Mia");
  assert.equal(out.age, 24);
  assert.equal(out.sourceApp, "Tinder");
  assert.ok(/coffee black/i.test(out.bio));
  assert.ok(out.prompts.some((p) => /looking for/i.test(p) && /long-term/i.test(p)));
  assert.ok(out.prompts.some((p) => /anthem/i.test(p) && /killers/i.test(p)));
});

test("Tinder — comma-style name/age and casual goal", () => {
  const out = parseProfileText(TINDER_FIXTURE_2);
  assert.equal(out.firstName, "Carlos");
  assert.equal(out.age, 30);
  assert.equal(out.sourceApp, "Tinder");
  assert.ok(/salsa dancer/i.test(out.bio));
  assert.ok(out.prompts.some((p) => /anthem/i.test(p) && /despacito/i.test(p)));
  assert.ok(out.prompts.some((p) => /looking for/i.test(p) && /casual/i.test(p)));
});

test("Tinder — Passions header and a prompt+answer pair", () => {
  const out = parseProfileText(TINDER_FIXTURE_3);
  assert.equal(out.firstName, "Zoe");
  assert.equal(out.age, 22);
  assert.equal(out.sourceApp, "Tinder");
  assert.ok(/art student/i.test(out.bio));
  assert.ok(out.prompts.some((p) => /key to my heart/i.test(p) && /croissant/i.test(p)));
});

// ---------------------------------------------------------------------------
// Negative / edge cases
// ---------------------------------------------------------------------------

test("Returns nulls when no name/age and no app are present", () => {
  const out = parseProfileText("just some random bio text without anything identifiable here");
  assert.equal(out.firstName, null);
  assert.equal(out.age, null);
  assert.equal(out.sourceApp, null);
});
