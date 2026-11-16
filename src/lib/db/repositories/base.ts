import type { Table } from "dexie";

import type { Base, ISODate } from "@/types/domain";

/** Inclusive day range, both bounds are `YYYY-MM-DD`. */
export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export const ALL_TIME: DateRange = { start: "0000-01-01", end: "9999-12-31" };

export type CreateInput<T extends Base> = Omit<T, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export type UpdateInput<T extends Base> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

export interface Repository<T extends Base> {
  create(input: CreateInput<T>): Promise<T>;
  update(id: string, patch: UpdateInput<T>): Promise<T>;
  remove(id: string): Promise<void>;
  getById(id: string): Promise<T | undefined>;
  listByDateRange(range?: DateRange): Promise<T[]>;
  listAll(): Promise<T[]>;
}

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The single place that writes records, so ids and timestamps are always set
 * the same way. Every repository is a thin configuration of this helper.
 */
export function createRepository<T extends Base>(options: {
  /** Resolved lazily so the database is never opened during server rendering. */
  table: () => Table<T, string>;
  /** Indexed day field (`date`). Omit for tables without one, e.g. settings. */
  dateKey?: Extract<keyof T, string>;
  /** Used in error messages. */
  label: string;
}): Repository<T> {
  const { table, dateKey, label } = options;

  async function create(input: CreateInput<T>): Promise<T> {
    const timestamp = nowIso();
    const record = {
      ...(input as object),
      id: input.id ?? newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    } as T;

    await table().add(record);
    return record;
  }

  async function update(id: string, patch: UpdateInput<T>): Promise<T> {
    const existing = await table().get(id);
    if (!existing) {
      throw new Error(`${label}: no record found with id "${id}".`);
    }

    const record = {
      ...existing,
      ...(patch as object),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    } as T;

    await table().put(record);
    return record;
  }

  async function remove(id: string): Promise<void> {
    await table().delete(id);
  }

  async function getById(id: string): Promise<T | undefined> {
    return table().get(id);
  }

  async function listByDateRange(range: DateRange = ALL_TIME): Promise<T[]> {
    const rows = dateKey
      ? await table().where(dateKey).between(range.start, range.end, true, true).toArray()
      : await table()
          .filter((row) => {
            // Records without a day index fall back to their creation timestamp.
            const createdAt = row.createdAt;
            return (
              createdAt >= range.start &&
              createdAt <= `${range.end}T23:59:59.999Z`
            );
          })
          .toArray();

    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function listAll(): Promise<T[]> {
    return table().toArray();
  }

  return { create, update, remove, getById, listByDateRange, listAll };
}
