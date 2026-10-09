import { PBI_ENDPOINTS, type PbiResource } from "./catalog";
import { readDiskCache, readDiskCacheStale, writeDiskCache } from "./disk-cache";
import type { OsResumidaResponse, PbiResult } from "./types";

const memoryCache = new Map<string, { expires: number; payload: PbiResult<unknown> }>();
const inflight = new Map<string, Promise<PbiResult<unknown>>>();

/** Recursos lentos / estáveis: TTL longo + disco (sobrevive a redeploy). */
const DISK_CACHED_RESOURCES = new Set<PbiResource>(["equipamentos"]);

function parseSeconds(envName: string, fallback: number): number {
  const n = Number(process.env[envName] ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** TTL em ms — equipamentos mudam pouco (padrão 12h); demais seguem PBI_CACHE_SECONDS. */
export function cacheTtlMs(resource: PbiResource): number {
  if (resource === "equipamentos") {
    return parseSeconds("PBI_CACHE_EQUIPAMENTOS_SECONDS", 43_200) * 1000;
  }
  return parseSeconds("PBI_CACHE_SECONDS", 900) * 1000;
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
    memoryCache.clear();
    return;
  }
  const prefix = `${resource}:`;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

async function fetchPbiNetwork<T>(
  resource: PbiResource,
  url: string,
  cacheKey: string,
): Promise<PbiResult<T>> {
  const endpoint = PBI_ENDPOINTS[resource];
  const token = process.env[endpoint.tokenEnv];
  if (!token) {
    return {
      ok: false,
      status: 500,
      message: `Token ausente (${endpoint.tokenEnv}). Configure o .env.local.`,
    };
  }

  const ttl = cacheTtlMs(resource);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        [endpoint.authHeader]: token,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text.slice(0, 280) || `Erro ${response.status} em ${endpoint.path}`;
      try {
        const parsed = JSON.parse(text) as { Message?: string };
        if (parsed.Message) message = parsed.Message;
      } catch {
        /* keep text */
      }

      // Preferir disco stale a falha transitória (equipamentos).
      if (DISK_CACHED_RESOURCES.has(resource)) {
        const stale = readDiskCacheStale<T>(resource, cacheKey);
        if (stale) {
          memoryCache.set(cacheKey, { expires: Date.now() + Math.min(ttl, 30 * 60_000), payload: stale });
          return stale;
        }
      }

      const failure: PbiResult<T> = {
        ok: false,
        status: response.status,
        message,
        disabled: endpoint.pending && (response.status === 401 || response.status === 404),
        pendingReason: endpoint.pendingReason,
      };
      memoryCache.set(cacheKey, {
        expires: Date.now() + Math.min(ttl, 5 * 60_000),
        payload: failure,
      });
      return failure;
    }

    const json = (await response.json()) as unknown;
    const normalized = normalizeData(resource, json);
    const success: PbiResult<T> = {
      ok: true,
      data: normalized.data as T,
      total: normalized.total,
      cachedAt: new Date().toISOString(),
    };
    memoryCache.set(cacheKey, { expires: Date.now() + ttl, payload: success });
    if (DISK_CACHED_RESOURCES.has(resource)) {
      writeDiskCache(resource, cacheKey, success, ttl);
    }
    return success;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";

    if (DISK_CACHED_RESOURCES.has(resource)) {
      const stale = readDiskCacheStale<T>(resource, cacheKey);
      if (stale) {
        memoryCache.set(cacheKey, { expires: Date.now() + Math.min(ttl, 30 * 60_000), payload: stale });
        return stale;
      }
    }

    return {
      ok: false,
      status: null,
      message: aborted
        ? "Timeout ao consultar a API da GlobalThings (60s)."
        : "Falha de rede ao consultar a GlobalThings.",
      disabled: endpoint.pending,
      pendingReason: endpoint.pendingReason,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPbi<T>(
  resource: PbiResource,
  searchParams: URLSearchParams,
): Promise<PbiResult<T>> {
  const endpoint = PBI_ENDPOINTS[resource];
  if (!endpoint) {
    return { ok: false, status: 404, message: `Recurso desconhecido: ${resource}` };
  }

  const url = `${baseUrl()}${endpoint.path}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const cacheKey = `${resource}:${url}`;
  const ttl = cacheTtlMs(resource);

  const mem = memoryCache.get(cacheKey);
  if (mem && mem.expires > Date.now()) {
    return mem.payload as PbiResult<T>;
  }

  if (DISK_CACHED_RESOURCES.has(resource)) {
    const disk = readDiskCache<T>(resource, cacheKey);
    if (disk) {
      memoryCache.set(cacheKey, { expires: Date.now() + ttl, payload: disk });
      return disk;
    }
  }

  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<PbiResult<T>>;

  const job = fetchPbiNetwork<T>(resource, url, cacheKey).finally(() => {
    inflight.delete(cacheKey);
  });
  inflight.set(cacheKey, job as Promise<PbiResult<unknown>>);
  return job;
}
