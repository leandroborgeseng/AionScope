/**
 * Política do cache da GlobalThings (escopo-cache.md v5). Intervalos em constante por recurso.
 * Módulo puro: usado no servidor (agendador/rota) e no cliente (faixas de idade).
 */
import type { PbiResource } from "./catalog";

export const MIN_MS = 60_000;
export const HOUR_MS = 60 * MIN_MS;
export const DAY_MS = 24 * HOUR_MS;

export type CachePolicy = {
  /** Renovação agendada no servidor, sem depender de acesso. */
  scheduledMs: number;
  /** Na abertura: busca em segundo plano só se a cópia for mais velha que isto. */
  onOpenMs: number;
};

/** Ordens de Serviço: quase tempo real (K11b). */
export const POLICY_OS: CachePolicy = { scheduledMs: 5 * MIN_MS, onOpenMs: 2 * MIN_MS };
/** Equipamentos, parque, cadastros e demais recursos (K11a). */
export const POLICY_CADASTROS: CachePolicy = { scheduledMs: HOUR_MS, onOpenMs: HOUR_MS };

export const OS_RESOURCES: ReadonlySet<PbiResource> = new Set<PbiResource>([
  "os-analitico",
  "os-resumida",
  "monitor-reacao",
  "monitor-atendimento",
]);

export function cachePolicy(resource: PbiResource): CachePolicy {
  return OS_RESOURCES.has(resource) ? POLICY_OS : POLICY_CADASTROS;
}

/** Faixas de idade da cópia (v2/v3). */
export const FRESH_MAX_MS = DAY_MS; // até 24 h: tela normal
export const STALE_MAX_MS = 7 * DAY_MS; // até 7 dias: aviso âmbar; acima: indisponível se a atualização falhar

/** Intervalo mínimo entre tentativas disparadas por abertura após uma falha (evita martelar a API). */
export const RETRY_BACKOFF_MS = MIN_MS;

export type CacheAgeBand = "normal" | "desatualizado" | "expirado";

export function cacheAgeBand(fetchedAtMs: number, nowMs: number): CacheAgeBand {
  const age = nowMs - fetchedAtMs;
  if (age <= FRESH_MAX_MS) return "normal";
  if (age <= STALE_MAX_MS) return "desatualizado";
  return "expirado";
}

/** "dd/mm HH:MM" no fuso de São Paulo. */
export function formatCacheDateBRT(iso: string | number): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

export function isTokenErrorStatus(status: number | null | undefined): boolean {
  return status === 401 || status === 403;
}
