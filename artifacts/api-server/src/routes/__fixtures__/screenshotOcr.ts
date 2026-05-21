/**
 * Pre-OCRed text fixtures that mimic what tesseract.js produces for screenshots
 * of dating-app profiles. Used by `audits.from-screenshot.test.ts` to drive
 * the `/api/audits/from-screenshot` route without invoking tesseract itself
 * (tesseract is heavy, slow, and non-deterministic across machines).
 *
 * Each fixture is a plausible OCR transcript including the usual UI noise
 * (clock, distance, "Send a Like" buttons). The route under test then runs
 * the deterministic `parseProfileText` on these strings via a mocked
 * `extractProfileFromScreenshot`.
 */

export const HINGE_OCR = `9:41
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

export const BUMBLE_OCR = `Bumble
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

export const TINDER_OCR = `Tinder
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

export const OKCUPID_OCR = `OkCupid
Jordan, 27
92% Match
Brooklyn, NY
Software engineer by day, amateur baker by night. I make a mean sourdough and I'm always chasing a new hiking trail.
My self-summary
Curious, easygoing, and probably overcaffeinated. Big fan of farmers markets and slow Sunday mornings.
You should message me if
You can recommend a great taco spot or want to debate the best Wes Anderson film.
Like
Pass
`;

export const UNREADABLE_OCR = `!!!
???
...
`;
