import { parseBrNumber } from "./dates";
import { isEquipamentoMedico } from "./medical";
import type { EquipamentoItem } from "./types";

/** Meta de referência da planilha / gestão (~R$ 57 milhões) — só auditoria. */
export const PARQUE_META_REFERENCIA = 57_000_000;

export type ParqueValorCampo = "substituicao" | "aquisicao";

export type ParqueValorStats = {
  total: number;
  preenchidos: number;
  n: number;
  pctPreenchidos: number;
};

export type ParqueValorResumo = {
  nTotal: number;
  nMedicos: number;
  /** Soma ValorDeSubstituicao (> 0). Sem `incluirCustoSubstituicao=true` na API fica 0. */
  substituicao: {
    todos: ParqueValorStats;
    medicos: ParqueValorStats;
  };
  /**
   * Soma ValorDeAquisicao (> 0). Frequentemente suja (outliers) — só para comparação.
   * Não usar como denominador oficial.
   */
  aquisicao: {
    todos: ParqueValorStats;
    medicos: ParqueValorStats;
  };
  /** % da meta ~57 mi usando substituição de TODOS. */
  vsMetaTodosSubstituicao: number | null;
  /** % da meta ~57 mi usando substituição só médicos (auditoria). */
  vsMetaMedicosSubstituicao: number | null;
  notas: string[];
};

function statsCampo(items: EquipamentoItem[], campo: ParqueValorCampo): ParqueValorStats {
  const key = campo === "substituicao" ? "ValorDeSubstituicao" : "ValorDeAquisicao";
  let total = 0;
  let preenchidos = 0;
  for (const item of items) {
    const n = parseBrNumber(item[key]);
    if (n != null && n > 0) {
      total += n;
      preenchidos += 1;
    }
  }
  const n = items.length;
  return {
    total,
    preenchidos,
    n,
    pctPreenchidos: n ? (preenchidos / n) * 100 : 0,
  };
}

/**
 * Resume valores da API de equipamentos.
 * Denominador oficial = substituição de TODOS (não só médicos).
 * Exige lista com `incluirCustoSubstituicao=true`.
 */
export function resumirValorParqueApi(items: EquipamentoItem[]): ParqueValorResumo {
  const medicos = items.filter(isEquipamentoMedico);
  const subTodos = statsCampo(items, "substituicao");
  const subMedicos = statsCampo(medicos, "substituicao");
  const aqTodos = statsCampo(items, "aquisicao");
  const aqMedicos = statsCampo(medicos, "aquisicao");

  const vsMetaTodos =
    PARQUE_META_REFERENCIA > 0 ? (subTodos.total / PARQUE_META_REFERENCIA) * 100 : null;
  const vsMetaMedicos =
    PARQUE_META_REFERENCIA > 0 ? (subMedicos.total / PARQUE_META_REFERENCIA) * 100 : null;

  const notas: string[] = [
    "Denominador oficial: soma ValorDeSubstituicao de TODOS os equipamentos cadastrados.",
    "ValorDeSubstituicao só vem preenchido com incluirCustoSubstituicao=true na API.",
    "Soma só-médicos é exibida para auditoria — não entra no cálculo.",
    "ValorDeAquisicao costuma ter outliers — não usar como denominador.",
  ];

  return {
    nTotal: items.length,
    nMedicos: medicos.length,
    substituicao: { todos: subTodos, medicos: subMedicos },
    aquisicao: { todos: aqTodos, medicos: aqMedicos },
    vsMetaTodosSubstituicao: vsMetaTodos,
    vsMetaMedicosSubstituicao: vsMetaMedicos,
    notas,
  };
}

/**
 * Precedência: override manual (>0) → API persistida/live (todos) → null.
 * Env é tratado no store (resolveValorParque).
 */
export function valorParqueEfetivo(opts: {
  manual: number | null;
  apiTodosSubstituicao: number | null;
}): { valor: number | null; fonte: "manual" | "api" | null } {
  if (opts.manual != null && opts.manual > 0) {
    return { valor: opts.manual, fonte: "manual" };
  }
  if (opts.apiTodosSubstituicao != null && opts.apiTodosSubstituicao > 0) {
    return { valor: opts.apiTodosSubstituicao, fonte: "api" };
  }
  return { valor: null, fonte: null };
}
