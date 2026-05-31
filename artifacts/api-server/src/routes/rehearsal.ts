import { Router, type IRouter } from "express";
import { RehearsalTurnBody, RehearsalTurnResponse } from "@workspace/api-zod";
import {
  generateRehearsalTurn,
  REHEARSAL_SCENARIOS,
  type RehearsalTurnOutput,
} from "../lib/aiEngine";
import { generate } from "../lib/aiService";

const router: IRouter = Router();

router.post("/rehearsal/turn", async (req, res): Promise<void> => {
  const parsed = RehearsalTurnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;

  // Deterministic baseline always answers, so the room is never empty.
  const deterministic = generateRehearsalTurn({
    scenario: input.scenario,
    theirStyle: input.theirStyle ?? undefined,
    transcript: input.transcript.map((t) => ({ role: t.role, text: t.text })),
  });

  let result: RehearsalTurnOutput = deterministic;
  let isFallback = true;

  // Deep AI lane: when the account has granted content consent, Claude plays the
  // other person in character and sharpens the coaching note. Anything short of
  // a clean, schema-valid result (no consent, daily cap hit, provider down,
  // malformed JSON) keeps the deterministic baseline so the room never goes
  // quiet. Anonymous callers skip the call entirely; the consent gate would
  // reject them anyway, and the baseline already covers them.
  const userId = req.user?.id;
  if (userId) {
    const scenarioLabel =
      REHEARSAL_SCENARIOS[input.scenario]?.label ?? "a hard relationship conversation";
    const system = [
      "You are running a rehearsal inside MatchLab Club. The user is practicing a hard",
      "relationship conversation before they have it for real. You do two jobs in one",
      "JSON response:",
      "1. Play the OTHER person in the user's dating life, reacting in character to the",
      "   user's latest message. Be a real, three-dimensional person, not a pushover and",
      "   not a villain. You can be warm, guarded, hurt, or hopeful depending on how the",
      "   user shows up. If they are harsh or speak in absolutes, react like a real person",
      "   would. If they are honest and kind, soften. Keep it to 1 to 3 sentences, the way",
      "   people actually talk or text.",
      "2. Step out of character and give the user ONE specific, concrete note on how their",
      "   last message landed, plus one adjustment to try next. Sharp and warm, like a",
      "   friend who has read a thousand of these.",
      "",
      `Scenario: ${scenarioLabel}.`,
      "",
      "Return JSON only. No prose, no code fences. Match this shape exactly:",
      '{ "reply": "the other person\'s next line, in character",',
      '  "note": "one concrete coaching nudge on the user\'s last message",',
      '  "tone": "a few words naming the emotional read, e.g. guarded but listening" }',
      "",
      "Voice rules: no em dashes. No filler words like 'unlock', 'leverage', 'seamless',",
      "'elevate', 'transformative', 'game-changer', 'cutting-edge', 'dive in', or 'in",
      "today's world'. No emojis. Vary sentence length. Sound human.",
    ].join("\n");

    const styleLine = input.theirStyle?.trim()
      ? `How the other person communicates (match this): ${input.theirStyle.trim()}`
      : null;
    const transcriptText = input.transcript.length
      ? input.transcript
          .map((t) => `${t.role === "you" ? "User" : "Them"}: ${t.text}`)
          .join("\n")
      : "(no messages yet, open the scene as the other person)";
    const userContent = [styleLine, `Transcript so far:\n${transcriptText}`]
      .filter((line): line is string => Boolean(line))
      .join("\n\n");

    try {
      const aiResult = await generate(
        {
          provider: "anthropic",
          system,
          user: userContent,
          expectJson: true,
          requireContentConsent: true,
          userId,
          context: { toolName: "Rehearsal Room" },
          maxTokens: 700,
        },
        "",
      );

      if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
        const ai = JSON.parse(aiResult.output) as Partial<RehearsalTurnOutput>;
        if (ai.reply && ai.note) {
          result = {
            reply: ai.reply,
            note: ai.note,
            tone: ai.tone ?? deterministic.tone,
          };
          isFallback = false;
        }
      } else if (aiResult.fallbackReason) {
        req.log.info(
          { fallbackReason: aiResult.fallbackReason },
          "rehearsal fell back to deterministic baseline",
        );
      }
    } catch (err) {
      // generate() handles provider errors internally, but any unexpected throw
      // (consent lookup, JSON parse, etc.) must never fail the request: the
      // deterministic baseline already covers this turn.
      result = deterministic;
      isFallback = true;
      req.log.warn({ err }, "rehearsal deep-AI lane threw; using deterministic baseline");
    }
  }

  res.json(RehearsalTurnResponse.parse({ ...result, isFallback }));
});

export default router;
