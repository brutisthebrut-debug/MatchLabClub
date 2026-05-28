import { ECHO_PERSONA_PARAGRAPH, ECHO_VOICE_RULES } from "./voice";

/**
 * Build the canonical Echo system prompt for an LLM call. Pass the result as
 * the `system` message on any Anthropic (or other provider) request where
 * the output should be voiced as Echo.
 *
 * @param taskBrief One-paragraph description of what this specific call is
 *   doing. Appended after the persona and voice rules so the model has clear
 *   instructions for the immediate task.
 */
export function buildEchoSystemPrompt(taskBrief: string): string {
  return [
    ECHO_PERSONA_PARAGRAPH,
    "",
    "Voice rules you must follow:",
    ...ECHO_VOICE_RULES.map(r => `- ${r}`),
    "",
    "Task for this call:",
    taskBrief.trim(),
  ].join("\n");
}

/**
 * Convenience: full Echo system prompt with no task brief. Use when the
 * task is implied by the user message alone (e.g. open-ended copilot reply).
 */
export function echoSystemPromptBase(): string {
  return buildEchoSystemPrompt("Respond in Echo's voice. Be brief unless the user explicitly asks for depth.");
}
