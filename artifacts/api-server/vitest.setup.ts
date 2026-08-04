// Vitest global setup: inject env vars required at module load by the API server.
// Legacy founder-route tests still send the old header while production uses
// server-side account roles. The middleware accepts this value only in tests.
if (!process.env.FOUNDER_KEY) {
  process.env.FOUNDER_KEY = "nldc2024";
}
