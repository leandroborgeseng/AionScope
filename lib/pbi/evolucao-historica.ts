import { nowInSaoPaulo, parseBrNumber, parsePbiDate } from "./dates";
import { isEquipamentoMedico } from "./medical";
import type { EquipamentoItem, OsAnaliticoItem } from "./types";
import { isOsCancelada, isTipoManutencaoEc } from "./volume-ec";

/** Campo canônico para “cadastro” do parque (preenchimento ~100% na API). */
export const CAMPO_CADASTRO_PARQUE = "DataDeCadastro" as const;

/** Mesmo recorte da Sala / ciclo: médico + ativo (histórico via DataDeInativação). */
export const EVOLUCAO_PARQUE_REGRA = [
  "somente equipamentos médicos (isEquipamentoMedico — exclui predial/infra/hotelaria)",
  "ativo no fim do ano: DataDeCadastro ≤ ano e (DataDeInativação > fim do ano, ou sem inativação e Status = ATIVO)",
  "INATIVO sem DataDeInativação não entra no estoque (evita inflar o parque)",
  "quantidade e ValorDeSubstituicao são acumulados ao fim de cada ano",
] as const;

export const EVOLUCAO_CHAMADOS_REGRA = [
  "TipoDeManutencao no recorte de Engenharia Clínica (mesmo critério do volume EC)",
  "exclui M - (predial) e O - (obras)",
  "inclui A - …, ENGENHARIA CLÍNICA, CALIBRA*, SEGURANÇA ELÉTRICA/TSE, INSTRUMENTAL, PREVENTIVA EQUIPAMENTOS MÉDICOS",
  "exclui OS canceladas",
  "ano = ano civil da Abertura (America/Sao_Paulo via parse da API)",
] as const;

/** Regressão linear y = a·x + b (x = ano civil). `a` = crescimento médio por ano. */
export type RegressaoLinear = {
  a: number;
  b: number;
  n: number;
  /** R² (0–1); null se n < 2. */
  r2: number | null;
};

/**
 * Mínimos quadrados simples. Retorna null com menos de 2 pontos.
 * `a` é o coeficiente angular (variação de y por unidade de x / ano).
 */
export function regressaoLinear(pontos: Array<{ x: number; y: number }>): RegressaoLinear | null {
  const validos = pontos.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (validos.length < 2) return null;

  const n = validos.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of validos) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const den = n * sumXX - sumX * sumX;
  if (den === 0) return null;
  const a = (n * sumXY - sumX * sumY) / den;
  const b = (sumY - a * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of validos) {
    const yHat = a * p.x + b;
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - yHat) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { a, b, n, r2 };
}

/** Avalia a reta nos anos dados (para plotar a tendência). */
export function pontosTendencia(
  reg: RegressaoLinear,
  anos: number[],
): Array<{ ano: number; tendencia: number }> {
  return anos.map((ano) => ({ ano, tendencia: reg.a * ano + reg.b }));
}

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
  /** Quantidade de eq. médicos com DataDeCadastro parseável. */
  equipamentosComCadastro: number;
  /** Eq. médicos sem DataDeCadastro válida (ignorados na série). */
  equipamentosSemCadastro: number;
  /** Total bruto da API (antes do filtro médico). */
  equipamentosApi: number;
  /** Excluídos por não serem médicos (predial/infra etc.). */
  equipamentosNaoMedicos: number;
  parque: EvolucaoParqueAno[];
  chamados: EvolucaoChamadoAno[];
  chamadosTotal: number;
  chamadosPeriodoApi: string;
  avisos: string[];
};

function isStatusAtivo(status: string | null | undefined): boolean {
  return (status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim() === "ATIVO";
}

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

/**
 * Ainda fazia parte do parque médico ativo no fim do ano?
 * Cadastro ≤ ano; se há DataDeInativação, permanece até ela; senão exige Status ATIVO.
 */
export function noParqueNoFimDoAno(
  item: Pick<EquipamentoItem, "DataDeCadastro" | "DataDeInativação" | "Status">,
  ano: number,
): boolean {
  const cadastro = parsePbiDate(item.DataDeCadastro);
  if (!cadastro || cadastro > endOfYear(ano)) return false;
  const inativacao = parsePbiDate(item["DataDeInativação"]);
  if (inativacao) return inativacao > endOfYear(ano);
  return isStatusAtivo(item.Status);
}

export function isChamadoEngenhariaClinica(
  os: Pick<OsAnaliticoItem, "TipoDeManutencao" | "SituacaoDaOS">,
): boolean {
  if (isOsCancelada(os)) return false;
  return isTipoManutencaoEc(os.TipoDeManutencao);
}

/**
 * Série ano a ano do parque médico: do menor DataDeCadastro até o ano corrente.
 * Quantidade e valor são acumulados (estoque ativo no fim de cada ano).
 */
export function agregarEvolucaoParque(
  equipamentos: EquipamentoItem[],
  hoje = nowInSaoPaulo(),
): {
  anoInicio: number | null;
  anoFim: number;
  comCadastro: number;
  semCadastro: number;
  apiTotal: number;
  naoMedicos: number;
  serie: EvolucaoParqueAno[];
} {
  const anoFim = hoje.getFullYear();
  const apiTotal = equipamentos.length;
  const medicos = equipamentos.filter(isEquipamentoMedico);
  const naoMedicos = apiTotal - medicos.length;

  let anoInicio: number | null = null;
  let comCadastro = 0;
  let semCadastro = 0;
  const entrantesPorAno = new Map<number, number>();

  for (const item of medicos) {
    const ano = anoCadastroEquipamento(item);
    if (ano == null) {
      semCadastro += 1;
      continue;
    }
    comCadastro += 1;
    if (anoInicio == null || ano < anoInicio) anoInicio = ano;
    // Entrante só conta se o item faz parte do parque em algum momento (ativo ou com inativação).
    if (isStatusAtivo(item.Status) || parsePbiDate(item["DataDeInativação"])) {
      entrantesPorAno.set(ano, (entrantesPorAno.get(ano) ?? 0) + 1);
    }
  }

  if (anoInicio == null) {
    return {
      anoInicio: null,
      anoFim,
      comCadastro,
      semCadastro,
      apiTotal,
      naoMedicos,
      serie: [],
    };
  }

  const inicio = Math.min(anoInicio, anoFim);
  const serie: EvolucaoParqueAno[] = [];
  for (let ano = inicio; ano <= anoFim; ano += 1) {
    let quantidade = 0;
    let valorSubstituicaoTotal = 0;
    let comValor = 0;
    for (const item of medicos) {
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

  return { anoInicio: inicio, anoFim, comCadastro, semCadastro, apiTotal, naoMedicos, serie };
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
  if (parque.naoMedicos > 0) {
    avisos.push(
      `${parque.naoMedicos} equipamento(s) não médico(s) excluído(s) do parque (predial/infra/hotelaria).`,
    );
  }
  if (parque.semCadastro > 0) {
    avisos.push(
      `${parque.semCadastro} eq. médico(s) sem ${CAMPO_CADASTRO_PARQUE} válida — fora da série.`,
    );
  }
  if (parque.anoInicio == null) {
    avisos.push("Nenhum equipamento médico com DataDeCadastro parseável.");
  }

  return {
    atualizadoEm: hoje.toISOString(),
    campoCadastro: CAMPO_CADASTRO_PARQUE,
    anoInicio: parque.anoInicio,
    anoFim: parque.anoFim,
    equipamentosComCadastro: parque.comCadastro,
    equipamentosSemCadastro: parque.semCadastro,
    equipamentosApi: parque.apiTotal,
    equipamentosNaoMedicos: parque.naoMedicos,
    parque: parque.serie,
    chamados: chamados.serie,
    chamadosTotal: chamados.total,
    chamadosPeriodoApi: opts.chamadosPeriodoApi,
    avisos,
  };
}
