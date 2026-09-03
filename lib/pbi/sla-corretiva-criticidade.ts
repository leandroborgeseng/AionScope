import { addHours } from "date-fns";
import { isCorretiva } from "./filters";
import {
  CRITICIDADE_GRUPOS,
  buildEquipamentoIndex,
  extractPrazoHoras,
  findEquipamento,
  grupoCriticidade,
  osTemEquipamento,
  type CriticidadeGrupo,
  type EquipamentoIndex,
} from "./indicadores-os";
import { formatPct, pct } from "./indicators";
import { linkedToMedicalPark } from "./medical";
import { parsePbiDate } from "./dates";
import type { EquipamentoItem, OsAnaliticoItem } from "./types";
import type { RollingYearRange } from "./volume-ec";

export const SLA_CORRETIVA_CAMPOS = [
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

export type FonteCriticidade = "equipamento" | "prioridade_os" | "nenhuma";

export type SlaStatus = "Dentro do prazo" | "Fora do prazo" | "Sem prazo calculável" | "Sem atendimento";

export type SlaCorretivaRow = OsAnaliticoItem & {
  aberturaDate: Date;
  atendimentoDate: Date | null;
  limiteDate: Date | null;
  limiteOrigem: "DataLimite" | "Prioridade" | "—";
  criticidadeEquipamento: CriticidadeGrupo;
  criticidadeEquipamentoRaw: string;
  prioridadeGrupo: CriticidadeGrupo;
  prioridadeRaw: string;
  criticidadeIndicador: CriticidadeGrupo;
  fonteCriticidade: FonteCriticidade;
  status: SlaStatus;
  noPrazo: boolean | null;
};

export type SlaCorretivaMonth = {
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

/** Mapeia Prioridade da OS (texto ou horas embutidas) para Alta / Média / Baixa. */
export function grupoPrioridadeOs(prioridade: string | null | undefined): CriticidadeGrupo {
  const raw = (prioridade ?? "").trim();
  if (!raw) return "Sem criticidade";
  const fromText = grupoCriticidade(raw);
  if (fromText !== "Sem criticidade") return fromText;
  const horas = extractPrazoHoras(raw);
  if (horas === 2) return "Alta";
  if (horas === 12) return "Média";
  if (horas === 72) return "Baixa";
  return "Sem criticidade";
}

/**
 * Criticidade que manda no indicador:
 * 1) Criticidade do equipamento no parque quando a Tag casa e o campo existe;
 * 2) senão Prioridade da OS (Alta/Média/Baixa);
 * 3) senão Sem criticidade — não inventa.
 */
export function resolveCriticidadeIndicador(
  os: OsAnaliticoItem,
  index: EquipamentoIndex,
): Pick<
  SlaCorretivaRow,
  | "criticidadeEquipamento"
  | "criticidadeEquipamentoRaw"
  | "prioridadeGrupo"
  | "prioridadeRaw"
  | "criticidadeIndicador"
  | "fonteCriticidade"
> {
  const eq = findEquipamento(index, os.Tag, os.Equipamento, os.Setor);
  const criticidadeEquipamentoRaw = eq?.Criticidade?.trim() ?? "";
  const criticidadeEquipamento = grupoCriticidade(criticidadeEquipamentoRaw);
  const prioridadeRaw = (os.Prioridade ?? "").trim() || "—";
  const prioridadeGrupo = grupoPrioridadeOs(os.Prioridade);

  if (eq && criticidadeEquipamento !== "Sem criticidade") {
    return {
      criticidadeEquipamento,
      criticidadeEquipamentoRaw: criticidadeEquipamentoRaw || criticidadeEquipamento,
      prioridadeGrupo,
      prioridadeRaw,
      criticidadeIndicador: criticidadeEquipamento,
      fonteCriticidade: "equipamento",
    };
  }

  if (prioridadeGrupo !== "Sem criticidade") {
    return {
      criticidadeEquipamento,
      criticidadeEquipamentoRaw: criticidadeEquipamentoRaw || "Sem criticidade",
      prioridadeGrupo,
      prioridadeRaw,
      criticidadeIndicador: prioridadeGrupo,
      fonteCriticidade: "prioridade_os",
    };
  }

  return {
    criticidadeEquipamento,
    criticidadeEquipamentoRaw: criticidadeEquipamentoRaw || "Sem criticidade",
    prioridadeGrupo,
    prioridadeRaw,
    criticidadeIndicador: "Sem criticidade",
    fonteCriticidade: "nenhuma",
  };
}

/** Limite = DataLimiteDoAtendimento; senão Abertura + horas da Prioridade (libs existentes). */
export function resolveLimiteAtendimento(os: OsAnaliticoItem) {
  const abertura = parsePbiDate(os.Abertura);
  const limiteApi = parsePbiDate(os.DataLimiteDoAtendimento);
  const prazoHoras = extractPrazoHoras(os.Prioridade);
  const limiteFallback = !limiteApi && abertura && prazoHoras != null ? addHours(abertura, prazoHoras) : null;
  const limite = limiteApi ?? limiteFallback;
  const limiteOrigem: SlaCorretivaRow["limiteOrigem"] = limiteApi
    ? "DataLimite"
    : limiteFallback
      ? "Prioridade"
      : "—";
  return { abertura, limite, limiteOrigem, prazoHoras };
}

function classifyStatus(
  atendimento: Date | null,
  limite: Date | null,
): { status: SlaStatus; noPrazo: boolean | null } {
  if (!limite) return { status: "Sem prazo calculável", noPrazo: null };
  if (!atendimento) return { status: "Sem atendimento", noPrazo: null };
  const noPrazo = atendimento.getTime() <= limite.getTime();
  return { status: noPrazo ? "Dentro do prazo" : "Fora do prazo", noPrazo };
}

function sampleSlaParaConferencia(items: SlaCorretivaRow[], n = 5) {
  return [...items]
    .sort((a, b) => b.aberturaDate.getTime() - a.aberturaDate.getTime())
    .slice(0, n);
}

export function buildSlaCorretivaCriticidade(
  os: OsAnaliticoItem[],
  equipamentos: EquipamentoItem[],
  range: RollingYearRange,
  medicalTags: Set<string>,
  medicalIds: Set<number>,
) {
  const index = buildEquipamentoIndex(equipamentos);
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

  const rows: SlaCorretivaRow[] = [];
  for (const item of aposCorretiva) {
    const { abertura, limite, limiteOrigem } = resolveLimiteAtendimento(item);
    if (!abertura || !inRange(abertura, range.start, range.end)) continue;
    const atendimento = parsePbiDate(item.DataDoAtendimento);
    const crit = resolveCriticidadeIndicador(item, index);
    const { status, noPrazo } = classifyStatus(atendimento, limite);
    rows.push({
      ...item,
      aberturaDate: abertura,
      atendimentoDate: atendimento,
      limiteDate: limite,
      limiteOrigem,
      ...crit,
      status,
      noPrazo,
    });
  }

  const months: SlaCorretivaMonth[] = range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });

  const porCriticidade = CRITICIDADE_GRUPOS.map((grupo) => {
    const subset = rows.filter((r) => r.criticidadeIndicador === grupo);
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
      comPrazo,
      pctNoPrazo,
      pctLabel: formatPct(pctNoPrazo),
      fonteEquipamento: subset.filter((r) => r.fonteCriticidade === "equipamento").length,
      fontePrioridade: subset.filter((r) => r.fonteCriticidade === "prioridade_os").length,
    };
  });

  const totals = summarizeRows(rows);
  const divergentes = rows.filter(
    (r) =>
      r.criticidadeEquipamento !== "Sem criticidade" &&
      r.prioridadeGrupo !== "Sem criticidade" &&
      r.criticidadeEquipamento !== r.prioridadeGrupo,
  );

  return {
    index,
    semTag,
    tagForaDoIndice,
    aposMedico,
    aposCorretiva,
    noIntervalo: rows,
    months,
    porCriticidade,
    divergentes,
    exemplos: sampleSlaParaConferencia(rows),
    ...totals,
  };
}

function summarizeMonth(
  slot: { year: number; month: number; key: string; label: string },
  rows: SlaCorretivaRow[],
): SlaCorretivaMonth {
  const noPrazo = rows.filter((r) => r.noPrazo === true).length;
  const foraPrazo = rows.filter((r) => r.noPrazo === false).length;
  const semPrazo = rows.filter((r) => r.status === "Sem prazo calculável").length;
  const semAtendimento = rows.filter((r) => r.status === "Sem atendimento").length;
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

function summarizeRows(rows: SlaCorretivaRow[]) {
  const noPrazo = rows.filter((r) => r.noPrazo === true).length;
  const foraPrazo = rows.filter((r) => r.noPrazo === false).length;
  const semPrazo = rows.filter((r) => r.status === "Sem prazo calculável").length;
  const semAtendimento = rows.filter((r) => r.status === "Sem atendimento").length;
  const comPrazo = noPrazo + foraPrazo;
  const pctNoPrazo = pct(noPrazo, comPrazo);
  const fonteEquipamento = rows.filter((r) => r.fonteCriticidade === "equipamento").length;
  const fontePrioridade = rows.filter((r) => r.fonteCriticidade === "prioridade_os").length;
  const fonteNenhuma = rows.filter((r) => r.fonteCriticidade === "nenhuma").length;
  return {
    noPrazo,
    foraPrazo,
    semPrazo,
    semAtendimento,
    comPrazo,
    pctNoPrazo,
    pctLabel: formatPct(pctNoPrazo),
    fonteEquipamento,
    fontePrioridade,
    fonteNenhuma,
  };
}

export function slaCorretivaDoMes(rows: SlaCorretivaRow[], year: number, month: number) {
  return rows.filter((item) => inMonth(item.aberturaDate, year, month));
}

export function filterSlaPorCriticidade(rows: SlaCorretivaRow[], grupo: CriticidadeGrupo | "Todas") {
  if (grupo === "Todas") return rows;
  return rows.filter((r) => r.criticidadeIndicador === grupo);
}

export function filterSlaPorStatus(rows: SlaCorretivaRow[], status: SlaStatus | "Todas" | "Com prazo") {
  if (status === "Todas") return rows;
  if (status === "Com prazo") return rows.filter((r) => r.noPrazo != null);
  return rows.filter((r) => r.status === status);
}

export function monthsFromRows(
  range: RollingYearRange,
  rows: SlaCorretivaRow[],
): SlaCorretivaMonth[] {
  return range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });
}

export function rotuloFonteCriticidade(fonte: FonteCriticidade) {
  if (fonte === "equipamento") return "Criticidade do equipamento";
  if (fonte === "prioridade_os") return "Prioridade da OS";
  return "Sem criticidade/prioridade";
}

export function rotuloLimiteOrigem(origem: SlaCorretivaRow["limiteOrigem"]) {
  if (origem === "DataLimite") return "DataLimiteDoAtendimento";
  if (origem === "Prioridade") return "Abertura + horas da Prioridade";
  return "—";
}

/** Texto curto da regra de horas embutida na Prioridade (documentação UI). */
export function regraHorasPrioridade() {
  return "BAIXA → 72h · MÉDIA → 12h · ALTA → 2h (ou horas explícitas no texto da Prioridade, ex.: “24 H”)";
}

export { CRITICIDADE_GRUPOS };
export type { CriticidadeGrupo };
