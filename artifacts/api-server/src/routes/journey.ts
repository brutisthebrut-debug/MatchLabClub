import { Router, type IRouter } from "express";
import { summarizeUserJourney } from "../lib/journeyEvents";

const router: IRouter = Router();

// The signed-in user's own weekly momentum recap. Scoped strictly to the
// caller: the summarizer only ever reads rows where user_id is the caller's id,
// and returns derived counts only, never another user's data or any raw event
// content. Fail-open inside the summarizer means this endpoint always returns a
// well-formed (possibly zeroed) summary rather than erroring the page.
router.get("/me/journey/summary", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const summary = await summarizeUserJourney(req.user.id);
  res.json(summary);
});

export default router;
