/**
 * Renovação agendada da cópia da GlobalThings (K11a/K11b), sem depender de acesso.
 * Renova SEMPRE todos os recursos de SCHEDULED_RESOURCES (OS 5 min, demais 1 h), com ou sem acesso recente:
 * - as consultas padrão das telas (lista explícita abaixo), mesmo que nunca tenham sido abertas;
 * - todas as consultas já guardadas desses recursos (filtros usados nas telas), sem limite de acesso.
 * Roda no processo Node de longa duração (Railway, App Sleeping desligado), iniciado por instrumentation.ts.
 * Uma busca por vez: o ciclo é serial e não se sobrepõe.
 */
import type { PbiResource } from "./catalog";
import { MIN_MS, SCHEDULED_RESOURCES, cachePolicy } from "./cache-policy";
import { listAllRows, readCacheRow } from "./cache-store";
import { cacheKeyFor, nowMs, refreshPbi } from "./client";
import { startOfMonthISO, todayISO } from "./dates";
import { EMPTY_FILTERS, toUpstreamParams, type DashboardFilters } from "./filters";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API } from "./volume-ec";

export const SCHEDULER_TICK_MS = MIN_MS;

/** Consultas padrão das telas de indicadores (mesmos parâmetros que os hooks enviam). */
export function defaultScheduledQueries(): Array<{ resource: PbiResource; params: URLSearchParams }> {
  const mes: DashboardFilters = { ...EMPTY_FILTERS, from: startOfMonthISO(), to: todayISO(), tipoManutencao: "Todos", somenteMedicos: false };
  const out: Array<{ resource: PbiResource; params: URLSearchParams }> = [];
  for (const resource of SCHEDULED_RESOURCES) out.push({ resource, params: toUpstreamParams(resource, mes) });
  // Indicador custo/parque e OS (ano): OS analítica como em useOsAnaliticoRollingYear.
  out.push({
    resource: "os-analitico",
    params: toUpstreamParams("os-analitico", { ...mes, tipoManutencao: VOLUME_EC_TIPO_API }, { periodo: VOLUME_EC_PERIODO_API, qtdPorPagina: "100000" }),
  });
  // Equipamentos como em useMedicalIndex e no card custo/parque.
  for (const extras of [
    { apenasAtivos: "false", incluirComponentes: "false", incluirCustoSubstituicao: "false" },
    { apenasAtivos: "true", incluirComponentes: "false", incluirCustoSubstituicao: "true" },
  ]) {
    out.push({ resource: "equipamentos", params: toUpstreamParams("equipamentos", mes, extras) });
  }
  return out;
}

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
    for (const row of listAllRows()) {
      if (scheduled.has(row.resource)) alvos.set(row.cache_key, { resource: row.resource as PbiResource, qs: row.query });
    }
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
