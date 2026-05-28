// Vitest global setup: inject env vars required at module load by the API server.
// Tests import middlewares/founderAuth.ts (directly or transitively) which now
// fails fast at module load if FOUNDER_KEY is missing. Default it here so the
// test suite is self-contained without requiring shell exports.
if (!process.env.FOUNDER_KEY) {
  process.env.FOUNDER_KEY = "nldc2024";
}
