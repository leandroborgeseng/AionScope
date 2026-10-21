import type { PbiResult } from "./types";

export type FreshnessResumo = {
  /** Cópia mais antiga entre as consultas da tela (a que limita a confiança). */
  fetchedAtMs: number | null;
  refreshing: boolean;
  tokenError: boolean;
  tokenStatus: number | null;
};

export function resumirFreshness(results: Array<PbiResult<unknown> | undefined>): FreshnessResumo {
  let fetchedAtMs: number | null = null;
  let refreshing = false;
  let tokenError = false;
  let tokenStatus: number | null = null;
  for (const r of results) {
    const c = r?.cache;
    if (!c) continue;
    if (r.ok) {
      const t = Date.parse(c.fetchedAt);
      if (Number.isFinite(t)) fetchedAtMs = fetchedAtMs == null ? t : Math.min(fetchedAtMs, t);
    }
    if (c.refreshing) refreshing = true;
    if (c.tokenError) {
      tokenError = true;
      tokenStatus = c.lastErrorStatus ?? tokenStatus;
    }
  }
  return { fetchedAtMs, refreshing, tokenError, tokenStatus };
}
