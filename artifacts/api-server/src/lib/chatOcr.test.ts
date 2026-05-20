import { describe, it, expect, beforeEach, vi } from "vitest";

let mockOcrText = "";

vi.mock("tesseract.js", () => ({
  createWorker: async () => ({
    recognize: async () => ({ data: { text: mockOcrText } }),
  }),
}));

vi.mock("./ocrLearning", () => ({
  getCachedLearnedRules: () => ({
    nameSubstitutions: new Map(),
    sourceAppOverrides: new Map(),
    promptAdditions: new Set(),
  }),
}));

import { extractChatFromScreenshot } from "./ocr";

function toBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

beforeEach(() => {
  mockOcrText = "";
});

describe("extractChatFromScreenshot — source-app detection", () => {
  it("detects Hinge from a 'Send Like' button + Hinge prompt phrase", async () => {
    mockOcrText = [
      "9:41",
      "Sam",
      "Hey! Saw you climbed Kilimanjaro — favorite memory from the trip?",
      "Honestly the sunrise above the clouds at Stella Point. Surreal.",
      "Send Like",
      "Two truths and a lie",
    ].join("\n");

    const out = await extractChatFromScreenshot(toBase64("ignored"));
    expect(out.sourceApp).toBe("Hinge");
    expect(out.conversationText).toMatch(/Kilimanjaro/);
    expect(out.conversationText).toMatch(/Stella Point/);
  });

  it("detects Bumble from 'Send a Compliment' button", async () => {
    mockOcrText = [
      "Bumble",
      "Emma",
      "10:24 AM",
      "Loved your breakfast burrito photo — what's the secret?",
      "Smoked paprika and way too much cheese 😅",
      "Send a Compliment",
      "Delivered",
    ].join("\n");

    const out = await extractChatFromScreenshot(toBase64("ignored"));
    expect(out.sourceApp).toBe("Bumble");
    expect(out.conversationText).toMatch(/breakfast burrito/);
    expect(out.conversationText).toMatch(/paprika/);
  });

  it("detects Tinder from app name + 'It's a match'", async () => {
    mockOcrText = [
      "Tinder",
      "It's a Match!",
      "Mia",
      "9:02 PM",
      "Coffee black like your soul?",
      "Black like my Monday mornings, yeah",
      "Type a message...",
    ].join("\n");

    const out = await extractChatFromScreenshot(toBase64("ignored"));
    expect(out.sourceApp).toBe("Tinder");
    expect(out.conversationText).toMatch(/Coffee black/);
    expect(out.conversationText).toMatch(/Monday mornings/);
  });

  it("returns null sourceApp when there are no app-specific cues", async () => {
    mockOcrText = [
      "Hey, how's your week going?",
      "Pretty good, you?",
      "Same — kind of slammed at work though.",
    ].join("\n");

    const out = await extractChatFromScreenshot(toBase64("ignored"));
    expect(out.sourceApp).toBeNull();
    expect(out.conversationText).toMatch(/how's your week/);
  });
});

describe("extractChatFromScreenshot — UI noise filtering", () => {
  it("strips timestamps, 'Delivered'/'Read', day labels, and bullets", async () => {
    mockOcrText = [
      "9:41 AM",
      "Yesterday",
      "Monday",
      "Hey! How was your weekend?",
      "Delivered",
      "10:02 PM",
      "Read",
      "It was great — went hiking up at Bear Mountain.",
      "•",
      "Just now",
      "Nice — got pics?",
      "Today",
      "2h ago",
    ].join("\n");

    const out = await extractChatFromScreenshot(toBase64("ignored"));
    const lines = out.conversationText.split("\n");

    expect(lines).toContain("Hey! How was your weekend?");
    expect(lines).toContain("It was great — went hiking up at Bear Mountain.");
    expect(lines).toContain("Nice — got pics?");

    expect(out.conversationText).not.toMatch(/^9:41\s*AM$/m);
    expect(out.conversationText).not.toMatch(/^10:02 PM$/m);
    expect(out.conversationText).not.toMatch(/^Delivered$/m);
    expect(out.conversationText).not.toMatch(/^Read$/m);
    expect(out.conversationText).not.toMatch(/^Yesterday$/m);
    expect(out.conversationText).not.toMatch(/^Today$/m);
    expect(out.conversationText).not.toMatch(/^Just now$/m);
    expect(out.conversationText).not.toMatch(/^Monday$/m);
    expect(out.conversationText).not.toMatch(/^2h ago$/m);
    expect(out.conversationText).not.toMatch(/^•$/m);
  });

  it("strips compose-area chrome ('Send', 'Reply', 'Type a message...', 'aa')", async () => {
    mockOcrText = [
      "Send Like",
      "Want to grab coffee Saturday?",
      "Reply",
      "Yes! Where were you thinking?",
      "Send",
      "Type a message...",
      "aa",
      "Message",
    ].join("\n");

    const out = await extractChatFromScreenshot(toBase64("ignored"));
    expect(out.conversationText).toMatch(/grab coffee Saturday/);
    expect(out.conversationText).toMatch(/Where were you thinking/);

    const lines = out.conversationText.split("\n");
    expect(lines).not.toContain("Send Like");
    expect(lines).not.toContain("Reply");
    expect(lines).not.toContain("Send");
    expect(lines).not.toContain("Type a message...");
    expect(lines).not.toContain("aa");
    expect(lines).not.toContain("Message");
  });

  it("preserves rawText untouched even after noise filtering", async () => {
    mockOcrText = "9:41\nDelivered\nHi there!\n";
    const out = await extractChatFromScreenshot(toBase64("ignored"));
    expect(out.rawText).toBe("9:41\nDelivered\nHi there!");
    expect(out.conversationText).toBe("Hi there!");
  });
});

describe("extractChatFromScreenshot — input validation", () => {
  it("throws on an empty payload", async () => {
    await expect(extractChatFromScreenshot("   ")).rejects.toThrow(/Empty image payload/);
  });

  it("strips a data: URL prefix before decoding", async () => {
    mockOcrText = "Hello there\nGeneral Kenobi";
    const dataUrl = `data:image/png;base64,${toBase64("ignored")}`;
    const out = await extractChatFromScreenshot(dataUrl);
    expect(out.conversationText).toMatch(/General Kenobi/);
  });
});
