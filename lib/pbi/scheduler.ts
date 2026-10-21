/**
 * Renovação agendada da cópia da GlobalThings (K11a/K11b), sem depender de acesso.
 * Roda no processo Node de longa duração (Railway, App Sleeping desligado), iniciado por instrumentation.ts.
 * Uma busca por vez: o ciclo é serial e não se sobrepõe.
 */
import type { PbiResource } from "./catalog";
import { DAY_MS, MIN_MS, cachePolicy } from "./cache-policy";
import { listScheduledRows } from "./cache-store";
import { nowMs, refreshPbi } from "./client";

/** Só renova consultas acessadas nos últimos 30 dias. */
export const SCHEDULE_ACCESS_WINDOW_MS = 30 * DAY_MS;
export const SCHEDULER_TICK_MS = MIN_MS;

let running = false;

/** Um ciclo: renova, uma por vez, as consultas cuja última tentativa passou do intervalo do recurso. */
export async function runSchedulerTick(): Promise<string[]> {
  if (running) return [];
  running = true;
  const refreshed: string[] = [];
  try {
    const now = nowMs();
    for (const row of listScheduledRows(now - SCHEDULE_ACCESS_WINDOW_MS)) {
      const { scheduledMs } = cachePolicy(row.resource as PbiResource);
      const last = Math.max(row.fetched_at ?? 0, row.last_attempt_at ?? 0);
      if (nowMs() - last < scheduledMs) continue;
      await refreshPbi(row.resource as PbiResource, row.query, row.cache_key);
      refreshed.push(row.cache_key);
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
  console.log(`[pbi-cache] agendador iniciado (tick ${Math.round(tickMs / 1000)}s; OS 5 min, demais 1 h)`);
}
