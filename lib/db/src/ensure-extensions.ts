import pg from "pg";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to ensure extensions");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    console.log("pg_trgm extension ensured");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
