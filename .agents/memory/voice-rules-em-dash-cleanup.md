---
name: Em-dash voice cleanup
description: How to safely remove em dashes from user-facing copy without creating comma splices
---

# Removing em dashes from user-facing copy

The hard voice rule (replit.md): no em dashes anywhere in user-facing copy. Em dashes live only in content data libs under `artifacts/nldc/src/lib/` (quizzes, blogArticles, wellnessQuestionBank, navigationCatalog); pages/ and components/ are already clean.

**Rule:** do NOT blanket-replace every em dash with a comma. The correct replacement depends on what the em dash was doing:
- Paired aside (`text — aside — text`) → wrap the aside in parentheses.
- Example list intro (`label — a, b, c`) → colon.
- Two independent clauses (`X — it's Y`, `X — they're Y`) → period or semicolon, NOT a comma (comma creates a splice).
- True appositive / "X, and Y" / "Not X, but Y" → comma is fine.

**Why:** a blunt " — " → ", " sed pass passes typecheck/lint (string content) but ships comma splices and weak CTA microcopy into showcased blog/quiz/wellness content. A code-review architect flagged exactly this. Comma splices are a quality regression the founder cares about.

**How to apply:** run the bulk pass for the safe cases (parens for paired, comma for the rest), then read the git diff of the changed content files and hand-correct clause-joins to periods and example-lists to colons. Conversational quiz answer/label fragments (e.g. "Fast, I'm all-in by date three") read fine with commas and can be left. Em dashes left in code comments do not violate the rule (not user-facing).
