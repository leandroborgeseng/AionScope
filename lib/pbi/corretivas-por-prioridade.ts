import { isCorretiva } from "./filters";
import { extractPrazoHoras, grupoCriticidade, osTemEquipamento } from "./indicadores-os";
import { formatPct, pct } from "./indicators";
import { linkedToMedicalPark } from "./medical";
import { parsePbiDate } from "./dates";
import type { OsAnaliticoItem } from "./types";
import type { RollingYearRange } from "./volume-ec";

export const CORRETIVAS_PRIORIDADE_CAMPOS = [
  "Abertura",
  "Prioridade",
  "TipoDeManutencao",
  "Tag",
  "Equipamento",
  "OS",
  "SituacaoDaOS",
  "DataDoAtendimento",
] as const;

export const PRIORIDADE_GRUPOS = ["Alta", "Média", "Baixa", "Sem prioridade"] as const;
export type PrioridadeGrupo = (typeof PRIORIDADE_GRUPOS)[number];

export type CorretivaPrioridadeRow = OsAnaliticoItem & {
  aberturaDate: Date;
  prioridadeGrupo: PrioridadeGrupo;
  prioridadeRaw: string;
};

export type CorretivaPrioridadeMonth = {
  year: number;
  month: number;
  key: string;
  label: string;
  total: number;
  alta: number;
  media: number;
  baixa: number;
  semPrioridade: number;
};

export type PrioridadeResumo = {
  grupo: PrioridadeGrupo;
  total: number;
  pct: number | null;
  pctLabel: string;
};

function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function inMonth(date: Date | null, year: number, month: number) {
  return Boolean(date && date.getFullYear() === year && date.getMonth() === month);
}

/** Mapeia Prioridade da OS (texto ou horas embutidas) para Alta / Média / Baixa / Sem prioridade. */
export function grupoPrioridadeOs(prioridade: string | null | undefined): PrioridadeGrupo {
  const raw = (prioridade ?? "").trim();
  if (!raw) return "Sem prioridade";
  const fromText = grupoCriticidade(raw);
  if (fromText === "Alta" || fromText === "Média" || fromText === "Baixa") return fromText;
  const horas = extractPrazoHoras(raw);
  if (horas === 2) return "Alta";
  if (horas === 12) return "Média";
  if (horas === 72) return "Baixa";
  return "Sem prioridade";
}

function emptyCounts(): Record<PrioridadeGrupo, number> {
  return Object.fromEntries(PRIORIDADE_GRUPOS.map((g) => [g, 0])) as Record<PrioridadeGrupo, number>;
}

function summarizePorPrioridade(rows: CorretivaPrioridadeRow[]): PrioridadeResumo[] {
  const counts = emptyCounts();
  for (const row of rows) counts[row.prioridadeGrupo] += 1;
  const total = rows.length;
  return PRIORIDADE_GRUPOS.map((grupo) => {
    const n = counts[grupo];
    const p = pct(n, total);
    return { grupo, total: n, pct: p, pctLabel: formatPct(p) };
  });
}

function summarizeMonth(
  slot: { year: number; month: number; key: string; label: string },
  rows: CorretivaPrioridadeRow[],
): CorretivaPrioridadeMonth {
  const counts = emptyCounts();
  for (const row of rows) counts[row.prioridadeGrupo] += 1;
  return {
    ...slot,
    total: rows.length,
    alta: counts.Alta,
    media: counts.Média,
    baixa: counts.Baixa,
    semPrioridade: counts["Sem prioridade"],
  };
}

function sampleParaConferencia(items: CorretivaPrioridadeRow[], n = 5) {
  return [...items]
    .sort((a, b) => b.aberturaDate.getTime() - a.aberturaDate.getTime())
    .slice(0, n);
}

export function buildCorretivasPorPrioridade(
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

  const rows: CorretivaPrioridadeRow[] = [];
  for (const item of aposCorretiva) {
    const abertura = parsePbiDate(item.Abertura);
    if (!abertura || !inRange(abertura, range.start, range.end)) continue;
    const prioridadeGrupo = grupoPrioridadeOs(item.Prioridade);
    const prioridadeRaw = (item.Prioridade ?? "").trim() || "—";
    rows.push({
      ...item,
      aberturaDate: abertura,
      prioridadeGrupo,
      prioridadeRaw,
    });
  }

  const months: CorretivaPrioridadeMonth[] = range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });

  const porPrioridade = summarizePorPrioridade(rows);

  return {
    semTag,
    tagForaDoIndice,
    aposMedico,
    aposCorretiva,
    noIntervalo: rows,
    months,
    porPrioridade,
    total: rows.length,
    exemplos: sampleParaConferencia(rows),
  };
}

export function corretivasDoMes(rows: CorretivaPrioridadeRow[], year: number, month: number) {
  return rows.filter((item) => inMonth(item.aberturaDate, year, month));
}

export function filterPorPrioridade(rows: CorretivaPrioridadeRow[], grupo: PrioridadeGrupo | "Todas") {
  if (grupo === "Todas") return rows;
  return rows.filter((r) => r.prioridadeGrupo === grupo);
}

export function monthsFromRows(
  range: RollingYearRange,
  rows: CorretivaPrioridadeRow[],
): CorretivaPrioridadeMonth[] {
  return range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.aberturaDate, slot.year, slot.month));
    return summarizeMonth(slot, doMes);
  });
}

export function chartKeyPrioridade(grupo: PrioridadeGrupo): keyof Pick<
  CorretivaPrioridadeMonth,
  "alta" | "media" | "baixa" | "semPrioridade"
> {
  if (grupo === "Alta") return "alta";
  if (grupo === "Média") return "media";
  if (grupo === "Baixa") return "baixa";
  return "semPrioridade";
}
