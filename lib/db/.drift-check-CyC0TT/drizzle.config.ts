import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "src/schema/index.ts",
  out: ".drift-check-CyC0TT/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://drift-check" },
});
