/**
 * Leitura da cópia já gravada em pbi_cache. Não chama o Effort e não escreve na tabela.
 */
import { getDb } from "@/lib/db/client";
import { STALE_MAX_MS } from "@/lib/pbi/cache-policy";

type Linha = {
  payload: string | null;
  fetched_at: number | null;
  last_error_at: number | null;
};

export type CopiaLista = {
  itens: unknown[];
  fetchedAt: string;
  idadeSegundos: number;
};

export type FalhaCopia =
  | { ok: false; motivo: "ausente" }
  | { ok: false; motivo: "expirada"; fetchedAt: string; idadeSegundos: number };

function linhasDo(recurso: string) {
  return getDb()
    .prepare("SELECT payload, fetched_at, last_error_at FROM pbi_cache WHERE resource = ?")
    .all(recurso) as Linha[];
}

function falhouDepois(linha: Linha) {
  return linha.fetched_at != null && linha.last_error_at != null && linha.last_error_at >= linha.fetched_at;
}

/** A cópia com mais itens. Empate fica com a mais nova. */
export function lerLista(recurso: string, agora = Date.now()): { ok: true } & CopiaLista | FalhaCopia {
  let melhor: { itens: unknown[]; fetchedAt: number; falhou: boolean } | null = null;
  for (const linha of linhasDo(recurso)) {
    if (!linha.payload || linha.fetched_at == null) continue;
    let parsed: { data?: unknown };
    try {
      parsed = JSON.parse(linha.payload) as { data?: unknown };
    } catch {
      continue;
    }
    if (!Array.isArray(parsed.data)) continue;
    const candidato = { itens: parsed.data, fetchedAt: linha.fetched_at, falhou: falhouDepois(linha) };
    if (
      !melhor ||
      candidato.itens.length > melhor.itens.length ||
      (candidato.itens.length === melhor.itens.length && candidato.fetchedAt > melhor.fetchedAt)
    ) {
      melhor = candidato;
    }
  }
  if (!melhor) return { ok: false, motivo: "ausente" };
  const idadeMs = Math.max(0, agora - melhor.fetchedAt);
  const meta = {
    fetchedAt: new Date(melhor.fetchedAt).toISOString(),
    idadeSegundos: Math.floor(idadeMs / 1000),
  };
  if (idadeMs > STALE_MAX_MS && melhor.falhou) return { ok: false, motivo: "expirada", ...meta };
  return { ok: true, itens: melhor.itens, ...meta };
}

export type FrescorRecurso = {
  recurso: string;
  fetchedAt: string | null;
  idadeSegundos: number | null;
  atualizacaoFalhou: boolean;
};

/** Idade da cópia mais nova de cada recurso. Sem payload, a idade fica nula — nunca zero inventado. */
export function frescorDos(recursos: readonly string[], agora = Date.now()): FrescorRecurso[] {
  return recursos.map((recurso) => {
    let fetchedAt: number | null = null;
    let falhou = false;
    let teveErro = false;
    for (const linha of linhasDo(recurso)) {
      if (linha.last_error_at != null) teveErro = true;
      if (linha.fetched_at == null) continue;
      if (fetchedAt == null || linha.fetched_at > fetchedAt) {
        fetchedAt = linha.fetched_at;
        falhou = falhouDepois(linha);
      }
    }
    if (fetchedAt == null) {
      return { recurso, fetchedAt: null, idadeSegundos: null, atualizacaoFalhou: teveErro };
    }
    return {
      recurso,
      fetchedAt: new Date(fetchedAt).toISOString(),
      idadeSegundos: Math.max(0, Math.floor((agora - fetchedAt) / 1000)),
      atualizacaoFalhou: falhou,
    };
  });
}

export function copiaVencida(item: FrescorRecurso) {
  return item.atualizacaoFalhou && item.idadeSegundos != null && item.idadeSegundos * 1000 > STALE_MAX_MS;
}
