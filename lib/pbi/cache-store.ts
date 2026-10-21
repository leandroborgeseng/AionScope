/** Persistência da cópia da GlobalThings na tabela pbi_cache (migração 012). Nunca guarda token. */
import { getDb } from "@/lib/db/client";

export type CacheRow = {
  cache_key: string;
  resource: string;
  query: string;
  payload: string | null;
  fetched_at: number | null;
  last_attempt_at: number | null;
  last_error_status: number | null;
  last_error_message: string | null;
  last_error_at: number | null;
  last_access_at: number;
};

export function readCacheRow(key: string): CacheRow | null {
  return (getDb().prepare("SELECT * FROM pbi_cache WHERE cache_key = ?").get(key) as CacheRow | undefined) ?? null;
}

export function touchAccess(key: string, resource: string, query: string, at: number) {
  getDb()
    .prepare(
      `INSERT INTO pbi_cache (cache_key, resource, query, last_access_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET last_access_at = excluded.last_access_at`,
    )
    .run(key, resource, query, at);
}

/** Gravação atômica (uma instrução UPSERT). */
export function recordSuccess(key: string, resource: string, query: string, payload: string, at: number) {
  getDb()
    .prepare(
      `INSERT INTO pbi_cache (cache_key, resource, query, payload, fetched_at, last_attempt_at, last_access_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at,
         last_attempt_at = excluded.last_attempt_at, last_error_status = NULL, last_error_message = NULL, last_error_at = NULL`,
    )
    .run(key, resource, query, payload, at, at, at);
}

export function recordFailure(
  key: string,
  resource: string,
  query: string,
  status: number | null,
  message: string,
  at: number,
) {
  getDb()
    .prepare(
      `INSERT INTO pbi_cache (cache_key, resource, query, last_attempt_at, last_error_status, last_error_message, last_error_at, last_access_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET last_attempt_at = excluded.last_attempt_at,
         last_error_status = excluded.last_error_status, last_error_message = excluded.last_error_message,
         last_error_at = excluded.last_error_at`,
    )
    .run(key, resource, query, at, status, message.slice(0, 280), at, at);
}

/** Consultas acessadas nos últimos `sinceMs` (as que o agendador mantém renovadas). */
export function listScheduledRows(accessedSince: number): CacheRow[] {
  return getDb()
    .prepare("SELECT * FROM pbi_cache WHERE last_access_at >= ? ORDER BY resource, cache_key")
    .all(accessedSince) as CacheRow[];
}
