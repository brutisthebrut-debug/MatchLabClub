Test-only PNG fixtures for the opt-in real-OCR integration test
(`audits.from-screenshot.real-ocr.test.ts`). These run tesseract.js against a
committed image so we catch regressions in the OCR pipeline (worker setup,
image decoding, language data) that the mocked unit tests can't see.

One fixture per supported app layout:

| File               | App    | Name  | Age | Key bio words            |
|--------------------|--------|-------|-----|--------------------------|
| hinge-sample.png   | Hinge  | Sarah | 28  | hiking, coffee, sunday   |
| bumble-sample.png  | Bumble | Emma  | 25  | yoga, brunch, hikes      |
| tinder-sample.png  | Tinder | Jake  | 30  | foodie, traveler, adventure |

Regenerate with ImageMagick, e.g.:

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
