import { nowInSaoPaulo, parseBrNumber, parsePbiDate } from "./dates";
import type { EquipamentoItem, OsAnaliticoItem } from "./types";
import { isOsCancelada, isTipoManutencaoEc } from "./volume-ec";

/** Campo canônico para “cadastro” do parque (preenchimento ~100% na API). */
export const CAMPO_CADASTRO_PARQUE = "DataDeCadastro" as const;

export const EVOLUCAO_CHAMADOS_REGRA = [
  "TipoDeManutencao no recorte de Engenharia Clínica (mesmo critério do volume EC)",
  "exclui M - (predial) e O - (obras)",
  "inclui A - …, ENGENHARIA CLÍNICA, CALIBRA*, SEGURANÇA ELÉTRICA/TSE, INSTRUMENTAL, PREVENTIVA EQUIPAMENTOS MÉDICOS",
  "exclui OS canceladas",
  "ano = ano civil da Abertura (America/Sao_Paulo via parse da API)",
] as const;

export type EvolucaoParqueAno = {
  ano: number;
  /** Equipamentos novos cadastrados neste ano. */
  entrantes: number;
  /** Parque acumulado ao fim do ano (cadastro ≤ ano e ainda não inativado). */
  quantidade: number;
  /** Soma ValorDeSubstituicao (> 0) do parque acumulado ao fim do ano. */
  valorSubstituicao: number;
  /** Quantos do parque acumulado têm ValorDeSubstituicao > 0. */
  comValor: number;
};

export type EvolucaoChamadoAno = {
  ano: number;
  /** Chamados EC abertos neste ano (não cancelados). */
  quantidade: number;
};

export type EvolucaoHistorica = {
  atualizadoEm: string;
  campoCadastro: typeof CAMPO_CADASTRO_PARQUE;
  anoInicio: number | null;
  anoFim: number;
  /** Quantidade de equipamentos com DataDeCadastro parseável. */
  equipamentosComCadastro: number;
  /** Equipamentos sem DataDeCadastro válida (ignorados na série). */
  equipamentosSemCadastro: number;
  parque: EvolucaoParqueAno[];
  chamados: EvolucaoChamadoAno[];
  chamadosTotal: number;
  chamadosPeriodoApi: string;
  avisos: string[];
};

function endOfYear(year: number): Date {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

function valorSubstituicao(item: EquipamentoItem): number {
  const n = parseBrNumber(item.ValorDeSubstituicao);
  return n != null && n > 0 ? n : 0;
}

/**
 * Ano civil da data de cadastro. Só `DataDeCadastro` — não faz fallback para
 * aquisição/instalação (aquisição vem vazia em ~60% do parque).
 */
export function anoCadastroEquipamento(item: Pick<EquipamentoItem, "DataDeCadastro">): number | null {
  const d = parsePbiDate(item.DataDeCadastro);
  if (!d) return null;
  const y = d.getFullYear();
  return y >= 1990 && y <= 2100 ? y : null;
}

export function anoAberturaOs(item: Pick<OsAnaliticoItem, "Abertura">): number | null {
  const d = parsePbiDate(item.Abertura);
  if (!d) return null;
  const y = d.getFullYear();
  return y >= 1990 && y <= 2100 ? y : null;
}

/** Ainda fazia parte do parque no fim do ano? (cadastro ≤ ano e inativação depois, ou sem inativação). */
export function noParqueNoFimDoAno(
  item: Pick<EquipamentoItem, "DataDeCadastro" | "DataDeInativação">,
  ano: number,
): boolean {
  const cadastro = parsePbiDate(item.DataDeCadastro);
  if (!cadastro || cadastro > endOfYear(ano)) return false;
  const inativacao = parsePbiDate(item["DataDeInativação"]);
  if (!inativacao) return true;
  return inativacao > endOfYear(ano);
}

export function isChamadoEngenhariaClinica(
  os: Pick<OsAnaliticoItem, "TipoDeManutencao" | "SituacaoDaOS">,
): boolean {
  if (isOsCancelada(os)) return false;
  return isTipoManutencaoEc(os.TipoDeManutencao);
}

/**
 * Série ano a ano do parque: do menor DataDeCadastro até o ano corrente.
 * Quantidade e valor são acumulados (estoque no fim de cada ano).
 */
export function agregarEvolucaoParque(
  equipamentos: EquipamentoItem[],
  hoje = nowInSaoPaulo(),
): {
  anoInicio: number | null;
  anoFim: number;
  comCadastro: number;
  semCadastro: number;
  serie: EvolucaoParqueAno[];
} {
  const anoFim = hoje.getFullYear();
  let anoInicio: number | null = null;
  let comCadastro = 0;
  let semCadastro = 0;
  const entrantesPorAno = new Map<number, number>();

  for (const item of equipamentos) {
    const ano = anoCadastroEquipamento(item);
    if (ano == null) {
      semCadastro += 1;
      continue;
    }
    comCadastro += 1;
    if (anoInicio == null || ano < anoInicio) anoInicio = ano;
    entrantesPorAno.set(ano, (entrantesPorAno.get(ano) ?? 0) + 1);
  }

  if (anoInicio == null) {
    return { anoInicio: null, anoFim, comCadastro, semCadastro, serie: [] };
  }

  const inicio = Math.min(anoInicio, anoFim);
  const serie: EvolucaoParqueAno[] = [];
  for (let ano = inicio; ano <= anoFim; ano += 1) {
    let quantidade = 0;
    let valorSubstituicaoTotal = 0;
    let comValor = 0;
    for (const item of equipamentos) {
      if (!noParqueNoFimDoAno(item, ano)) continue;
      quantidade += 1;
      const v = valorSubstituicao(item);
      if (v > 0) {
        valorSubstituicaoTotal += v;
        comValor += 1;
      }
    }
    serie.push({
      ano,
      entrantes: entrantesPorAno.get(ano) ?? 0,
      quantidade,
      valorSubstituicao: valorSubstituicaoTotal,
      comValor,
    });
  }

  return { anoInicio: inicio, anoFim, comCadastro, semCadastro, serie };
}

/**
 * Contagem anual de chamados EC por ano de Abertura.
 * Se `anoInicio`/`anoFim` forem passados, preenche anos sem chamado com 0.
 */
export function agregarEvolucaoChamados(
  os: OsAnaliticoItem[],
  opts?: { anoInicio?: number | null; anoFim?: number; hoje?: Date },
): { serie: EvolucaoChamadoAno[]; total: number; anoInicio: number | null } {
  const hoje = opts?.hoje ?? nowInSaoPaulo();
  const anoFim = opts?.anoFim ?? hoje.getFullYear();
  const porAno = new Map<number, number>();
  let total = 0;
  let menor: number | null = null;

  for (const item of os) {
    if (!isChamadoEngenhariaClinica(item)) continue;
    const ano = anoAberturaOs(item);
    if (ano == null || ano > anoFim) continue;
    total += 1;
    porAno.set(ano, (porAno.get(ano) ?? 0) + 1);
    if (menor == null || ano < menor) menor = ano;
  }

  const inicio =
    opts?.anoInicio != null
      ? opts.anoInicio
      : menor != null
        ? menor
        : null;

  if (inicio == null) {
    return { serie: [], total, anoInicio: null };
  }

  const serie: EvolucaoChamadoAno[] = [];
  for (let ano = inicio; ano <= anoFim; ano += 1) {
    serie.push({ ano, quantidade: porAno.get(ano) ?? 0 });
  }
  return { serie, total, anoInicio: inicio };
}

export function montarEvolucaoHistorica(opts: {
  equipamentos: EquipamentoItem[];
  os: OsAnaliticoItem[];
  chamadosPeriodoApi: string;
  hoje?: Date;
  avisos?: string[];
}): EvolucaoHistorica {
  const hoje = opts.hoje ?? nowInSaoPaulo();
  const parque = agregarEvolucaoParque(opts.equipamentos, hoje);
  const chamados = agregarEvolucaoChamados(opts.os, {
    // Alinha eixo X ao parque quando houver cadastro; senão usa o menor ano de OS.
    anoInicio: parque.anoInicio,
    anoFim: parque.anoFim,
    hoje,
  });

  const avisos = [...(opts.avisos ?? [])];
  if (parque.semCadastro > 0) {
    avisos.push(`${parque.semCadastro} equipamento(s) sem ${CAMPO_CADASTRO_PARQUE} válida — fora da série.`);
  }
  if (parque.anoInicio == null) {
    avisos.push("Nenhum equipamento com DataDeCadastro parseável.");
  }

  return {
    atualizadoEm: hoje.toISOString(),
    campoCadastro: CAMPO_CADASTRO_PARQUE,
    anoInicio: parque.anoInicio,
    anoFim: parque.anoFim,
    equipamentosComCadastro: parque.comCadastro,
    equipamentosSemCadastro: parque.semCadastro,
    parque: parque.serie,
    chamados: chamados.serie,
    chamadosTotal: chamados.total,
    chamadosPeriodoApi: opts.chamadosPeriodoApi,
    avisos,
  };
}
