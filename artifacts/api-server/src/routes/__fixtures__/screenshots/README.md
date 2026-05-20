Test-only PNG fixtures for the opt-in real-OCR integration test
(`audits.from-screenshot.real-ocr.test.ts`). These run tesseract.js against a
committed image so we catch regressions in the OCR pipeline (worker setup,
image decoding, language data) that the mocked unit tests can't see.

Regenerate with ImageMagick, e.g.:

```
magick -size 600x400 xc:white -font DejaVu-Sans -pointsize 28 -fill black \
  -annotate +20+50 "Hinge" \
  -annotate +20+100 "Sarah" \
  -annotate +20+140 "28" \
  -annotate +20+200 "About me" \
  -annotate +20+240 "I love hiking and coffee on" \
  -annotate +20+275 "slow Sunday mornings." \
  -annotate +20+340 "Send Like" \
  hinge-sample.png
```
