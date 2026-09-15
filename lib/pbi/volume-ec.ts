import { format } from "date-fns";
import { MESES_ABREV } from "./cronograma-anual";
import { nowInSaoPaulo, parsePbiDate } from "./dates";
import { normalizeOficina } from "./oficina-ec";
import type { OsAnaliticoItem } from "./types";

export const VOLUME_EC_PERIODO_API = "DoisAnosAtuais" as const;
export const VOLUME_EC_TIPO_API = "Todos" as const;

export const VOLUME_EC_CAMPOS = [
  "Abertura",
  "Fechamento",
  "DataDaSolucao",
  "TipoDeManutencao",
  "Oficina",
  "OS",
] as const;

export const RECORTE_EC_INCLUIR = [
  "TipoDeManutencao começa com “A -”",
  "ou contém ENGENHARIA CLÍNICA, CALIBRA, SEGURANÇA ELÉTRICA (inclui TSE), INSTRUMENTAL ou PREVENTIVA EQUIPAMENTOS MÉDICOS",
] as const;

export const RECORTE_EC_EXCLUIR = ["M - (predial)", "O - (obras)"] as const;

export type VolumeEcMovimento = "Aberta" | "Fechada" | "Ambas";

export type VolumeEcMonth = {
  year: number;
  month: number;
  key: string;
  label: string;
  abertas: number;
  fechadas: number;
  /** min(abertas, fechadas) — volume pareado */
  coberto: number;
  /** max(0, abertas − fechadas) — entrou mais do que fechou */
  deficit: number;
  /** max(0, fechadas − abertas) — fechou mais do que entrou */
  superavit: number;
  /** abertas − fechadas; >0 faltou, <0 superávit */
  saldo: number;
};

/** Composição empilhada de um mês: altura total = max(abertas, fechadas). */
export function composeSaldoMes(abertas: number, fechadas: number) {
  const coberto = Math.min(abertas, fechadas);
  const deficit = Math.max(0, abertas - fechadas);
  const superavit = Math.max(0, fechadas - abertas);
  return {
    coberto,
    deficit,
    superavit,
    saldo: abertas - fechadas,
  };
}

/** Texto curto do saldo para KPI, tooltip e rótulo. */
export function fraseSaldo(saldo: number): string {
  if (saldo > 0) return `faltou ${saldo}`;
  if (saldo < 0) return `superávit ${Math.abs(saldo)}`;
  return "0 (empatou)";
}

/**
 * % executada no mês = fechadas / abertas × 100.
 * Se abertas = 0 → 0 na série (barra zerada); UI/label preferem "—" (sem abertas), não "0%".
 */
export function pctExecutadaMes(abertas: number, fechadas: number): number {
  if (abertas <= 0) return 0;
  return (fechadas / abertas) * 100;
}

export function rotuloSaldo(saldo: number): string {
  if (saldo > 0) return `−${saldo}`;
  if (saldo < 0) return `+${Math.abs(saldo)}`;
  return "0";
}

export type VolumeEcRow = OsAnaliticoItem & {
  movimento: VolumeEcMovimento;
};

export type RollingYearRange = {
  start: Date;
  end: Date;
  fromISO: string;
  toISO: string;
  label: string;
  months: Array<{ year: number; month: number; key: string; label: string }>;
};

function normalizeTipo(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return `${MESES_ABREV[month]}/${String(year).slice(2)}`;
}

/** Data de fechamento: Fechamento se preenchido, senão DataDaSolucao. */
export function osFechamentoDate(os: Pick<OsAnaliticoItem, "Fechamento" | "DataDaSolucao">) {
  return parsePbiDate(os.Fechamento) || parsePbiDate(os.DataDaSolucao);
}

export function isTipoManutencaoEc(tipo: string | null | undefined) {
  const v = normalizeTipo(tipo);
  if (!v) return false;
  if (v.startsWith("M -") || v.startsWith("O -")) return false;
  if (v.startsWith("A -") || v.startsWith("A-")) return true;
  if (v.includes("ENGENHARIA CLINICA")) return true;
  if (v.includes("CALIBRA")) return true;
  if (v.includes("SEGURANCA ELETRICA") || v.includes("TSE")) return true;
  if (v.includes("INSTRUMENTAL")) return true;
  if (v.includes("PREVENTIVA") && v.includes("EQUIPAMENTOS MEDICOS")) return true;
  return false;
}

/** Intervalo rolante: início do mês de 12 meses atrás até o fim do mês atual (13 meses, inclusive). */
export function rollingYearRange(today = nowInSaoPaulo()): RollingYearRange {
  const start = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  const months: RollingYearRange["months"] = [];
  for (let i = 0; i < 13; i += 1) {
    const cursor = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      key: monthKey(cursor.getFullYear(), cursor.getMonth()),
      label: monthLabel(cursor.getFullYear(), cursor.getMonth()),
    });
  }
  return {
    start,
    end,
    fromISO: format(start, "yyyy-MM-dd"),
    toISO: format(new Date(today.getFullYear(), today.getMonth() + 1, 0), "yyyy-MM-dd"),
    label: `${monthLabel(start.getFullYear(), start.getMonth())} – ${monthLabel(today.getFullYear(), today.getMonth())}`,
    months,
  };
}

/**
 * Ano civil vigente (America/Sao_Paulo):
 * - eixo do gráfico: Jan–Dez (meses futuros ainda não ocorridos ficam zerados);
 * - contagem / API: 1º de janeiro → fim do mês atual (inclusive).
 */
export function currentCalendarYearRange(today = nowInSaoPaulo()): RollingYearRange {
  const year = today.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, today.getMonth() + 1, 0, 23, 59, 59, 999);
  const months: RollingYearRange["months"] = [];
  for (let month = 0; month < 12; month += 1) {
    months.push({
      year,
      month,
      key: monthKey(year, month),
      label: monthLabel(year, month),
    });
  }
  return {
    start,
    end,
    fromISO: format(start, "yyyy-MM-dd"),
    toISO: format(new Date(year, today.getMonth() + 1, 0), "yyyy-MM-dd"),
    label: `ano vigente (${year})`,
    months,
  };
}

function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function inMonth(date: Date | null, year: number, month: number) {
  return Boolean(date && date.getFullYear() === year && date.getMonth() === month);
}

export function filterOsTipoEc(os: OsAnaliticoItem[]) {
  return os.filter((item) => isTipoManutencaoEc(item.TipoDeManutencao));
}

/** Equals normalizado no campo Oficina (ex.: PREVENTIVA EQUIPAMENTOS). */
export function isOficinaEquals(oficina: string | null | undefined, target: string) {
  const want = normalizeOficina(target);
  if (!want) return false;
  return normalizeOficina(oficina) === want;
}

export function filterOsOficinaEquals(os: OsAnaliticoItem[], oficinaEquals: string) {
  return os.filter((item) => isOficinaEquals(item.Oficina, oficinaEquals));
}

/** União de várias oficinas (equals normalizado). Não inclui OFICINA GERAL. */
export function filterOsOficinaEqualsIn(os: OsAnaliticoItem[], oficinaEqualsIn: string[]) {
  const wants = new Set(
    oficinaEqualsIn.map((item) => normalizeOficina(item)).filter(Boolean),
  );
  if (wants.size === 0) return [];
  return os.filter((item) => wants.has(normalizeOficina(item.Oficina)));
}

export type VolumeAbertasFechadasOptions = {
  /**
   * Se definido, recorta por Oficina equals (normalizado) em vez do filtro de tipo EC.
   * Útil para fluxo operacional de uma oficina específica (Preventiva / Calibração / TSE).
   */
  oficinaEquals?: string;
  /**
   * União de oficinas (equals normalizado). Tem prioridade menor que `oficinaEquals`.
   * Usado no total das oficinas de plano (Preventiva + Calibração + Segurança elétrica).
   */
  oficinaEqualsIn?: string[];
};

export function sampleOsParaConferencia(items: OsAnaliticoItem[], n = 5) {
  return [...items]
    .sort((a, b) => {
      const da = parsePbiDate(a.Abertura)?.getTime() ?? 0;
      const db = parsePbiDate(b.Abertura)?.getTime() ?? 0;
      return db - da;
    })
    .slice(0, n);
}

function resolveOsParaVolume(os: OsAnaliticoItem[], options?: VolumeAbertasFechadasOptions) {
  if (options?.oficinaEquals) return filterOsOficinaEquals(os, options.oficinaEquals);
  if (options?.oficinaEqualsIn?.length) return filterOsOficinaEqualsIn(os, options.oficinaEqualsIn);
  return filterOsTipoEc(os);
}

export function buildVolumeAbertasFechadas(
  os: OsAnaliticoItem[],
  range: RollingYearRange,
  options?: VolumeAbertasFechadasOptions,
) {
  const aposEc = resolveOsParaVolume(os, options);
  const noIntervalo = aposEc.filter((item) => {
    const abertura = parsePbiDate(item.Abertura);
    const fechamento = osFechamentoDate(item);
    return inRange(abertura, range.start, range.end) || inRange(fechamento, range.start, range.end);
  });

  const months: VolumeEcMonth[] = range.months.map((slot) => {
    let abertas = 0;
    let fechadas = 0;
    for (const item of aposEc) {
      if (inMonth(parsePbiDate(item.Abertura), slot.year, slot.month)) abertas += 1;
      if (inMonth(osFechamentoDate(item), slot.year, slot.month)) fechadas += 1;
    }
    return { ...slot, abertas, fechadas, ...composeSaldoMes(abertas, fechadas) };
  });

  const totalAbertas = aposEc.filter((item) => inRange(parsePbiDate(item.Abertura), range.start, range.end)).length;
  const totalFechadas = aposEc.filter((item) => inRange(osFechamentoDate(item), range.start, range.end)).length;

  return {
    aposEc,
    noIntervalo,
    months,
    totalAbertas,
    totalFechadas,
    saldo: totalAbertas - totalFechadas,
    exemplos: sampleOsParaConferencia(noIntervalo),
  };
}

/** Oficinas do proxy operacional de execução de plano (abertura × fechamento). */
export const OFICINAS_VOLUME_PLANO = [
  {
    slug: "oficina-preventiva-abertas-fechadas",
    filterKey: "preventiva",
    chipLabel: "Preventiva",
    oficinaEquals: "PREVENTIVA EQUIPAMENTOS",
    oficinaLabel: "PREVENTIVA EQUIPAMENTOS",
    titulo: "Preventiva · OS abertas × fechadas",
    blurb: "Fluxo da oficina Preventiva: % executada mês a mês (fechadas÷abertas; proxy operacional, não laudo Tag a Tag).",
  },
  {
    slug: "oficina-calibracao-abertas-fechadas",
    filterKey: "calibracao",
    chipLabel: "Calibração",
    oficinaEquals: "CALIBRACAO DE EQUIPAMENTOS",
    oficinaLabel: "CALIBRAÇÃO DE EQUIPAMENTOS",
    titulo: "Calibração · OS abertas × fechadas",
    blurb: "Fluxo da oficina Calibração: % executada mês a mês (fechadas÷abertas; proxy operacional, não laudo Tag a Tag).",
  },
  {
    slug: "oficina-seguranca-eletrica-abertas-fechadas",
    filterKey: "seguranca-eletrica",
    chipLabel: "Segurança elétrica",
    oficinaEquals: "SEGURANCA ELETRICA",
    oficinaLabel: "SEGURANÇA ELÉTRICA",
    titulo: "Segurança elétrica (TSE) · OS abertas × fechadas",
    blurb: "Fluxo da oficina Segurança Elétrica (TSE): % executada mês a mês (fechadas÷abertas; proxy operacional, não laudo Tag a Tag).",
  },
] as const;

export type OficinaVolumePlano = (typeof OFICINAS_VOLUME_PLANO)[number];
export type OficinaVolumePlanoSlug = OficinaVolumePlano["slug"];
export type OficinaPlanoFilterKey = "todas" | OficinaVolumePlano["filterKey"];

export const OFICINAS_PLANO_EQUALS = OFICINAS_VOLUME_PLANO.map((item) => item.oficinaEquals);

export const OFICINAS_PLANO_CANONICAL_HREF = "/indicadores/oficinas-plano-abertas-fechadas";

export function oficinaVolumePlanoBySlug(slug: string): OficinaVolumePlano | undefined {
  return OFICINAS_VOLUME_PLANO.find((item) => item.slug === slug);
}

export function oficinaVolumePlanoByFilterKey(key: string): OficinaVolumePlano | undefined {
  return OFICINAS_VOLUME_PLANO.find((item) => item.filterKey === key);
}

export function parseOficinaPlanoFilterKey(raw: string | null | undefined): OficinaPlanoFilterKey {
  if (!raw || raw === "todas" || raw === "all") return "todas";
  const hit = oficinaVolumePlanoByFilterKey(raw);
  return hit ? hit.filterKey : "todas";
}

export function oficinasPlanoCanonicalHref(filterKey: OficinaPlanoFilterKey = "todas") {
  if (filterKey === "todas") return OFICINAS_PLANO_CANONICAL_HREF;
  return `${OFICINAS_PLANO_CANONICAL_HREF}?oficina=${filterKey}`;
}

export function resolveOficinaPlanoVolumeOptions(filterKey: OficinaPlanoFilterKey): {
  oficinaEquals?: string;
  oficinaEqualsIn?: string[];
  oficinaLabel: string;
  titulo: string;
  fichaSlug: OficinaVolumePlanoSlug | "oficinas-plano-abertas-fechadas";
} {
  if (filterKey === "todas") {
    return {
      oficinaEqualsIn: [...OFICINAS_PLANO_EQUALS],
      oficinaLabel: "Preventiva + Calibração + Segurança elétrica",
      titulo: "Oficinas de plano — abertas × fechadas",
      fichaSlug: "oficinas-plano-abertas-fechadas",
    };
  }
  const cfg = oficinaVolumePlanoByFilterKey(filterKey)!;
  return {
    oficinaEquals: cfg.oficinaEquals,
    oficinaLabel: cfg.oficinaLabel,
    titulo: cfg.titulo,
    fichaSlug: cfg.slug,
  };
}

export function volumeEcDoMes(items: OsAnaliticoItem[], year: number, month: number): VolumeEcRow[] {
  const rows: VolumeEcRow[] = [];
  for (const item of items) {
    const abriu = inMonth(parsePbiDate(item.Abertura), year, month);
    const fechou = inMonth(osFechamentoDate(item), year, month);
    if (!abriu && !fechou) continue;
    rows.push({
      ...item,
      movimento: abriu && fechou ? "Ambas" : abriu ? "Aberta" : "Fechada",
    });
  }
  return rows;
}

export function volumeEcDoPeriodo(
  items: OsAnaliticoItem[],
  range: RollingYearRange,
  tipo: "aberta" | "fechada" | "todas" = "todas",
): VolumeEcRow[] {
  const rows: VolumeEcRow[] = [];
  for (const item of items) {
    const abriu = inRange(parsePbiDate(item.Abertura), range.start, range.end);
    const fechou = inRange(osFechamentoDate(item), range.start, range.end);
    if (tipo === "aberta" && !abriu) continue;
    if (tipo === "fechada" && !fechou) continue;
    if (tipo === "todas" && !abriu && !fechou) continue;
    rows.push({
      ...item,
      movimento: abriu && fechou ? "Ambas" : abriu ? "Aberta" : "Fechada",
    });
  }
  return rows;
}
