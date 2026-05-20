/**
 * In-memory fake of `@workspace/db` and the `drizzle-orm` operators used by
 * the route layer. Lets the supertest-based route tests exercise the real
 * Express handlers WITHOUT requiring a Postgres connection.
 *
 * Only the operators / chains the route files actually call are implemented.
 * Behavior is intentionally minimal — just enough to pass realistic data
 * through `select / insert / update / delete` flows with predicate-based
 * `where` and basic ordering / limit / offset.
 *
 * Used only by *.test.ts files via vi.mock — never imported by production
 * code paths.
 */

export type Row = Record<string, unknown>;
type Pred = (row: Row) => boolean;
type OrderSpec = { col: string; dir: "asc" | "desc" };

interface ColumnRef {
  __col: string;
  __table: string;
}

interface FakeTable {
  __name: string;
  __defaults: Record<string, unknown>;
  // Proxy lets callers do `table.id`, `table.userId`, etc. We make those
  // return ColumnRef objects that operators recognise.
  [k: string]: unknown;
}

interface Store {
  rows: Row[];
  nextId: number;
  defaults: Record<string, unknown>;
}

function ensureStore(name: string): Store {
  if (!stores[name]) {
    stores[name] = { rows: [], nextId: 1, defaults: {} };
  }
  return stores[name];
}

const stores: Record<string, Store> = {
  audits: {
    rows: [],
    nextId: 1,
    defaults: {
      userId: null,
      anonymousClaimToken: null,
      orientation: null,
      currentApps: [],
      prompts: null,
      recentMessageSample: null,
      photoCount: null,
      relationshipHistory: null,
      biggestChallenge: null,
      sourceApp: null,
      status: "pending",
      source: "manual",
      readinessScore: null,
      report: null,
      reportGeneratedAt: null,
      rawOcrText: null,
      ocrCorrections: null,
      deletedAt: null,
    },
  },
  message_coaching_sessions: {
    rows: [],
    nextId: 1,
    defaults: {
      userId: null,
      anonymousClaimToken: null,
      goal: null,
      status: "pending",
    },
  },
  email_insights: {
    rows: [],
    nextId: 1,
    defaults: {
      userId: null,
      anonymousClaimToken: null,
      consentGiven: false,
      status: "pending",
    },
  },
  audit_report_versions: {
    rows: [],
    nextId: 1,
    defaults: {
      changeSummary: null,
      engineVersion: null,
    },
  },
};

let monotonicClockMs = 0;
function nextClock(): Date {
  const now = Date.now();
  monotonicClockMs = Math.max(now, monotonicClockMs + 1);
  return new Date(monotonicClockMs);
}

export function resetTestDb(): void {
  for (const key of Object.keys(stores)) {
    const s = stores[key];
    s.rows = [];
    s.nextId = 1;
  }
  monotonicClockMs = 0;
}

export function dumpTable(name: string): Row[] {
  return stores[name]?.rows ?? [];
}

function makeTable(name: string): FakeTable {
  const target: FakeTable = {
    __name: name,
    __defaults: stores[name].defaults,
  };
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop === "__name") return t.__name;
      if (prop === "__defaults") return t.__defaults;
      const ref: ColumnRef = { __col: prop, __table: name };
      return ref;
    },
  }) as FakeTable;
}

export const auditsTable = makeTable("audits");
export const auditReportVersionsTable = makeTable("audit_report_versions");
export const messageCoachingSessionsTable = makeTable("message_coaching_sessions");
export const emailInsightsTable = makeTable("email_insights");

// Auxiliary tables touched indirectly (e.g. aiService records request metrics).
// We register a store for them but don't expose typed table consts unless a
// route handler needs them.
ensureStore("ai_request_metrics");
ensureStore("profiles");
ensureStore("coach_follow_ups");
ensureStore("leads");
ensureStore("waitlist");
ensureStore("purchase_interest");
ensureStore("data_export_tokens");
ensureStore("users");
ensureStore("sessions");
export const aiRequestMetricsTable = makeTable("ai_request_metrics");
export const profilesTable = makeTable("profiles");
export const coachFollowUpsTable = makeTable("coach_follow_ups");
export const leadsTable = makeTable("leads");
export const waitlistTable = makeTable("waitlist");
export const purchaseInterestTable = makeTable("purchase_interest");
export const dataExportTokensTable = makeTable("data_export_tokens");
export const usersTable = makeTable("users");
export const sessionsTable = makeTable("sessions");

// ---- Operators -----------------------------------------------------------

function isColRef(x: unknown): x is ColumnRef {
  return !!x && typeof x === "object" && "__col" in (x as object);
}

export type DrizzlePred = Pred;

export const eq = (col: ColumnRef, val: unknown): Pred => (row) =>
  row[col.__col] === val;

export const isNull = (col: ColumnRef): Pred => (row) =>
  row[col.__col] === null || row[col.__col] === undefined;

export const isNotNull = (col: ColumnRef): Pred => (row) =>
  row[col.__col] !== null && row[col.__col] !== undefined;

export const and = (...preds: Array<Pred | undefined | false | null>): Pred => (row) =>
  preds.every((p) => (typeof p === "function" ? p(row) : true));

export const or = (...preds: Array<Pred | undefined | false | null>): Pred => (row) =>
  preds.some((p) => (typeof p === "function" ? p(row) : false));

export const gte = (col: ColumnRef, val: number): Pred => (row) => {
  const v = row[col.__col];
  return typeof v === "number" && v >= val;
};

export const lt = (col: ColumnRef, val: number): Pred => (row) => {
  const v = row[col.__col];
  return typeof v === "number" && v < val;
};

export const ilike = (col: ColumnRef, pattern: string): Pred => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    "^" + escaped.replace(/%/g, ".*").replace(/_/g, ".") + "$",
    "i",
  );
  return (row) => {
    const v = row[col.__col];
    return typeof v === "string" && re.test(v);
  };
};

export const inArray = (col: ColumnRef, vals: unknown[]): Pred => (row) =>
  vals.includes(row[col.__col]);

export const desc = (col: ColumnRef): OrderSpec => ({ col: col.__col, dir: "desc" });
export const asc = (col: ColumnRef): OrderSpec => ({ col: col.__col, dir: "asc" });

// `sql` is a tag function that captures its template parts so the SelectChain
// can interpret a handful of well-known shapes used by route handlers (e.g.
// `count(*) filter (where col = 'x')::int`, `max(col) filter (where col in (..))`,
// and `${col} desc` for orderBy). When used as a where-clause predicate, it
// defaults to `false` so postgres-only conditions don't incorrectly match all
// rows in tests.
interface SqlMeta {
  __sql: true;
  reconstructed: string;
}
type SqlPred = Pred & SqlMeta;
type SqlTag = ((strings: TemplateStringsArray, ...values: unknown[]) => SqlPred) & Record<string, unknown>;

function reconstructSql(
  strings: ArrayLike<string>,
  values: ReadonlyArray<unknown>,
): string {
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      const v = values[i];
      if (isColRef(v)) {
        out += `{{COL:${v.__col}}}`;
      } else if (isSqlMeta(v)) {
        out += v.reconstructed;
      } else if (typeof v === "string") {
        out += `'${v}'`;
      } else {
        out += String(v);
      }
    }
  }
  return out;
}

function isSqlMeta(x: unknown): x is SqlPred {
  return (
    typeof x === "function" &&
    (x as unknown as { __sql?: boolean }).__sql === true
  );
}

export const sql: SqlTag = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
): SqlPred => {
  const fn = (() => false) as Pred as SqlPred;
  fn.__sql = true;
  fn.reconstructed = reconstructSql(strings, values).trim();
  return fn;
}) as SqlTag;

function compareForOrder(av: unknown, bv: unknown, dir: "asc" | "desc"): number {
  if (av === bv) return 0;
  if (av === null || av === undefined) return 1;
  if (bv === null || bv === undefined) return -1;
  const aCmp = av instanceof Date ? av.getTime() : (av as number | string);
  const bCmp = bv instanceof Date ? bv.getTime() : (bv as number | string);
  const cmp = aCmp < bCmp ? -1 : 1;
  return dir === "desc" ? -cmp : cmp;
}

function parseLiteralList(listStr: string): string[] {
  return listStr
    .split(",")
    .map((s) => s.trim().replace(/^'(.*)'$/, "$1"));
}

function computeAggregate(spec: unknown, rows: Row[]): unknown {
  if (isColRef(spec)) return rows[0]?.[spec.__col];
  if (!isSqlMeta(spec)) return spec;
  const s = spec.reconstructed;

  let m = s.match(
    /^count\(\*\)\s*filter\s*\(where\s*\{\{COL:(\w+)\}\}\s*=\s*'([^']*)'\)\s*(?:::int)?$/i,
  );
  if (m) {
    const [, col, lit] = m;
    return rows.filter((r) => r[col] === lit).length;
  }

  m = s.match(
    /^count\(\*\)\s*filter\s*\(where\s*\{\{COL:(\w+)\}\}\s+in\s*\(([^)]+)\)\)\s*(?:::int)?$/i,
  );
  if (m) {
    const [, col, listStr] = m;
    const vals = parseLiteralList(listStr);
    return rows.filter((r) => vals.includes(r[col] as string)).length;
  }

  m = s.match(/^count\(\*\)\s*(?:::int)?$/i);
  if (m) return rows.length;

  m = s.match(
    /^max\(\{\{COL:(\w+)\}\}\)\s*filter\s*\(where\s*\{\{COL:(\w+)\}\}\s+in\s*\(([^)]+)\)\)$/i,
  );
  if (m) {
    const [, col, fCol, listStr] = m;
    const vals = parseLiteralList(listStr);
    const filtered = rows.filter((r) => vals.includes(r[fCol] as string));
    return maxOf(filtered.map((r) => r[col]));
  }

  m = s.match(
    /^max\(\{\{COL:(\w+)\}\}\)\s*filter\s*\(where\s*\{\{COL:(\w+)\}\}\s*=\s*'([^']*)'\)$/i,
  );
  if (m) {
    const [, col, fCol, lit] = m;
    const filtered = rows.filter((r) => r[fCol] === lit);
    return maxOf(filtered.map((r) => r[col]));
  }

  return null;
}

function maxOf(values: unknown[]): unknown {
  let best: unknown = null;
  let bestCmp: number | null = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const cmp = v instanceof Date ? v.getTime() : (v as number);
    if (bestCmp === null || cmp > bestCmp) {
      best = v;
      bestCmp = cmp;
    }
  }
  return best;
}

function hasAggregateSpec(projection: Record<string, unknown>): boolean {
  for (const v of Object.values(projection)) {
    if (isSqlMeta(v) && /^(count|max|min|sum|avg)\b/i.test(v.reconstructed)) {
      return true;
    }
  }
  return false;
}

// ---- Chainable query builder --------------------------------------------

abstract class AsyncChain<T> {
  protected abstract execute(): T;
  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onFulfilled, onRejected);
  }
  catch<R = never>(
    onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null,
  ): Promise<T | R> {
    return this.then(undefined, onRejected);
  }
}

class SelectChain extends AsyncChain<Row[]> {
  private tableName!: string;
  private filters: Pred[] = [];
  private orders: OrderSpec[] = [];
  private limitVal: number | undefined;
  private offsetVal = 0;
  private projection: Record<string, unknown> | null;

  constructor(projection?: Record<string, unknown>) {
    super();
    this.projection = projection ?? null;
  }

  from(table: FakeTable): this {
    this.tableName = table.__name;
    return this;
  }
  where(pred: Pred | undefined): this {
    if (typeof pred === "function") this.filters.push(pred);
    return this;
  }
  orderBy(...args: Array<OrderSpec | ColumnRef | SqlPred>): this {
    for (const a of args) {
      if (isSqlMeta(a)) {
        const m = a.reconstructed.match(/^\{\{COL:(\w+)\}\}\s+(asc|desc)$/i);
        if (m) {
          this.orders.push({ col: m[1], dir: m[2].toLowerCase() as "asc" | "desc" });
        }
      } else if ((a as OrderSpec).dir) {
        this.orders.push(a as OrderSpec);
      } else if (isColRef(a)) {
        this.orders.push({ col: a.__col, dir: "asc" });
      }
    }
    return this;
  }
  limit(n: number): this {
    this.limitVal = n;
    return this;
  }
  offset(n: number): this {
    this.offsetVal = n;
    return this;
  }
  protected execute(): Row[] {
    let rows = (ensureStore(this.tableName).rows).filter((r) =>
      this.filters.every((p) => p(r)),
    );
    for (const ord of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => compareForOrder(a[ord.col], b[ord.col], ord.dir));
    }
    const end =
      this.limitVal !== undefined ? this.offsetVal + this.limitVal : undefined;
    rows = rows.slice(this.offsetVal, end);

    if (!this.projection) return rows;

    if (hasAggregateSpec(this.projection)) {
      const projected: Row = {};
      for (const [key, spec] of Object.entries(this.projection)) {
        projected[key] = computeAggregate(spec, rows);
      }
      return [projected];
    }

    return rows.map((row) => {
      const projected: Row = {};
      for (const [key, spec] of Object.entries(this.projection!)) {
        if (isColRef(spec)) projected[key] = row[spec.__col];
        else if (isSqlMeta(spec)) projected[key] = computeAggregate(spec, [row]);
        else projected[key] = spec;
      }
      return projected;
    });
  }
}

class InsertChain extends AsyncChain<Row[]> {
  private tableName: string;
  private valuesObj: Row | null = null;
  private returningSpec: Record<string, ColumnRef> | true | null = null;
  constructor(tableName: string) {
    super();
    this.tableName = tableName;
  }
  values(obj: Row): this {
    this.valuesObj = obj;
    return this;
  }
  returning(spec?: Record<string, ColumnRef>): this {
    this.returningSpec = spec ?? true;
    return this;
  }
  protected execute(): Row[] {
    const store = ensureStore(this.tableName);
    const v = this.valuesObj ?? {};
    const row: Row = {
      ...store.defaults,
      ...v,
      id: store.nextId++,
      createdAt: nextClock(),
    };
    store.rows.push(row);
    if (this.returningSpec === null || this.returningSpec === true) {
      return [row];
    }
    const projected: Row = {};
    for (const [outKey, ref] of Object.entries(this.returningSpec)) {
      projected[outKey] = row[ref.__col];
    }
    return [projected];
  }
}

class UpdateChain extends AsyncChain<Row[]> {
  private tableName: string;
  private setObj: Row | null = null;
  private filters: Pred[] = [];
  private returningSpec: Record<string, ColumnRef> | true | null = null;
  constructor(tableName: string) {
    super();
    this.tableName = tableName;
  }
  set(obj: Row): this {
    this.setObj = obj;
    return this;
  }
  where(pred: Pred | undefined): this {
    if (typeof pred === "function") this.filters.push(pred);
    return this;
  }
  returning(spec?: Record<string, ColumnRef>): this {
    this.returningSpec = spec ?? true;
    return this;
  }
  protected execute(): Row[] {
    const store = ensureStore(this.tableName);
    const updated: Row[] = [];
    for (const row of store.rows) {
      if (this.filters.every((p) => p(row))) {
        Object.assign(row, this.setObj ?? {});
        updated.push(row);
      }
    }
    if (this.returningSpec === null || this.returningSpec === true) {
      return updated;
    }
    return updated.map((row) => {
      const projected: Row = {};
      for (const [outKey, ref] of Object.entries(
        this.returningSpec as Record<string, ColumnRef>,
      )) {
        projected[outKey] = row[ref.__col];
      }
      return projected;
    });
  }
}

class DeleteChain extends AsyncChain<void> {
  private tableName: string;
  private filters: Pred[] = [];
  constructor(tableName: string) {
    super();
    this.tableName = tableName;
  }
  where(pred: Pred | undefined): this {
    if (typeof pred === "function") this.filters.push(pred);
    return this;
  }
  protected execute(): void {
    const store = ensureStore(this.tableName);
    store.rows = store.rows.filter((r) => !this.filters.every((p) => p(r)));
  }
}

export const db = {
  select(projection?: Record<string, unknown>) {
    return new SelectChain(projection);
  },
  insert(table: FakeTable) {
    return new InsertChain(table.__name);
  },
  update(table: FakeTable) {
    return new UpdateChain(table.__name);
  },
  delete(table: FakeTable) {
    return new DeleteChain(table.__name);
  },
};

// Routes don't call `pool` directly, but we re-export a stub so any code
// path that does only sees an inert object.
export const pool = {
  end: async () => undefined,
};
