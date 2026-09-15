/**
 * Motivos das corretivas médicas: recorrência por Tag agrupada por tipo + Pareto Causa/Ocorrência.
 */
import { isCorretiva } from "./filters";
import { findEquipamento, osTemEquipamento, type EquipamentoIndex } from "./indicadores-os";
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

export const RECORRENCIA_MIN_OS = 2;
export const RECORRENCIA_TIPOS_TOP = 15;

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
  tipo: string;
  setor: string;
  count: number;
  recorrente: boolean;
};

export type RecorrenciaTipoRow = {
  tipo: string;
  osCount: number;
  tagsCount: number;
  tagsRecorrentes: number;
  tags: RecorrenciaTagRow[];
};

export type MotivosCorretivasResult = {
  noIntervalo: OsAnaliticoItem[];
  causas: MotivoParetoRow[];
  ocorrencias: MotivoParetoRow[];
  recorrenciaTags: RecorrenciaTagRow[];
  recorrenciaTipos: RecorrenciaTipoRow[];
  tagsRecorrentes: number;
  osEmTagsRecorrentes: number;
  tiposComCorretiva: number;
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

function normalizeTipoKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nome genérico do equipamento (tipo/família), não a Tag. Preferência: parque → OS. */
export function resolveTipoEquipamento(
  item: Pick<OsAnaliticoItem, "Tag" | "Equipamento" | "Setor">,
  index?: EquipamentoIndex | null,
): string {
  if (index) {
    const cadastro = findEquipamento(index, item.Tag, item.Equipamento, item.Setor);
    const doParque = (cadastro?.Equipamento ?? "").trim();
    if (doParque) return doParque;
  }
  const daOs = (item.Equipamento ?? "").trim();
  if (daOs) return daOs;
  return "Sem tipo";
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
  equipamentoIndex?: EquipamentoIndex | null,
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

  const byTag = new Map<
    string,
    { count: number; equipamento: string; tipo: string; setor: string; tipoKey: string }
  >();
  for (const item of noIntervalo) {
    const tag = (item.Tag ?? "").trim() || "—";
    const tipoRaw = resolveTipoEquipamento(item, equipamentoIndex);
    const tipoKey = normalizeTipoKey(tipoRaw) || "SEM TIPO";
    const cur = byTag.get(tag) ?? {
      count: 0,
      equipamento: (item.Equipamento ?? "").trim() || tipoRaw || "—",
      tipo: tipoRaw,
      setor: (item.Setor ?? "").trim() || "—",
      tipoKey,
    };
    cur.count += 1;
    if (cur.equipamento === "—" && item.Equipamento) cur.equipamento = item.Equipamento.trim();
    if (cur.setor === "—" && item.Setor) cur.setor = item.Setor.trim();
    if ((!cur.tipo || cur.tipo === "Sem tipo") && tipoRaw !== "Sem tipo") {
      cur.tipo = tipoRaw;
      cur.tipoKey = tipoKey;
    }
    byTag.set(tag, cur);
  }

  const recorrenciaTags: RecorrenciaTagRow[] = [...byTag.entries()]
    .map(([tag, v]) => ({
      tag,
      equipamento: v.equipamento,
      tipo: v.tipo,
      setor: v.setor,
      count: v.count,
      recorrente: v.count >= RECORRENCIA_MIN_OS,
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));

  const byTipo = new Map<
    string,
    { tipo: string; osCount: number; tags: RecorrenciaTagRow[] }
  >();
  for (const row of recorrenciaTags) {
    const key = normalizeTipoKey(row.tipo) || "SEM TIPO";
    const cur = byTipo.get(key) ?? { tipo: row.tipo, osCount: 0, tags: [] };
    cur.osCount += row.count;
    cur.tags.push(row);
    byTipo.set(key, cur);
  }

  const recorrenciaTipos: RecorrenciaTipoRow[] = [...byTipo.values()]
    .map((g) => {
      const tags = [...g.tags].sort(
        (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"),
      );
      return {
        tipo: g.tipo,
        osCount: g.osCount,
        tagsCount: tags.length,
        tagsRecorrentes: tags.filter((t) => t.recorrente).length,
        tags,
      };
    })
    .sort((a, b) => b.osCount - a.osCount || a.tipo.localeCompare(b.tipo, "pt-BR"));

  const tagsRecorrentes = recorrenciaTags.filter((t) => t.recorrente).length;
  const osEmTagsRecorrentes = recorrenciaTags
    .filter((t) => t.recorrente)
    .reduce((sum, t) => sum + t.count, 0);

  return {
    noIntervalo,
    causas,
    ocorrencias,
    recorrenciaTags,
    recorrenciaTipos,
    tagsRecorrentes,
    osEmTagsRecorrentes,
    tiposComCorretiva: recorrenciaTipos.length,
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

export function filterOsPorTipo(
  rows: OsAnaliticoItem[],
  tipo: string,
  equipamentoIndex?: EquipamentoIndex | null,
) {
  const key = normalizeTipoKey(tipo) || "SEM TIPO";
  return rows.filter((o) => {
    const resolved = resolveTipoEquipamento(o, equipamentoIndex);
    return (normalizeTipoKey(resolved) || "SEM TIPO") === key;
  });
}
