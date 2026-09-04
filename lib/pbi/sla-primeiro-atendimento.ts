import { addHours } from "date-fns";
import { isCorretiva } from "./filters";
import { extractPrazoHoras, osTemEquipamento } from "./indicadores-os";
import { formatPct, pct } from "./indicators";
import { linkedToMedicalPark } from "./medical";
import { parsePbiDate } from "./dates";
import type { OsAnaliticoItem } from "./types";
import type { RollingYearRange } from "./volume-ec";
import {
  PRIORIDADE_GRUPOS,
  grupoPrioridadeOs,
  type PrioridadeGrupo,
} from "./corretivas-por-prioridade";

export const SLA_PRIMEIRO_ATENDIMENTO_CAMPOS = [
  "Abertura",
  "DataDoAtendimento",
  "DataLimiteDoAtendimento",
  "Prioridade",
  "TipoDeManutencao",
  "Tag",
  "Equipamento",
  "OS",
  "SituacaoDaOS",
] as const;

/** Evento de prazo = somente 1º atendimento (DataDoAtendimento). Nunca Fechamento/DataDaSolucao. */
export type SlaAtendimentoStatus =
  | "Dentro do prazo"
  | "Fora do prazo"
  | "Sem prazo calculável"
  | "Sem 1º atendimento";

export type SlaPrimeiroAtendimentoRow = OsAnaliticoItem & {
  aberturaDate: Date;
  atendimentoDate: Date | null;
  limiteDate: Date | null;
  limiteOrigem: "DataLimite" | "Prioridade" | "—";
  prioridadeGrupo: PrioridadeGrupo;
  prioridadeRaw: string;
  status: SlaAtendimentoStatus;
  noPrazo: boolean | null;
};

export type SlaPrimeiroAtendimentoMonth = {
  year: number;
  month: number;
  key: string;
  label: string;
  noPrazo: number;
  foraPrazo: number;
  semPrazo: number;
  semAtendimento: number;
  comPrazo: number;
  pctNoPrazo: number | null;
  pctLabel: string;
};

function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function inMonth(date: Date | null, year: number, month: number) {
  return Boolean(date && date.getFullYear() === year && date.getMonth() === month);
}

/** Limite = DataLimiteDoAtendimento; senão Abertura + horas da Prioridade. */
export function resolveLimitePrimeiroAtendimento(os: OsAnaliticoItem) {
  const abertura = parsePbiDate(os.Abertura);
  const limiteApi = parsePbiDate(os.DataLimiteDoAtendimento);
  const prazoHoras = extractPrazoHoras(os.Prioridade);
  const limiteFallback = !limiteApi && abertura && prazoHoras != null ? addHours(abertura, prazoHoras) : null;
  const limite = limiteApi ?? limiteFallback;
  const limiteOrigem: SlaPrimeiroAtendimentoRow["limiteOrigem"] = limiteApi
    ? "DataLimite"
    : limiteFallback
      ? "Prioridade"
      : "—";
  return { abertura, limite, limiteOrigem, prazoHoras };
}

function classifyStatus(
  atendimento: Date | null,
  limite: Date | null,
): { status: SlaAtendimentoStatus; noPrazo: boolean | null } {
  if (!limite) return { status: "Sem prazo calculável", noPrazo: null };
  if (!atendimento) return { status: "Sem 1º atendimento", noPrazo: null };
  const noPrazo = atendimento.getTime() <= limite.getTime();
  return { status: noPrazo ? "Dentro do prazo" : "Fora do prazo", noPrazo };
}

function sampleParaConferencia(items: SlaPrimeiroAtendimentoRow[], n = 5) {
  return [...items]
    .sort((a, b) => b.aberturaDate.getTime() - a.aberturaDate.getTime())
    .slice(0, n);
}

export function buildSlaPrimeiroAtendimento(
  os: OsAnaliticoItem[],
  range: RollingYearRange,
  medicalTags: Set<string>,
  medicalIds: Set<number>,
) {
  const semTag: OsAnaliticoItem[] = [];
  const tagForaDoIndice: OsAnaliticoItem[] = [];
  const aposMedico: OsAnaliticoItem[] = [];

  for (const item of os) {
    const tag = (item.Tag ?? "").trim();
    if (!tag && !osTemEquipamento(item)) {
      semTag.push(item);
      continue;
    }
    if (!linkedToMedicalPark(tag, undefined, medicalTags, medicalIds)) {
      if (!tag) semTag.push(item);
      else tagForaDoIndice.push(item);
      continue;
    }
    aposMedico.push(item);
  }

  const aposCorretiva = aposMedico.filter((item) => isCorretiva(item.TipoDeManutencao));

  const rows: SlaPrimeiroAtendimentoRow[] = [];
  for (const item of aposCorretiva) {
    const { abertura, limite, limiteOrigem } = resolveLimitePrimeiroAtendimento(item);
    if (!abertura || !inRange(abertura, range.start, range.end)) continue;
    // Somente 1º atendimento — nunca Fechamento / DataDaSolucao.
    const atendimento = parsePbiDate(item.DataDoAtendimento);
    const prioridadeGrupo = grupoPrioridadeOs(item.Prioridade);
    const prioridadeRaw = (item.Prioridade ?? "").trim() || "—";
    const { status, noPrazo } = classifyStatus(atendimento, limite);
    rows.push({
      ...item,
      aberturaDate: abertura,
      atendimentoDate: atendimento,
      limiteDate: limite,
      limiteOrigem,
      prioridadeGrupo,
      prioridadeRaw,
      status,
      noPrazo,
    });
  }

  const months: SlaPrimeiroAtendimentoMonth[] = range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });

  const porPrioridade = PRIORIDADE_GRUPOS.map((grupo) => {
    const subset = rows.filter((r) => r.prioridadeGrupo === grupo);
    const noPrazo = subset.filter((r) => r.noPrazo === true).length;
    const foraPrazo = subset.filter((r) => r.noPrazo === false).length;
    const comPrazo = noPrazo + foraPrazo;
    const pctNoPrazo = pct(noPrazo, comPrazo);
    return {
      grupo,
      total: subset.length,
      noPrazo,
      foraPrazo,
      semPrazo: subset.filter((r) => r.status === "Sem prazo calculável").length,
      semAtendimento: subset.filter((r) => r.status === "Sem 1º atendimento").length,
      comPrazo,
      pctNoPrazo,
      pctLabel: formatPct(pctNoPrazo),
    };
  });

  const totals = summarizeRows(rows);

  return {
    semTag,
    tagForaDoIndice,
    aposMedico,
    aposCorretiva,
    noIntervalo: rows,
    months,
    porPrioridade,
    exemplos: sampleParaConferencia(rows),
    ...totals,
  };
}

function summarizeMonth(
  slot: { year: number; month: number; key: string; label: string },
  rows: SlaPrimeiroAtendimentoRow[],
): SlaPrimeiroAtendimentoMonth {
  const noPrazo = rows.filter((r) => r.noPrazo === true).length;
  const foraPrazo = rows.filter((r) => r.noPrazo === false).length;
  const semPrazo = rows.filter((r) => r.status === "Sem prazo calculável").length;
  const semAtendimento = rows.filter((r) => r.status === "Sem 1º atendimento").length;
  const comPrazo = noPrazo + foraPrazo;
  const pctNoPrazo = pct(noPrazo, comPrazo);
  return {
    ...slot,
    noPrazo,
    foraPrazo,
    semPrazo,
    semAtendimento,
    comPrazo,
    pctNoPrazo,
    pctLabel: formatPct(pctNoPrazo),
  };
}

function summarizeRows(rows: SlaPrimeiroAtendimentoRow[]) {
  const noPrazo = rows.filter((r) => r.noPrazo === true).length;
  const foraPrazo = rows.filter((r) => r.noPrazo === false).length;
  const semPrazo = rows.filter((r) => r.status === "Sem prazo calculável").length;
  const semAtendimento = rows.filter((r) => r.status === "Sem 1º atendimento").length;
  const comPrazo = noPrazo + foraPrazo;
  const pctNoPrazo = pct(noPrazo, comPrazo);
  return {
    noPrazo,
    foraPrazo,
    semPrazo,
    semAtendimento,
    comPrazo,
    pctNoPrazo,
    pctLabel: formatPct(pctNoPrazo),
  };
}

export function slaDoMes(rows: SlaPrimeiroAtendimentoRow[], year: number, month: number) {
  return rows.filter((item) => inMonth(item.aberturaDate, year, month));
}

export function filterSlaPorPrioridade(rows: SlaPrimeiroAtendimentoRow[], grupo: PrioridadeGrupo | "Todas") {
  if (grupo === "Todas") return rows;
  return rows.filter((r) => r.prioridadeGrupo === grupo);
}

export function filterSlaPorStatus(
  rows: SlaPrimeiroAtendimentoRow[],
  status: SlaAtendimentoStatus | "Todas" | "Com prazo",
) {
  if (status === "Todas") return rows;
  if (status === "Com prazo") return rows.filter((r) => r.noPrazo != null);
  return rows.filter((r) => r.status === status);
}

export function monthsFromSlaRows(
  range: RollingYearRange,
  rows: SlaPrimeiroAtendimentoRow[],
): SlaPrimeiroAtendimentoMonth[] {
  return range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });
}

export function rotuloLimiteOrigem(origem: SlaPrimeiroAtendimentoRow["limiteOrigem"]) {
  if (origem === "DataLimite") return "DataLimiteDoAtendimento";
  if (origem === "Prioridade") return "Abertura + horas da Prioridade";
  return "—";
}

export function regraHorasPrioridade() {
  return "BAIXA → 72h · MÉDIA → 12h · ALTA → 2h (ou horas explícitas no texto da Prioridade, ex.: “24 H”)";
}

export { PRIORIDADE_GRUPOS };
export type { PrioridadeGrupo };
