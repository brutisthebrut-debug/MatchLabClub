Test-only PNG fixtures for the opt-in real-OCR integration tests. These run
tesseract.js against committed images so we catch regressions in the OCR
pipeline (worker setup, image decoding, language data, noise filtering) that
the mocked unit tests can't see.

One fixture per supported app layout:

| File                  | App              | Name  | Age | Key bio words                  |
|-----------------------|------------------|-------|-----|--------------------------------|
| hinge-sample.png      | Hinge            | Sarah | 28  | hiking, coffee, sunday         |
| bumble-sample.png     | Bumble           | Emma  | 25  | yoga, brunch, hikes            |
| tinder-sample.png     | Tinder           | Jake  | 30  | foodie, traveler, adventure    |
| cmb-sample.png        | CoffeeMeetsBagel | Mia   | 27  | bookworm, coffee, sunday reads |
| okcupid-sample.png    | OkCupid          | Lily  | 26  | travel, music, outdoors        |

Run the gated tests with:

  RUN_OCR_E2E=1 pnpm --filter @workspace/api-server test

---

## hinge-sample.png

Used by `audits.from-screenshot.real-ocr.test.ts` — exercises the profile OCR
pipeline (`extractProfileFromScreenshot`). Asserts firstName, age, sourceApp,
and bio keywords.

Regenerate with ImageMagick:

```
# Hinge
magick -size 600x400 xc:white -font DejaVu-Sans -pointsize 28 -fill black \
  -annotate +20+50 "Hinge" \
  -annotate +20+100 "Sarah" \
  -annotate +20+140 "28" \
  -annotate +20+200 "About me" \
  -annotate +20+240 "I love hiking and coffee on" \
  -annotate +20+275 "slow Sunday mornings." \
  -annotate +20+340 "Send Like" \
  hinge-sample.png

# Bumble
magick -size 600x500 xc:white -font DejaVu-Sans -pointsize 28 -fill black \
  -annotate +20+50 "Bumble" \
  -annotate +20+100 "Emma, 25" \
  -annotate +20+160 "About me" \
  -annotate +20+210 "Yoga teacher who loves brunch and" \
  -annotate +20+250 "weekend hikes." \
  -annotate +20+310 "My ideal first date" \
  -annotate +20+350 "Coffee and a walk in the park." \
  -annotate +20+430 "Send a compliment" \
  bumble-sample.png

# Tinder
magick -size 600x500 xc:white -font DejaVu-Sans -pointsize 28 -fill black \
  -annotate +20+50 "Tinder" \
  -annotate +20+100 "Jake, 30" \
  -annotate +20+160 "About Jake" \
  -annotate +20+210 "Foodie and traveler always chasing" \
  -annotate +20+250 "the next adventure." \
  -annotate +20+310 "Passions" \
  -annotate +20+350 "Cooking, Travel, Photography" \
  -annotate +20+430 "It's a match" \
  tinder-sample.png
```

---

## cmb-sample.png

Used by `audits.from-screenshot.real-ocr.test.ts` — exercises the Coffee Meets
Bagel OCR path. Asserts firstName (Mia), age (27), sourceApp (CoffeeMeetsBagel),
and bio keywords.

Regenerate with ImageMagick:

```
magick -size 600x420 xc:white -font DejaVu-Sans -pointsize 28 -fill black \
  -annotate +20+55  "Coffee Meets Bagel" \
  -annotate +20+110 "Mia, 27" \
  -annotate +20+170 "Bookworm who loves spontaneous coffee" \
  -annotate +20+210 "runs and lazy Sunday reads." \
  -annotate +20+280 "Bagel of the Day" \
  -annotate +20+350 "Connect" \
  cmb-sample.png
```

---

## okcupid-sample.png

Used by `audits.from-screenshot.real-ocr.test.ts` — exercises the OkCupid OCR
path. Asserts firstName (Lily), age (26), sourceApp (OkCupid), and bio keywords.

Regenerate with ImageMagick:

```
magick -size 600x520 xc:white -font DejaVu-Sans -pointsize 28 -fill black \
  -annotate +20+55  "OkCupid" \
  -annotate +20+110 "Lily, 26" \
  -annotate +20+160 "89% Match" \
  -annotate +20+220 "My self-summary" \
  -annotate +20+265 "Travel addict who lives for live music and" \
  -annotate +20+305 "long hikes in the outdoors." \
  -annotate +20+365 "I spend a lot of time thinking about" \
  -annotate +20+410 "How to make every weekend an adventure." \
  -annotate +20+470 "Like" \
  -annotate +300+470 "Pass" \
  okcupid-sample.png
```

---

## tinder-chat-sample.png

Used by `audits.from-screenshot.chat-ocr.test.ts` — exercises the chat OCR
pipeline (`extractChatFromScreenshot`). Asserts sourceApp detection (Tinder),
that conversation lines are preserved, and that UI noise (timestamps, delivery
receipts, send button, day dividers) is stripped from `conversationText`.

Regenerate with ImageMagick:

```
magick -size 600x500 xc:white -font DejaVu-Sans -pointsize 22 -fill black \
  -annotate +20+40  "Tinder" \
  -annotate +20+90  "It's a match!" \
  -annotate +20+140 "Hey, how are you doing?" \
  -annotate +20+185 "3:45 PM" \
  -annotate +20+230 "I'm doing great, thanks for asking!" \
  -annotate +20+275 "Would love to grab coffee sometime." \
  -annotate +20+320 "Today" \
  -annotate +20+365 "That sounds amazing, I know a great spot!" \
  -annotate +20+410 "Delivered" \
  -annotate +20+455 "Send" \
  tinder-chat-sample.png
```

---

## bumble-chat-sample.png

Used by `audits.from-screenshot.chat-ocr.test.ts` — exercises the Bumble chat
OCR path. Asserts sourceApp detection (Bumble) and that Bumble-specific noise
("Send a compliment") is stripped from `conversationText`.

Regenerate with ImageMagick:

```
magick -size 600x520 xc:white -font DejaVu-Sans -pointsize 22 -fill black \
  -annotate +20+40  "Bumble" \
  -annotate +20+90  "Hey! Loved your profile!" \
  -annotate +20+135 "2:30 PM" \
  -annotate +20+180 "Thank you! Your photos are great too." \
  -annotate +20+225 "Would you want to grab brunch sometime?" \
  -annotate +20+270 "Today" \
  -annotate +20+315 "Yes, I know a perfect place downtown!" \
  -annotate +20+360 "Delivered" \
  -annotate +20+405 "Send a compliment" \
  -annotate +20+455 "Send" \
  bumble-chat-sample.png
```

---

## hinge-chat-sample.png

Used by `audits.from-screenshot.chat-ocr.test.ts` — exercises the Hinge chat
OCR path. Asserts sourceApp detection (Hinge) and that Hinge-specific noise
("Send Like", "Reply") is stripped from `conversationText`.

Regenerate with ImageMagick:

```
magick -size 600x520 xc:white -font DejaVu-Sans -pointsize 22 -fill black \
  -annotate +20+40  "Hinge" \
  -annotate +20+90  "Your dog is so cute, what breed?" \
  -annotate +20+135 "4:15 PM" \
  -annotate +20+180 "Ha, thanks! She is a golden retriever." \
  -annotate +20+225 "Would love to take her for a hike together." \
  -annotate +20+270 "Today" \
  -annotate +20+315 "That sounds like a perfect first date!" \
  -annotate +20+360 "Delivered" \
  -annotate +20+405 "Send Like" \
  -annotate +20+455 "Reply" \
  hinge-chat-sample.png
```
