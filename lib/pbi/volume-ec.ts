import { format } from "date-fns";
import { MESES_ABREV } from "./cronograma-anual";
import { nowInSaoPaulo, parsePbiDate } from "./dates";
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

export function sampleOsParaConferencia(items: OsAnaliticoItem[], n = 5) {
  return [...items]
    .sort((a, b) => {
      const da = parsePbiDate(a.Abertura)?.getTime() ?? 0;
      const db = parsePbiDate(b.Abertura)?.getTime() ?? 0;
      return db - da;
    })
    .slice(0, n);
}

export function buildVolumeAbertasFechadas(os: OsAnaliticoItem[], range: RollingYearRange) {
  const aposEc = filterOsTipoEc(os);
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
