/**
 * Coercion of untrusted form data into a Prisma `Json` column.
 *
 * `FormSubmission.data` is a `Json` field and everything in it arrives from a
 * public endpoint, so the values are attacker-controlled in both shape and
 * type. Prisma rejects a `Json` payload containing `undefined`, a function, a
 * `BigInt`, a `Date` it cannot encode or a circular reference, and it does so
 * with a driver-level error that turns a lead submission into a 500.
 *
 * `Record<string, unknown>` is therefore not assignable to `InputJsonValue`, and
 * the honest answer is not a cast: the value has to be walked and made storable.
 * Anything that cannot be represented is stringified rather than dropped, because
 * a lead whose field reads `"[object Object]"` is recoverable and a lead whose
 * field vanished is a lost sale.
 */

import type { Prisma } from '@prisma/client';

/**
 * A value Prisma can store in a `Json` column.
 *
 * Declared locally rather than reusing `Prisma.InputJsonValue`, because that type
 * omits `null` even though a Postgres `jsonb` column accepts it and Prisma
 * round-trips it. Omitting it forces a cast at every nested position; the
 * coercion below is what actually guarantees the value is representable, so the
 * single cast at the Prisma boundary is total rather than optimistic.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const MAX_DEPTH = 6;
const MAX_ARRAY_LENGTH = 200;
const MAX_OBJECT_KEYS = 200;
const MAX_STRING_LENGTH = 4000;

/**
 * Converts an arbitrary submitted record into a value Prisma can persist.
 *
 * @param input - the raw record from the request body
 * @returns a record whose values are all JSON-representable
 */
export function toStorableJson(input: Record<string, unknown>): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  let count = 0;

  for (const [key, value] of Object.entries(input)) {
    if (!key) continue;
    if (count >= MAX_OBJECT_KEYS) {
      out.__truncado = `+${Object.keys(input).length - MAX_OBJECT_KEYS} chaves omitidas`;
      break;
    }
    out[key.slice(0, 200)] = coerce(value, 0);
    count++;
  }

  return out;
}

/**
 * Casts a coerced record to Prisma's input type.
 *
 * Safe because `toStorableJson` has already walked every value: there is no
 * `undefined`, no function, no `BigInt` and no cycle left, and null is legal in
 * a `jsonb` column even though Prisma's own type does not say so.
 */
export function asPrismaJson(value: Record<string, JsonValue>): Prisma.InputJsonObject {
  return value as unknown as Prisma.InputJsonObject;
}

function coerce(value: unknown, depth: number): JsonValue {
  if (value === null) return null;

  const type = typeof value;

  if (type === 'string') {
    const text = value as string;
    return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}…` : text;
  }
  if (type === 'boolean') return value as boolean;
  if (type === 'number') {
    const n = value as number;
    // NaN and Infinity are not valid JSON. Postgres would reject the whole row.
    return Number.isFinite(n) ? n : String(n);
  }
  if (type === 'bigint') return (value as bigint).toString();
  if (type === 'undefined' || type === 'function' || type === 'symbol') return null;

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return value.message.slice(0, MAX_STRING_LENGTH);

  if (depth >= MAX_DEPTH) return '[profundidade máxima]';

  if (Array.isArray(value)) {
    const sliced = value.slice(0, MAX_ARRAY_LENGTH);
    const mapped = sliced.map((entry) => coerce(entry, depth + 1));
    if (value.length > MAX_ARRAY_LENGTH) mapped.push(`[+${value.length - MAX_ARRAY_LENGTH} itens omitidos]`);
    return mapped;
  }

  if (type === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, JsonValue> = {};
    let count = 0;
    for (const [key, entry] of Object.entries(record)) {
      if (count >= MAX_OBJECT_KEYS) {
        out['__truncado'] = `+${Object.keys(record).length - MAX_OBJECT_KEYS} chaves omitidas`;
        break;
      }
      out[key.slice(0, 200)] = coerce(entry, depth + 1);
      count++;
    }
    return out;
  }

  return String(value);
}
