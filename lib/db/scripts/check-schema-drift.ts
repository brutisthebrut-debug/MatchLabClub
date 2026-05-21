import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDbDir = path.resolve(__dirname, "..");

const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = "postgres://drift-check@localhost/drift-check";
}

const tmpRoot = mkdtempSync(path.join(repoDbDir, ".drift-check-"));
const tmpRootRel = path.relative(repoDbDir, tmpRoot);
const tmpOutAbs = path.join(tmpRoot, "drizzle");
const tmpOutRel = path.join(tmpRootRel, "drizzle");
const tmpConfigAbs = path.join(tmpRoot, "drizzle.config.ts");
const tmpConfigRel = path.join(tmpRootRel, "drizzle.config.ts");

try {
  cpSync(path.join(repoDbDir, "drizzle"), tmpOutAbs, { recursive: true });

  // drizzle-kit prepends "./" to the `out` path verbatim, so an absolute path
  // becomes ".//abs/path" and fails to resolve. Use repo-relative paths.
  const configSource = `import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "src/schema/index.ts",
  out: ${JSON.stringify(tmpOutRel)},
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://drift-check" },
});
`;
  writeFileSync(tmpConfigAbs, configSource);

  const before = listSqlFiles(tmpOutAbs);

  const result = spawnSync(
    "npx",
    ["drizzle-kit", "generate", "--config", tmpConfigRel],
    { cwd: repoDbDir, env, encoding: "utf8" },
  );

  if (result.status !== 0) {
    console.error("drizzle-kit generate failed:");
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }

  const after = listSqlFiles(tmpOutAbs);
  const added = after.filter((f) => !before.includes(f));

  if (added.length > 0) {
    console.error(
      "Schema drift detected: lib/db/src/schema/ has changes that are not reflected in lib/db/drizzle/ migrations.",
    );
    console.error("");
    console.error("drizzle-kit would generate these new migration file(s):");
    for (const f of added) console.error(`  - ${f}`);
    console.error("");
    console.error("If your schema change is intentional, generate a migration and commit it:");
    console.error("  pnpm --filter @workspace/db exec drizzle-kit generate --config ./drizzle.config.ts");
    console.error("");
    console.error("Then commit the new files under lib/db/drizzle/ alongside your schema changes.");
    process.exit(1);
  }

  console.log("No schema drift: lib/db/drizzle/ migrations are in sync with lib/db/src/schema/.");
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

function listSqlFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}
