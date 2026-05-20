# API Server Testing Convention

## The problem: parallel workers share one database

Vitest runs test files in **parallel workers** that all talk to the same dev
Postgres database. Any test that queries an entire table (a "global scan")
will pick up rows inserted by other workers, making count-based assertions
flaky.

## The rule: every test that touches shared tables must be scoped

### 1. Use unique, test-scoped entity names

Generate a random suffix for every entity name your test inserts. Never use
a hardcoded name like `"audit_engine"` directly in a test that runs alongside
other workers.

```typescript
import crypto from "crypto";

const usedToolNames: string[] = [];

function uniqueTool(label: string): string {
  const name = `mytest-${label}-${crypto.randomBytes(6).toString("hex")}`;
  usedToolNames.push(name);
  return name;
}
```

### 2. Clean up with `afterEach` / `afterAll` using `inArray`, not `TRUNCATE`

`TRUNCATE` is a global operation that deletes every other worker's rows too.
Use a scoped delete instead:

```typescript
afterEach(async () => {
  if (usedToolNames.length === 0) return;
  await db
    .delete(someTable)
    .where(inArray(someTable.toolName, [...usedToolNames]));
  usedToolNames.length = 0;
});
```

### 3. Scope reads from shared tables too

`db.select().from(table)` returns every row, including rows from other
workers. Always filter by your unique names:

```typescript
const rows = await db
  .select()
  .from(aiRequestMetricsDailyTable)
  .where(inArray(aiRequestMetricsDailyTable.toolName, [...toolNames]));
```

### 4. Pass `toolNames` to global-scan helpers

Any library function that queries an entire table must accept an optional
`toolNames?: readonly string[]` filter so tests can restrict its view.
Production callers omit the argument; tests pass their unique names.

**Pattern (established in Task #173, extended in Task #254):**

```typescript
// Library function
export async function myGlobalScan(
  options?: { toolNames?: readonly string[] },
): Promise<...> {
  const { toolNames } = options ?? {};
  const filter =
    toolNames && toolNames.length > 0
      ? sql.raw(
          ` where tool_name in (${toolNames
            .map((n) => `'${n.replace(/'/g, "''")}'`)
            .join(",")})`,
        )
      : sql``;
  // ... inject ${filter} into the SQL
}

// Test
const toolNames = [uniqueTool("scenario-a"), uniqueTool("scenario-b")] as const;
const result = await myGlobalScan({ toolNames });
```

## Functions that implement this pattern

| Function | File | Filter argument |
|---|---|---|
| `checkAiReliabilityAlerts` | `lib/aiReliabilityAlerts.ts` | `options.toolNames` |
| `fetchRecentByTool` (internal) | `lib/aiReliabilityAlerts.ts` | `toolNames` |
| `rollupAiMetricsForDay` | `lib/aiMetricsRetention.ts` | `options.toolNames` |
| `rollupOldAiMetrics` | `lib/aiMetricsRetention.ts` | `options.toolNames` |
| `pruneOldAiMetrics` | `lib/aiMetricsRetention.ts` | `options.toolNames` |
| `rollupThenPruneAiMetrics` | `lib/aiMetricsRetention.ts` | `options.toolNames` |

## Adding a new global-scan function

When you write a new function that scans a full table (no user-scoped WHERE
clause), you have two options:

1. **Add a `toolNames` (or equivalent scope) filter** — required if the
   function will be called from a test that runs in parallel with other tests.
2. **Run those tests serially** — set `pool: { singleThread: true }` in the
   vitest config or use `--pool-options.threads.singleThread` on the CLI.
   This is a last resort; prefer option 1.

## Reference test files

- `src/lib/aiReliabilityAlerts.test.ts` — canonical example of the pattern
- `src/routes/founder.ai-metrics.alert-reason.test.ts` — another example
- `src/lib/aiMetricsRetention.test.ts` — retention rollup tests using the
  same pattern (updated in Task #254)
