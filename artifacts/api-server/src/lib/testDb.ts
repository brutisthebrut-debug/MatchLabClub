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
};

export function resetTestDb(): void {
  for (const key of Object.keys(stores)) {
    const s = stores[key];
    s.rows = [];
    s.nextId = 1;
  }
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

// Routes use sql`false` to mean "no rows". We expose `sql` as a tag function
// that returns a predicate matching `false` literal — anything else returns true.
type SqlTag = ((strings: TemplateStringsArray, ...values: unknown[]) => Pred) & Record<string, unknown>;
export const sql: SqlTag = ((strings: TemplateStringsArray) => {
  if (strings && strings.join("").trim() === "false") return () => false;
  return () => true;
}) as SqlTag;

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

  from(table: FakeTable): this {
    this.tableName = table.__name;
    return this;
  }
  where(pred: Pred | undefined): this {
    if (typeof pred === "function") this.filters.push(pred);
    return this;
  }
  orderBy(...args: Array<OrderSpec | ColumnRef>): this {
    for (const a of args) {
      if ((a as OrderSpec).dir) this.orders.push(a as OrderSpec);
      else if (isColRef(a)) this.orders.push({ col: a.__col, dir: "asc" });
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
      rows = [...rows].sort((a, b) => {
        const av = a[ord.col] as number | string | null;
        const bv = b[ord.col] as number | string | null;
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : 1;
        return ord.dir === "desc" ? -cmp : cmp;
      });
    }
    const end =
      this.limitVal !== undefined ? this.offsetVal + this.limitVal : undefined;
    return rows.slice(this.offsetVal, end);
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
      createdAt: new Date(),
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
  select() {
    return new SelectChain();
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
