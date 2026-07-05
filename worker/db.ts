/** Small helpers shared across route modules. */

export function uuid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date as YYYY-MM-DD (UTC) — used for schedule/alert comparisons. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Picks only allowed keys from an object and drops undefined values.
 * Used to whitelist writable columns from request bodies.
 */
export function pick<T extends Record<string, unknown>>(
  body: Record<string, unknown> | null | undefined,
  keys: readonly (keyof T)[],
): Partial<T> {
  const out: Partial<T> = {};
  if (!body) return out;
  for (const k of keys) {
    const v = body[k as string];
    if (v !== undefined) {
      (out as Record<string, unknown>)[k as string] = v;
    }
  }
  return out;
}

/** Builds a parameterised "col = ?, col2 = ?" clause plus the matching value list. */
export function setClause(
  data: Record<string, unknown>,
): { clause: string; values: unknown[] } {
  const cols = Object.keys(data);
  const clause = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => (data[c] === undefined ? null : data[c]));
  return { clause, values };
}
