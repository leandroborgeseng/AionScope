import { PBI_ENDPOINTS, type PbiResource } from "./catalog";
import { RETRY_BACKOFF_MS, STALE_MAX_MS, cachePolicy, isTokenErrorStatus } from "./cache-policy";
import { readCacheRow, recordFailure, recordSuccess, touchAccess, type CacheRow } from "./cache-store";
import type { OsResumidaResponse, PbiCacheMeta, PbiResult } from "./types";

/**
 * Cache da GlobalThings (escopo-cache.md v5):
 * - cópia persistida no SQLite do volume (/data, tabela pbi_cache, migração 012);
 * - abertura sempre servida da cópia (qualquer idade) e atualização em segundo plano;
 * - uma busca por vez por consulta (single-flight);
 * - renovação agendada no servidor (lib/pbi/scheduler.ts).
 */

/** Relógio injetável (testes usam relógio simulado). */
let clock: () => number = () => Date.now();
export function __setClockForTests(fn: (() => number) | null) {
  clock = fn ?? (() => Date.now());
}
export function nowMs() {
  return clock();
}

/** fetch injetável para testes. */
let fetchImpl: typeof fetch = (...args) => fetch(...args);
export function __setFetchForTests(fn: typeof fetch | null) {
  fetchImpl = fn ?? ((...args) => fetch(...args));
}

/** Consultas com busca em andamento (single-flight). */
const inflight = new Map<string, Promise<PbiResult<unknown>>>();
/** Cópia já desserializada em memória, invalidada quando fetched_at muda. */
const parsed = new Map<string, { fetchedAt: number; payload: { data: unknown; total?: number } }>();

export function isRefreshing(cacheKey: string) {
  return inflight.has(cacheKey);
}

function baseUrl() {
  return (process.env.PBI_BASE_URL ?? "https://sjh.globalthings.net").replace(/\/$/, "");
}

export function buildQuery(params: URLSearchParams, extras?: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams(params);
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value == null || value === "") continue;
      next.delete(key);
      if (Array.isArray(value)) {
        for (const item of value) if (item) next.append(key, item);
      } else {
        next.set(key, value);
      }
    }
  }
  return next;
}

function normalizeData(resource: PbiResource, json: unknown): { data: unknown; total?: number } {
  if (resource === "os-resumida" && json && typeof json === "object" && "Itens" in json) {
    const payload = json as OsResumidaResponse;
    return { data: payload.Itens ?? [], total: payload.TotalItens };
  }
  if (Array.isArray(json)) return { data: json, total: json.length };
  return { data: json };
}

export function invalidarCachePbi(resource?: PbiResource) {
  if (!resource) {
    parsed.clear();
    return;
  }
  const prefix = `${resource}:`;
  for (const key of parsed.keys()) {
    if (key.startsWith(prefix)) parsed.delete(key);
  }
}

export function cacheKeyFor(resource: PbiResource, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return { key: `${resource}:${qs}`, qs };
}

function urlFor(resource: PbiResource, qs: string) {
  return `${baseUrl()}${PBI_ENDPOINTS[resource].path}${qs ? `?${qs}` : ""}`;
}

type NetResult = { ok: true; data: unknown; total?: number } | { ok: false; status: number | null; message: string };

async function fetchNetwork(resource: PbiResource, url: string): Promise<NetResult> {
  const endpoint = PBI_ENDPOINTS[resource];
  const token = process.env[endpoint.tokenEnv];
  if (!token) {
    return { ok: false, status: 500, message: `Token ausente (${endpoint.tokenEnv}). Configure o .env.local.` };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { [endpoint.authHeader]: token, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text.slice(0, 280) || `Erro ${response.status} em ${endpoint.path}`;
      try {
        const p = JSON.parse(text) as { Message?: string };
        if (p.Message) message = p.Message;
      } catch {
        /* keep text */
      }
      return { ok: false, status: response.status, message };
    }
    const json = (await response.json()) as unknown;
    return { ok: true, ...normalizeData(resource, json) };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: null,
      message: aborted ? "Timeout ao consultar a API da GlobalThings (60s)." : "Falha de rede ao consultar a GlobalThings.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Busca na GlobalThings e grava a cópia. Single-flight: se já há busca para a consulta, devolve a mesma promessa.
 */
export function refreshPbi(resource: PbiResource, qs: string, cacheKey: string): Promise<PbiResult<unknown>> {
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const endpoint = PBI_ENDPOINTS[resource];
  const job = (async (): Promise<PbiResult<unknown>> => {
    const startedAt = clock();
    const net = await fetchNetwork(resource, urlFor(resource, qs));
    const at = clock();
    if (net.ok) {
      try {
        recordSuccess(cacheKey, resource, qs, JSON.stringify({ data: net.data, total: net.total }), at);
        parsed.set(cacheKey, { fetchedAt: at, payload: { data: net.data, total: net.total } });
      } catch (err) {
        console.error("[pbi-cache] falha ao gravar cópia", resource, err instanceof Error ? err.message : err);
      }
      const iso = new Date(at).toISOString();
      return { ok: true, data: net.data, total: net.total, cachedAt: iso, cache: { fetchedAt: iso, refreshing: false } };
    }
    try {
      recordFailure(cacheKey, resource, qs, net.status, net.message, startedAt);
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      status: net.status,
      message: net.message,
      disabled: endpoint.pending && (net.status === 401 || net.status === 404),
      pendingReason: endpoint.pendingReason,
    };
  })().finally(() => {
    inflight.delete(cacheKey);
  });
  inflight.set(cacheKey, job);
  return job;
}

function payloadOf(row: CacheRow): { data: unknown; total?: number } | null {
  if (!row.payload || row.fetched_at == null) return null;
  const memo = parsed.get(row.cache_key);
  if (memo && memo.fetchedAt === row.fetched_at) return memo.payload;
  try {
    const p = JSON.parse(row.payload) as { data: unknown; total?: number };
    if (!p || !("data" in p)) return null;
    parsed.set(row.cache_key, { fetchedAt: row.fetched_at, payload: p });
    return p;
  } catch {
    return null; // cópia corrompida: ignorada; a próxima busca com sucesso sobrescreve (K7)
  }
}

function metaOf(row: CacheRow, refreshing: boolean): PbiCacheMeta {
  const failedAfterCopy = row.last_error_at != null && row.fetched_at != null && row.last_error_at >= row.fetched_at;
  return {
    fetchedAt: new Date(row.fetched_at ?? 0).toISOString(),
    refreshing,
    ...(failedAfterCopy
      ? {
          lastErrorStatus: row.last_error_status,
          lastErrorAt: new Date(row.last_error_at ?? 0).toISOString(),
          tokenError: isTokenErrorStatus(row.last_error_status),
        }
      : {}),
  };
}

export async function fetchPbi<T>(
  resource: PbiResource,
  searchParams: URLSearchParams,
): Promise<PbiResult<T>> {
  const endpoint = PBI_ENDPOINTS[resource];
  if (!endpoint) {
    return { ok: false, status: 404, message: `Recurso desconhecido: ${resource}` };
  }
  const { key, qs } = cacheKeyFor(resource, searchParams);
  const now = clock();
  let row: CacheRow | null = null;
  try {
    row = readCacheRow(key);
    touchAccess(key, resource, qs, now);
  } catch (err) {
    console.error("[pbi-cache] leitura falhou", err instanceof Error ? err.message : err);
  }
  const copy = row ? payloadOf(row) : null;

  if (!row || !copy || row.fetched_at == null) {
    // Sem cópia: espera a busca (única por consulta).
    const result = await refreshPbi(resource, qs, key);
    return result as PbiResult<T>;
  }

  const age = now - row.fetched_at;
  const policy = cachePolicy(resource);
  const recentAttempt = row.last_attempt_at != null && now - row.last_attempt_at < RETRY_BACKOFF_MS;
  if (age > policy.onOpenMs && !recentAttempt && !inflight.has(key)) {
    void refreshPbi(resource, qs, key).catch(() => undefined);
  }
  const refreshing = inflight.has(key);
  const meta = metaOf(row, refreshing);

  // Cópia com mais de 7 dias e atualização falhou: indisponível (nunca 0% nem "Dentro").
  if (age > STALE_MAX_MS && !refreshing && meta.lastErrorAt) {
    return {
      ok: false,
      status: row.last_error_status ?? null,
      message: row.last_error_message || "GlobalThings indisponível e cópia com mais de 7 dias.",
      cachedAt: meta.fetchedAt,
      cache: meta,
    };
  }

  return {
    ok: true,
    data: copy.data as T,
    total: copy.total,
    cachedAt: meta.fetchedAt,
    cache: meta,
  };
}
