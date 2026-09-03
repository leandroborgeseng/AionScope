import {
  keepCronogramaPlano,
  parsePeriodicidadeMeses,
  plannedMonthsInYear,
} from "./cronograma-anual";
import { formatDateBR, parsePbiDate } from "./dates";
import { classifyPlanoEc, type PlanoEcTipo } from "./indicadores-os";
import { formatPct, pct } from "./indicators";
import type { CronogramaItem, OsAnaliticoItem } from "./types";
import {
  composeSaldoMes,
  fraseSaldo,
  osFechamentoDate,
  rotuloSaldo,
  type RollingYearRange,
} from "./volume-ec";

export const MANUT_PLANEJADAS_CAMPOS_CRONO = [
  "Tag",
  "Equipamento",
  "Setor",
  "TipoDeManutencao",
  "PlanoDeManutencao",
  "ProximaRealizacao",
  "DataDaUltima",
  "Perioridicade",
] as const;

export const MANUT_PLANEJADAS_CAMPOS_OS = [
  "OS",
  "Tag",
  "Equipamento",
  "Setor",
  "TipoDeManutencao",
  "Fechamento",
  "DataDaSolucao",
  "SituacaoDaOS",
] as const;

/** Abaixo disso, Tag do cronograma não é confiável o bastante para parear com OS. */
export const TAG_CONFIAVEL_MIN = 0.5;

export type MatchModo = "tag" | "independente";

export type ManutListaOrigem = "Planejada" | "Executada";

export type ManutListaRow = {
  id: string;
  origem: ManutListaOrigem;
  identificacao: string;
  tipo: PlanoEcTipo;
  tipoRaw: string;
  setorTag: string;
  data: string;
  dataSort: number;
  year: number;
  month: number;
  tag: string;
  equipamento: string;
  setor: string;
  os?: string;
  plano?: string;
};

export type ManutPlanejadaMonth = {
  year: number;
  month: number;
  key: string;
  label: string;
  planejado: number;
  executado: number;
  coberto: number;
  deficit: number;
  superavit: number;
  saldo: number;
};

export type ManutPlanejadaResult = {
  months: ManutPlanejadaMonth[];
  totalPlanejado: number;
  totalExecutado: number;
  saldo: number;
  cumprimento: number | null;
  cumprimentoLabel: string;
  modo: MatchModo;
  pctComTag: number;
  cronogramaPlano: CronogramaItem[];
  osPlano: OsAnaliticoItem[];
  planejadas: ManutListaRow[];
  executadas: ManutListaRow[];
  semDataPlanejada: number;
  exemplosCronograma: CronogramaItem[];
  exemplosOs: OsAnaliticoItem[];
};

function filled(value: string | null | undefined) {
  const v = (value ?? "").trim().toLocaleUpperCase("pt-BR");
  return Boolean(v) && v !== "NÃO INFORMADO" && v !== "NAO INFORMADO" && v !== "N/A" && v !== "-";
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function inMonth(date: Date | null, year: number, month: number) {
  return Boolean(date && date.getFullYear() === year && date.getMonth() === month);
}

function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function lookupTagKey(tag?: string | null) {
  return filled(tag) ? `tag:${normalize(tag)}` : "";
}

function yearsInRange(range: RollingYearRange) {
  return [...new Set(range.months.map((m) => m.year))];
}

function plannedMonthKeysForItem(item: CronogramaItem, range: RollingYearRange): string[] {
  const proxima = parsePbiDate(item.ProximaRealizacao);
  const ultima = parsePbiDate(item.DataDaUltima);
  const interval = parsePeriodicidadeMeses(item.Perioridicade);
  const allowed = new Set(range.months.map((m) => monthKey(m.year, m.month)));
  const keys: string[] = [];
  for (const year of yearsInRange(range)) {
    for (const month of plannedMonthsInYear({ proxima, ultima, intervalMonths: interval, year })) {
      const key = monthKey(year, month);
      if (allowed.has(key)) keys.push(key);
    }
  }
  return keys;
}

function filterCronogramaPlano(cronograma: CronogramaItem[]) {
  return cronograma.filter((item) => keepCronogramaPlano(item.TipoDeManutencao, false));
}

function filterOsPlano(os: OsAnaliticoItem[]) {
  return os.filter((item) => {
    if (!keepCronogramaPlano(item.TipoDeManutencao, false)) return false;
    return Boolean(osFechamentoDate(item));
  });
}

function assessModo(cronogramaPlano: CronogramaItem[]): { modo: MatchModo; pctComTag: number } {
  if (!cronogramaPlano.length) return { modo: "independente", pctComTag: 0 };
  const comTag = cronogramaPlano.filter((item) => filled(item.Tag)).length;
  const pctComTag = comTag / cronogramaPlano.length;
  return {
    modo: pctComTag >= TAG_CONFIAVEL_MIN ? "tag" : "independente",
    pctComTag,
  };
}

type PlannedOccurrence = {
  id: string;
  monthKey: string;
  year: number;
  month: number;
  tipo: PlanoEcTipo;
  item: CronogramaItem;
  tagKey: string;
};

function buildPlannedOccurrences(cronogramaPlano: CronogramaItem[], range: RollingYearRange): PlannedOccurrence[] {
  const out: PlannedOccurrence[] = [];
  const seen = new Set<string>();

  for (const item of cronogramaPlano) {
    const tipo = classifyPlanoEc(item.TipoDeManutencao);
    if (!tipo) continue;
    const tagKey = lookupTagKey(item.Tag);
    const group = tagKey || `eq:${normalize(item.Equipamento)}|${normalize(item.Setor)}|${normalize(item.PlanoDeManutencao)}`;

    for (const key of plannedMonthKeysForItem(item, range)) {
      const [y, m] = key.split("-").map(Number);
      const year = y;
      const month = m - 1;
      // Em modo tag (e também no independente), evita duplicar o mesmo equipamento+tipo no mês.
      const dedupe = `${group}|${tipo}|${key}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        id: `plan-${dedupe}`,
        monthKey: key,
        year,
        month,
        tipo,
        item,
        tagKey,
      });
    }
  }
  return out;
}

function toPlanejadaRow(occ: PlannedOccurrence): ManutListaRow {
  const tag = occ.item.Tag?.trim() || "";
  const setor = occ.item.Setor?.trim() || "";
  const equipamento = occ.item.Equipamento?.trim() || "";
  const planned = parsePbiDate(occ.item.ProximaRealizacao) || parsePbiDate(occ.item.DataDaUltima);
  return {
    id: occ.id,
    origem: "Planejada",
    identificacao: equipamento || occ.item.PlanoDeManutencao || tag || "—",
    tipo: occ.tipo,
    tipoRaw: occ.item.TipoDeManutencao || occ.tipo,
    setorTag: [setor, tag].filter(Boolean).join(" · ") || "—",
    data: planned ? formatDateBR(planned) : occ.item.ProximaRealizacao || "—",
    dataSort: planned?.getTime() ?? Date.UTC(occ.year, occ.month, 1),
    year: occ.year,
    month: occ.month,
    tag,
    equipamento,
    setor,
    plano: occ.item.PlanoDeManutencao,
  };
}

function toExecutadaRow(os: OsAnaliticoItem, tipo: PlanoEcTipo, fechamento: Date): ManutListaRow {
  const tag = os.Tag?.trim() || "";
  const setor = os.Setor?.trim() || "";
  return {
    id: `os-${os.CodigoSerialOS}`,
    origem: "Executada",
    identificacao: os.OS || String(os.CodigoSerialOS),
    tipo,
    tipoRaw: os.TipoDeManutencao || tipo,
    setorTag: [setor, tag].filter(Boolean).join(" · ") || "—",
    data: formatDateBR(fechamento),
    dataSort: fechamento.getTime(),
    year: fechamento.getFullYear(),
    month: fechamento.getMonth(),
    tag,
    equipamento: os.Equipamento?.trim() || "",
    setor,
    os: os.OS,
    plano: os.PlanoDeManutencao,
  };
}

/**
 * Planejado = ocorrências do cronograma (prev / calib / TSE) no mês.
 * Executado = OS fechadas (Fechamento ou DataDaSolucao) do mesmo tipo no mês.
 *
 * Contagem do gráfico/KPI é **independente** (permite déficit e superávit).
 * Quando ≥50% das linhas do cronograma têm Tag, o modo documentado é "tag"
 * (lista correlaciona Tag+tipo); senão, "independente" puro.
 */
export function buildManutencoesPlanejadasExecutadas(
  cronograma: CronogramaItem[],
  os: OsAnaliticoItem[],
  range: RollingYearRange,
): ManutPlanejadaResult {
  const cronogramaPlano = filterCronogramaPlano(cronograma);
  const osPlano = filterOsPlano(os);
  const { modo, pctComTag } = assessModo(cronogramaPlano);

  const planned = buildPlannedOccurrences(cronogramaPlano, range);
  const semDataPlanejada = cronogramaPlano.filter(
    (item) => !parsePbiDate(item.ProximaRealizacao) && !parsePbiDate(item.DataDaUltima),
  ).length;

  const osExecRows: Array<{ os: OsAnaliticoItem; tipo: PlanoEcTipo; fechamento: Date }> = [];
  for (const item of osPlano) {
    const tipo = classifyPlanoEc(item.TipoDeManutencao);
    const fechamento = osFechamentoDate(item);
    if (!tipo || !fechamento) continue;
    if (!inRange(fechamento, range.start, range.end)) continue;
    osExecRows.push({ os: item, tipo, fechamento });
  }

  const months: ManutPlanejadaMonth[] = range.months.map((slot) => {
    const key = slot.key;
    let planejado = 0;
    for (const occ of planned) {
      if (occ.monthKey === key) planejado += 1;
    }
    let executado = 0;
    for (const row of osExecRows) {
      if (inMonth(row.fechamento, slot.year, slot.month)) executado += 1;
    }
    return {
      ...slot,
      planejado,
      executado,
      ...composeSaldoMes(planejado, executado),
    };
  });

  const totalPlanejado = months.reduce((sum, m) => sum + m.planejado, 0);
  const totalExecutado = months.reduce((sum, m) => sum + m.executado, 0);
  const cumprimento = pct(Math.min(totalPlanejado, totalExecutado), totalPlanejado);

  const planejadas = planned.map(toPlanejadaRow).sort((a, b) => b.dataSort - a.dataSort);
  const executadas = osExecRows
    .map((row) => toExecutadaRow(row.os, row.tipo, row.fechamento))
    .sort((a, b) => b.dataSort - a.dataSort);

  return {
    months,
    totalPlanejado,
    totalExecutado,
    saldo: totalPlanejado - totalExecutado,
    cumprimento,
    cumprimentoLabel: cumprimento == null ? "—" : formatPct(cumprimento),
    modo,
    pctComTag,
    cronogramaPlano,
    osPlano,
    planejadas,
    executadas,
    semDataPlanejada,
    exemplosCronograma: cronogramaPlano.slice(0, 5),
    exemplosOs: osExecRows.slice(0, 5).map((r) => r.os),
  };
}

export function manutDoMes(
  result: ManutPlanejadaResult,
  year: number,
  month: number,
): { planejadas: ManutListaRow[]; executadas: ManutListaRow[]; todas: ManutListaRow[] } {
  const planejadas = result.planejadas.filter((row) => row.year === year && row.month === month);
  const executadas = result.executadas.filter((row) => row.year === year && row.month === month);
  const todas = [...planejadas, ...executadas].sort((a, b) => b.dataSort - a.dataSort);
  return { planejadas, executadas, todas };
}

export function manutDoPeriodo(result: ManutPlanejadaResult) {
  return {
    planejadas: result.planejadas,
    executadas: result.executadas,
    todas: [...result.planejadas, ...result.executadas].sort((a, b) => b.dataSort - a.dataSort),
  };
}

export { fraseSaldo, rotuloSaldo };
