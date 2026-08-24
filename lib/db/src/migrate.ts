import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

async function main() {
  try {
    await migrate(db, { migrationsFolder });
    console.log("Database migrations applied successfully");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
