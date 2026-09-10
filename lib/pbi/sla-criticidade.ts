/**
 * SLA 1º atendimento por criticidade do equipamento (parque), alinhado à QMentum.
 * Evento = somente DataDoAtendimento. Metas em horas úteis (business-hours).
 */
import { BUSINESS_HOURS_LABEL, diffBusinessHours } from "./business-hours";
import { isCorretiva } from "./filters";
import {
  buildEquipamentoIndex,
  findEquipamento,
  osTemEquipamento,
  type EquipamentoIndex,
} from "./indicadores-os";
import { formatPct, pct } from "./indicators";
import { linkedToMedicalPark } from "./medical";
import { parsePbiDate } from "./dates";
import type { EquipamentoItem, OsAnaliticoItem } from "./types";
import type { RollingYearRange } from "./volume-ec";
import type { SlaAtendimentoStatus } from "./sla-primeiro-atendimento";

export const SLA_CRITICIDADE_CAMPOS = [
  "Abertura",
  "DataDoAtendimento",
  "Tag",
  "Equipamento",
  "Setor",
  "TipoDeManutencao",
  "OS",
  "Prioridade",
  "Criticidade (cadastro)",
] as const;

/** Faixas QMentum (criticidade do parque, não Prioridade da OS). */
export const FAIXAS_CRITICIDADE_QMENTUM = ["Crítico", "Semicrítico", "Não crítico", "Sem faixa"] as const;
export type FaixaCriticidadeQmentum = (typeof FAIXAS_CRITICIDADE_QMENTUM)[number];

/**
 * Metas default (editáveis depois com a supervisão).
 * Crítico 4h úteis · Semicrítico 24h úteis · Não crítico 72h úteis.
 */
export const META_HORAS_UTEIS_POR_FAIXA: Record<Exclude<FaixaCriticidadeQmentum, "Sem faixa">, number> = {
  Crítico: 4,
  Semicrítico: 24,
  "Não crítico": 72,
};

export function regraMetasCriticidade() {
  return `Crítico ${META_HORAS_UTEIS_POR_FAIXA.Crítico}h úteis · Semicrítico ${META_HORAS_UTEIS_POR_FAIXA.Semicrítico}h úteis · Não crítico ${META_HORAS_UTEIS_POR_FAIXA["Não crítico"]}h úteis (${BUSINESS_HOURS_LABEL})`;
}

/**
 * Mapeia Criticidade do parque (valores reais da API + sinônimos).
 * ALTA/CRÍTICO → Crítico; MÉDIA/SEMICRÍTICO → Semicrítico; BAIXA/NÃO CRÍTICO → Não crítico.
 */
export function faixaCriticidadeQmentum(raw: string | null | undefined): FaixaCriticidadeQmentum {
  const v = (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
  if (!v) return "Sem faixa";

  // Ordem importa: "nao critico" / "semi" antes de "critico".
  if (
    v.includes("nao crit") ||
    v.includes("nao-crit") ||
    v.startsWith("baixa") ||
    v === "b"
  ) {
    return "Não crítico";
  }
  if (v.includes("semi") || v.startsWith("media") || v === "m") {
    return "Semicrítico";
  }
  if (v.startsWith("alta") || v.includes("crit") || v === "a") {
    return "Crítico";
  }
  return "Sem faixa";
}

export type SlaCriticidadeRow = OsAnaliticoItem & {
  aberturaDate: Date;
  atendimentoDate: Date | null;
  faixa: FaixaCriticidadeQmentum;
  criticidadeRaw: string;
  metaHorasUteis: number | null;
  horasUteisAteAtendimento: number | null;
  status: SlaAtendimentoStatus;
  noPrazo: boolean | null;
};

export type SlaCriticidadeMonth = {
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

function classifyStatus(
  atendimento: Date | null,
  metaHoras: number | null,
  horasUteis: number | null,
): { status: SlaAtendimentoStatus; noPrazo: boolean | null } {
  if (metaHoras == null) return { status: "Sem prazo calculável", noPrazo: null };
  if (!atendimento || horasUteis == null) return { status: "Sem 1º atendimento", noPrazo: null };
  const noPrazo = horasUteis <= metaHoras;
  return { status: noPrazo ? "Dentro do prazo" : "Fora do prazo", noPrazo };
}

function summarizeRows(rows: SlaCriticidadeRow[]) {
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

function summarizeMonth(
  slot: { year: number; month: number; key: string; label: string },
  rows: SlaCriticidadeRow[],
): SlaCriticidadeMonth {
  return { ...slot, ...summarizeRows(rows) };
}

export function buildSlaCriticidade(
  os: OsAnaliticoItem[],
  range: RollingYearRange,
  medicalTags: Set<string>,
  medicalIds: Set<number>,
  equipamentos: EquipamentoItem[],
) {
  const index: EquipamentoIndex = buildEquipamentoIndex(equipamentos);
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
  const rows: SlaCriticidadeRow[] = [];

  for (const item of aposCorretiva) {
    const abertura = parsePbiDate(item.Abertura);
    if (!abertura || !inRange(abertura, range.start, range.end)) continue;

    const eq = findEquipamento(index, item.Tag, item.Equipamento, item.Setor);
    const criticidadeRaw = eq?.Criticidade?.trim() || "";
    const faixa = faixaCriticidadeQmentum(criticidadeRaw);
    const metaHorasUteis =
      faixa === "Sem faixa" ? null : META_HORAS_UTEIS_POR_FAIXA[faixa];

    // Somente 1º atendimento — nunca Fechamento.
    const atendimento = parsePbiDate(item.DataDoAtendimento);
    const horasUteisAteAtendimento =
      atendimento != null ? diffBusinessHours(abertura, atendimento) : null;
    const { status, noPrazo } = classifyStatus(atendimento, metaHorasUteis, horasUteisAteAtendimento);

    rows.push({
      ...item,
      aberturaDate: abertura,
      atendimentoDate: atendimento,
      faixa,
      criticidadeRaw: criticidadeRaw || "—",
      metaHorasUteis,
      horasUteisAteAtendimento,
      status,
      noPrazo,
    });
  }

  const months = range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });

  const porFaixa = FAIXAS_CRITICIDADE_QMENTUM.map((faixa) => {
    const subset = rows.filter((r) => r.faixa === faixa);
    const totals = summarizeRows(subset);
    return {
      faixa,
      metaHorasUteis: faixa === "Sem faixa" ? null : META_HORAS_UTEIS_POR_FAIXA[faixa],
      total: subset.length,
      ...totals,
    };
  });

  const criticidadesRaw = new Map<string, number>();
  for (const r of rows) {
    const k = r.criticidadeRaw || "—";
    criticidadesRaw.set(k, (criticidadesRaw.get(k) ?? 0) + 1);
  }

  return {
    semTag,
    tagForaDoIndice,
    aposMedico,
    aposCorretiva,
    noIntervalo: rows,
    months,
    porFaixa,
    criticidadesRawObservadas: [...criticidadesRaw.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR")),
    exemplos: [...rows]
      .sort((a, b) => b.aberturaDate.getTime() - a.aberturaDate.getTime())
      .slice(0, 5),
    ...summarizeRows(rows),
  };
}

export function slaCriticidadeDoMes(rows: SlaCriticidadeRow[], year: number, month: number) {
  return rows.filter((item) => inMonth(item.aberturaDate, year, month));
}

export function filterSlaPorFaixa(rows: SlaCriticidadeRow[], faixa: FaixaCriticidadeQmentum | "Todas") {
  if (faixa === "Todas") return rows;
  return rows.filter((r) => r.faixa === faixa);
}

export function filterSlaCriticidadePorStatus(
  rows: SlaCriticidadeRow[],
  status: SlaAtendimentoStatus | "Todas" | "Com prazo",
) {
  if (status === "Todas") return rows;
  if (status === "Com prazo") return rows.filter((r) => r.noPrazo != null);
  return rows.filter((r) => r.status === status);
}

export function monthsFromSlaCriticidadeRows(
  range: RollingYearRange,
  rows: SlaCriticidadeRow[],
): SlaCriticidadeMonth[] {
  return range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });
}
