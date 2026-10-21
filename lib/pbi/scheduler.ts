/**
 * Renovação agendada da cópia da GlobalThings (K11a/K11b), sem depender de acesso.
 * Renova SEMPRE todos os recursos de SCHEDULED_RESOURCES (OS 5 min, demais 1 h), com ou sem acesso recente:
 * - as consultas padrão das telas (lista explícita abaixo), mesmo que nunca tenham sido abertas;
 * - outros períodos guardados desses recursos, só se acessados nos últimos 7 dias.
 * Limite de MAX_CACHE_ROWS cópias: acima disso sai a de outro período acessada há mais tempo (padrões nunca).
 * Roda no processo Node de longa duração (Railway, App Sleeping desligado), iniciado por instrumentation.ts.
 * Uma busca por vez: o ciclo é serial e não se sobrepõe.
 */
import type { PbiResource } from "./catalog";
import { MIN_MS, OTHER_PERIOD_ACCESS_MS, SCHEDULED_RESOURCES, cachePolicy } from "./cache-policy";
import { listAllRows, readCacheRow } from "./cache-store";
import { cacheKeyFor, nowMs, pruneCache, refreshPbi } from "./client";
import { defaultScheduledQueries } from "./scheduled-queries";

export { defaultScheduledQueries } from "./scheduled-queries";

export const SCHEDULER_TICK_MS = MIN_MS;

let running = false;

/** Um ciclo: renova, uma por vez, as consultas cuja última renovação/tentativa passou do intervalo do recurso. */
export async function runSchedulerTick(): Promise<string[]> {
  if (running) return [];
  running = true;
  const refreshed: string[] = [];
  try {
    const scheduled = new Set<string>(SCHEDULED_RESOURCES);
    const alvos = new Map<string, { resource: PbiResource; qs: string }>();
    for (const { resource, params } of defaultScheduledQueries()) {
      const { key, qs } = cacheKeyFor(resource, params);
      alvos.set(key, { resource, qs });
    }
    // Outros períodos: só se acessados nos últimos 7 dias; depois a cópia fica guardada sem renovação.
    const desde = nowMs() - OTHER_PERIOD_ACCESS_MS;
    for (const row of listAllRows()) {
      if (alvos.has(row.cache_key) || !scheduled.has(row.resource) || row.last_access_at < desde) continue;
      alvos.set(row.cache_key, { resource: row.resource as PbiResource, qs: row.query });
    }
    for (const k of pruneCache()) alvos.delete(k);
    for (const [key, { resource, qs }] of alvos) {
      const row = readCacheRow(key);
      const last = Math.max(row?.fetched_at ?? 0, row?.last_attempt_at ?? 0);
      if (nowMs() - last < cachePolicy(resource).scheduledMs) continue;
      await refreshPbi(resource, qs, key);
      refreshed.push(key);
    }
  } catch (err) {
    console.error("[pbi-cache] agendador falhou", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
  return refreshed;
}

declare global {
  var __aionPbiScheduler: ReturnType<typeof setInterval> | undefined;
}

export function startPbiScheduler(tickMs = SCHEDULER_TICK_MS) {
  if (globalThis.__aionPbiScheduler) return;
  globalThis.__aionPbiScheduler = setInterval(() => {
    void runSchedulerTick();
  }, tickMs);
  globalThis.__aionPbiScheduler.unref?.();
  // Primeiro ciclo logo após subir: preenche recursos nunca abertos.
  setTimeout(() => void runSchedulerTick(), 5_000).unref?.();
  console.log(`[pbi-cache] agendador iniciado (tick ${Math.round(tickMs / 1000)}s; ${SCHEDULED_RESOURCES.length} recursos; OS 5 min, demais 1 h)`);
}
