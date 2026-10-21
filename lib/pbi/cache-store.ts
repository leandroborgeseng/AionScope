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

/** Todas as consultas guardadas (sem filtro de acesso recente). */
export function listAllRows(): CacheRow[] {
  return getDb().prepare("SELECT * FROM pbi_cache ORDER BY resource, cache_key").all() as CacheRow[];
}

export function countRows(): number {
  return (getDb().prepare("SELECT COUNT(*) n FROM pbi_cache").get() as { n: number }).n;
}

/** Apaga só linhas de pbi_cache (descartáveis): as de outro período acessadas há mais tempo, até `max`. Nunca as protegidas. */
export function pruneRows(max: number, protegidas: Set<string>): string[] {
  const db = getDb();
  const excesso = countRows() - max;
  if (excesso <= 0) return [];
  const candidatas = db
    .prepare("SELECT cache_key FROM pbi_cache ORDER BY last_access_at ASC, cache_key ASC")
    .all() as Array<{ cache_key: string }>;
  const apagar = candidatas.map((r) => r.cache_key).filter((k) => !protegidas.has(k)).slice(0, excesso);
  const del = db.prepare("DELETE FROM pbi_cache WHERE cache_key = ?");
  db.transaction(() => apagar.forEach((k) => del.run(k)))();
  return apagar;
}
