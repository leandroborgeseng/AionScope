/**
 * Motivos das corretivas médicas: Pareto Causa/Ocorrência + recorrência por Tag.
 */
import { isCorretiva } from "./filters";
import { osTemEquipamento } from "./indicadores-os";
import { formatPct, pct, pareto } from "./indicators";
import { linkedToMedicalPark } from "./medical";
import { parsePbiDate } from "./dates";
import type { OsAnaliticoItem } from "./types";
import type { RollingYearRange } from "./volume-ec";

export const MOTIVOS_CORRETIVAS_CAMPOS = [
  "Abertura",
  "Causa",
  "Ocorrencia",
  "Tag",
  "Equipamento",
  "Setor",
  "TipoDeManutencao",
  "OS",
  "SituacaoDaOS",
  "ObservacaoDaOS",
  "Servico",
  "Pendencia",
  "JustificativaEncerramento",
] as const;

export type MotivoParetoRow = {
  name: string;
  count: number;
  pct: number | null;
  pctLabel: string;
  acumulado: number;
  acumuladoPct: number | null;
  acumuladoLabel: string;
};

export type RecorrenciaTagRow = {
  tag: string;
  equipamento: string;
  setor: string;
  count: number;
};

export type MotivosCorretivasResult = {
  noIntervalo: OsAnaliticoItem[];
  causas: MotivoParetoRow[];
  ocorrencias: MotivoParetoRow[];
  recorrenciaTags: RecorrenciaTagRow[];
  total: number;
  semCausa: number;
  semOcorrencia: number;
  aposMedico: number;
  aposCorretiva: number;
};

function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function buildParetoWithAcumulado(values: Array<string | null | undefined>, top = 15): MotivoParetoRow[] {
  const base = pareto(values, top);
  const total = values.length;
  let acumulado = 0;
  return base.map((row) => {
    acumulado += row.count;
    const p = pct(row.count, total);
    const acumPct = pct(acumulado, total);
    return {
      name: row.name,
      count: row.count,
      pct: p,
      pctLabel: formatPct(p),
      acumulado,
      acumuladoPct: acumPct,
      acumuladoLabel: formatPct(acumPct),
    };
  });
}

export function buildMotivosCorretivas(
  os: OsAnaliticoItem[],
  range: RollingYearRange,
  medicalTags: Set<string>,
  medicalIds: Set<number>,
): MotivosCorretivasResult {
  let aposMedico = 0;
  const aposCorretiva: OsAnaliticoItem[] = [];

  for (const item of os) {
    const tag = (item.Tag ?? "").trim();
    if (!tag && !osTemEquipamento(item)) continue;
    if (!linkedToMedicalPark(tag, undefined, medicalTags, medicalIds)) continue;
    aposMedico += 1;
    if (!isCorretiva(item.TipoDeManutencao)) continue;
    aposCorretiva.push(item);
  }

  const noIntervalo = aposCorretiva.filter((item) => {
    const abertura = parsePbiDate(item.Abertura);
    return inRange(abertura, range.start, range.end);
  });

  const causas = buildParetoWithAcumulado(
    noIntervalo.map((o) => o.Causa),
    15,
  );
  const ocorrencias = buildParetoWithAcumulado(
    noIntervalo.map((o) => o.Ocorrencia),
    15,
  );

  const byTag = new Map<string, { count: number; equipamento: string; setor: string }>();
  for (const item of noIntervalo) {
    const tag = (item.Tag ?? "").trim() || "—";
    const cur = byTag.get(tag) ?? {
      count: 0,
      equipamento: (item.Equipamento ?? "").trim() || "—",
      setor: (item.Setor ?? "").trim() || "—",
    };
    cur.count += 1;
    if (cur.equipamento === "—" && item.Equipamento) cur.equipamento = item.Equipamento.trim();
    if (cur.setor === "—" && item.Setor) cur.setor = item.Setor.trim();
    byTag.set(tag, cur);
  }

  const recorrenciaTags: RecorrenciaTagRow[] = [...byTag.entries()]
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"))
    .slice(0, 20);

  return {
    noIntervalo,
    causas,
    ocorrencias,
    recorrenciaTags,
    total: noIntervalo.length,
    semCausa: noIntervalo.filter((o) => !(o.Causa ?? "").trim()).length,
    semOcorrencia: noIntervalo.filter((o) => !(o.Ocorrencia ?? "").trim()).length,
    aposMedico,
    aposCorretiva: aposCorretiva.length,
  };
}

export function filterOsPorCausa(rows: OsAnaliticoItem[], causa: string) {
  return rows.filter((o) => ((o.Causa ?? "").trim() || "Não informado") === causa);
}

export function filterOsPorOcorrencia(rows: OsAnaliticoItem[], ocorrencia: string) {
  return rows.filter((o) => ((o.Ocorrencia ?? "").trim() || "Não informado") === ocorrencia);
}

export function filterOsPorTag(rows: OsAnaliticoItem[], tag: string) {
  return rows.filter((o) => ((o.Tag ?? "").trim() || "—") === tag);
}
