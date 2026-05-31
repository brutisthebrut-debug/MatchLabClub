// Activity streak: a deterministic, derived view of how consistently a user has
// fed ANY signal into their second brain. This is purely a gamification lens on
// top of activity history; it never touches the readiness score computation.
//
// "Active day" = a UTC calendar day on which the user produced at least one
// signal of any kind (a compass read, a journal entry, a wellness pass, an
// import, an audit, and so on). The route collects the distinct day strings and
// hands them here; this function stays DB-free so it is easy to reason about and
// unit test.

export interface ActivityStreak {
  /** Consecutive active days ending today, or yesterday if today is not yet active. 0 when the run has lapsed. */
  current: number;
  /** Longest consecutive run of active days the user has ever had. */
  longest: number;
  /** True when the user has already fed a signal today (UTC). */
  activeToday: boolean;
  /** How many of the last 14 days (inclusive of today) had activity. */
  daysActiveLast14: number;
}

/** Shift a YYYY-MM-DD day string by a whole number of days, in UTC. */
function shiftDay(day: string, deltaDays: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const ms = Date.UTC(y, (m ?? 1) - 1, d ?? 1) + deltaDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Build the activity streak from a list of active-day strings (YYYY-MM-DD, any
 * order, may contain duplicates) and today's UTC day string.
 */
export function computeActivityStreak(
  days: string[],
  today: string,
): ActivityStreak {
  const set = new Set(days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));

  const activeToday = set.has(today);

  // The current run is anchored to today if active, otherwise to yesterday so a
  // user who has not opened the app yet today does not instantly lose a streak
  // they kept up through yesterday. If neither is active, the run has lapsed.
  const yesterday = shiftDay(today, -1);
  let current = 0;
  let anchor: string | null = activeToday
    ? today
    : set.has(yesterday)
      ? yesterday
      : null;
  while (anchor && set.has(anchor)) {
    current += 1;
    anchor = shiftDay(anchor, -1);
  }

  // Longest run across all of history.
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && day === shiftDay(prev, 1) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }

  // Active days within the trailing 14-day window (inclusive of today).
  const cutoff = shiftDay(today, -13);
  let daysActiveLast14 = 0;
  for (const day of set) {
    if (day >= cutoff && day <= today) daysActiveLast14 += 1;
  }

  return { current, longest, activeToday, daysActiveLast14 };
}
