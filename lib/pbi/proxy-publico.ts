/**
 * M1: o proxy /api/pbi/[resource] é usado por telas públicas (parque, cronograma, documentação,
 * equipamento, etiquetas, indicadores…). Sem sessão de admin, os campos em R$ saem da resposta;
 * o resto continua igual. Com sessão, a resposta não muda.
 *
 * O corte acontece DEPOIS do cache do PBI (chave resource:querystring guarda a resposta completa),
 * sempre sobre cópias — o objeto em cache nunca é alterado e nunca é servido inteiro sem sessão.
 */
import type { PbiResource } from "./catalog";

export const CAMPOS_RS_SEM_SESSAO: Partial<Record<PbiResource, readonly string[]>> = {
  equipamentos: ["ValorDeSubstituicao", "ValorDeAquisicao"],
};

type ComData = { ok: true; data: unknown } & Record<string, unknown>;

export function semCamposRs<T>(resource: PbiResource, result: T, logado: boolean): T {
  const campos = CAMPOS_RS_SEM_SESSAO[resource];
  if (logado || !campos) return result;
  const r = result as unknown as ComData;
  if (!r || r.ok !== true || !Array.isArray(r.data)) return result;
  const data = (r.data as unknown[]).map((item) => {
    if (!item || typeof item !== "object") return item;
    const copia = { ...(item as Record<string, unknown>) };
    for (const c of campos) delete copia[c];
    return copia;
  });
  return { ...r, data, camposOcultos: [...campos] } as unknown as T;
}
