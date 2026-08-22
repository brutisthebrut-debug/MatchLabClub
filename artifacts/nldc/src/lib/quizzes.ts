// Compatibility facade for existing browser imports. The canonical catalog and
// deterministic scorer live in a shared workspace package so the API can score
// the exact same quiz definitions instead of trusting a client-supplied result.
export * from "@workspace/quiz-engine";
