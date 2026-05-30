import { Router, type IRouter, type Request } from "express";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, messageCoachingSessionsTable } from "@workspace/db";
import {
  CreateMessageCoachingSessionBody,
  ListMessageCoachingSessionsResponse,
  CoachMessageResponse,
  ExtractMessageScreenshotBody,
  ExtractMessageScreenshotResponse,
} from "@workspace/api-zod";
import { generateMessageCoaching, type MessageCoachingOutput } from "../lib/aiEngine";
import { generate } from "../lib/aiService";
import { getOrCreateAnonClaimToken, getAnonClaimToken } from "../lib/anonClaimToken";
import { extractChatFromScreenshot } from "../lib/ocr";

const router: IRouter = Router();

function userScope(req: Request): SQL {
  if (req.user?.id) return eq(messageCoachingSessionsTable.userId, req.user.id);
  const anonToken = getAnonClaimToken(req);
  if (anonToken) {
    return and(
      isNull(messageCoachingSessionsTable.userId),
      eq(messageCoachingSessionsTable.anonymousClaimToken, anonToken),
    ) as SQL;
  }
  return sql`false`;
}

router.get("/messages", async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(messageCoachingSessionsTable)
    .where(userScope(req))
    .orderBy(messageCoachingSessionsTable.createdAt);
  res.json(ListMessageCoachingSessionsResponse.parse(sessions.map((s) => ({
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
  }))));
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = CreateMessageCoachingSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const anonymousClaimToken = req.user?.id
    ? null
    : getOrCreateAnonClaimToken(req, res);

  const [session] = await db
    .insert(messageCoachingSessionsTable)
    .values({
      ...parsed.data,
      status: "pending",
      userId: req.user?.id ?? null,
      anonymousClaimToken,
    })
    .returning();

  res.status(201).json({
    ...session,
    createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : String(session.createdAt),
  });
});

router.post("/messages/extract-screenshot", async (req, res): Promise<void> => {
  const parsed = ExtractMessageScreenshotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let extracted: Awaited<ReturnType<typeof extractChatFromScreenshot>>;
  try {
    extracted = await extractChatFromScreenshot(parsed.data.imageBase64);
  } catch (err) {
    req.log.error({ err }, "Chat OCR failed");
    res.status(400).json({ error: "Couldn't read text from that screenshot. Try a clearer image." });
    return;
  }

  if (!extracted.conversationText) {
    res.status(400).json({ error: "No readable conversation text found in the screenshot." });
    return;
  }

  res.json(
    ExtractMessageScreenshotResponse.parse({
      conversationText: extracted.conversationText,
      sourceApp: extracted.sourceApp,
      rawOcrText: extracted.rawText,
      speakerTurns: extracted.speakerTurns,
    }),
  );
});

router.post("/messages/:id/coach", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [session] = await db
    .select()
    .from(messageCoachingSessionsTable)
    .where(and(eq(messageCoachingSessionsTable.id, id), userScope(req)));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const deterministic = generateMessageCoaching({
    matchName: session.matchName,
    conversationContext: session.conversationContext,
    yourLastMessage: session.yourLastMessage,
    goal: session.goal,
    sourceApp: session.sourceApp,
  });

  // Deep AI lane: when the account has granted content consent, layer Claude on
  // top of the deterministic baseline for a read specific to THIS conversation.
  // Anything short of a clean, schema-valid result (no consent, daily cap hit,
  // provider down, malformed JSON) silently keeps the deterministic coaching so
  // the endpoint never degrades. Anonymous sessions skip the call entirely —
  // the consent gate would reject them anyway.
  let coaching: MessageCoachingOutput = deterministic;
  const userId = req.user?.id;
  if (userId) {
    const name = session.matchName?.trim() || "your match";
    const goal = session.goal || "keep the conversation going";
    const system = [
      "You are Echo, the MatchLab Club message coach. A user pasted a real dating-app",
      "conversation and wants help with their next move. Read it closely and coach them",
      "like a sharp, warm friend who has read a thousand of these threads.",
      "",
      "Return JSON only. No prose, no code fences. Match this shape exactly:",
      '{ "analysis": "2-4 sentences on what is actually happening in this thread and where the momentum sits",',
      '  "suggestedReplies": [ { "style": "Playful | Direct | Warm | Date Ask | Graceful Exit", "text": "the actual message they could send, in a real human voice", "rationale": "why this lands here, specific to this conversation" } ],',
      '  "tone": "one line on the tone to strike next",',
      '  "redFlags": ["specific risks in how the user is showing up, or leave empty"],',
      '  "coachTip": "one concrete do-this-next tip" }',
      "",
      "Give 3 to 5 suggestedReplies. Every reply must be specific to THIS conversation and",
      "reference real details they mentioned. Never generic, never a template.",
      "Voice rules: no em dashes. No filler words like 'unlock', 'leverage', 'seamless',",
      "'elevate', 'transformative', 'game-changer', 'cutting-edge', 'dive in', 'buckle up',",
      "or 'in today's world'. Vary sentence length. Sound human.",
    ].join("\n");

    const userContent = [
      `Match name: ${name}`,
      session.sourceApp ? `Platform: ${session.sourceApp}` : null,
      `What the user wants from this thread: ${goal}`,
      `Conversation so far:\n${session.conversationContext}`,
      `The user's most recent message:\n${session.yourLastMessage}`,
    ]
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
          context: {
            toolName: "Message Coach",
            goals: session.goal ? [session.goal] : undefined,
          },
          maxTokens: 1500,
        },
        "",
      );

      if (!aiResult.isFallback && aiResult.validated && aiResult.output) {
        coaching = JSON.parse(aiResult.output) as MessageCoachingOutput;
      } else if (aiResult.fallbackReason) {
        req.log.info(
          { sessionId: id, fallbackReason: aiResult.fallbackReason },
          "coach fell back to deterministic baseline",
        );
      }
    } catch (err) {
      // generate() handles provider errors internally, but any unexpected throw
      // (consent lookup, JSON parse, etc.) must never fail the request: the
      // deterministic baseline already covers this session.
      coaching = deterministic;
      req.log.warn(
        { err, sessionId: id },
        "coach deep-AI lane threw; using deterministic baseline",
      );
    }
  }

  await db.update(messageCoachingSessionsTable)
    .set({ status: "complete" })
    .where(eq(messageCoachingSessionsTable.id, id));

  res.json(CoachMessageResponse.parse({ sessionId: id, ...coaching }));
});

export default router;
