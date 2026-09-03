import { parseBrNumber } from "./dates";
import { formatBRL } from "./indicators";
import { linkedToMedicalPark } from "./medical";
import type { OsAnaliticoItem } from "./types";
import {
  osFechamentoDate,
  type RollingYearRange,
} from "./volume-ec";

export const GASTO_REPARO_CAMPOS = [
  "Custo",
  "Fechamento",
  "DataDaSolucao",
  "TipoDeManutencao",
  "Tag",
  "Equipamento",
  "OS",
] as const;

export const GASTO_REPARO_INCLUIR = [
  "CORRETIVA (inclui “A - CORRETIVA ENGENHARIA CLÍNICA”)",
  "ASSISTÊNCIA TÉCNICA",
  "A - INSTRUMENTAL / man. externa de instrumentais",
  "A - MAN. EXTERNA ENGENHARIA CLÍNICA",
] as const;

export const GASTO_REPARO_EXCLUIR = [
  "M - (predial / hotelaria)",
  "O - (obras)",
  "calibração",
  "TSE / segurança elétrica",
  "preventiva",
  "movimentação, compra, instalação, recebimento, treinamento, baixa, obsoleto",
] as const;

export type GastoReparoCategoria = "corretiva" | "outro";

export type GastoReparoRow = OsAnaliticoItem & {
  custoNum: number;
  fechamento: Date;
  categoria: GastoReparoCategoria;
};

export type GastoReparoMonth = {
  year: number;
  month: number;
  key: string;
  label: string;
  gasto: number;
  gastoCorretiva: number;
  gastoOutro: number;
  osCount: number;
  osComCusto: number;
  osCustoZero: number;
};

function normalizeTipo(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function inMonth(date: Date | null, year: number, month: number) {
  return Boolean(date && date.getFullYear() === year && date.getMonth() === month);
}

/** Reparo de equipamento: corretiva, assistência técnica, instrumental, man. externa. */
export function isTipoReparoMedico(tipo: string | null | undefined) {
  const v = normalizeTipo(tipo);
  if (!v) return false;
  if (v.startsWith("M -") || v.startsWith("M-") || v.startsWith("O -") || v.startsWith("O-")) return false;
  if (v.includes("OBRAS") || v.includes("TAPECARIA") || v.includes("HOTELARIA") || v.includes("REFRIGERACAO")) {
    return false;
  }
  if (v.includes("CALIBRA") || v.includes("TSE") || v.includes("SEGURANCA ELETRICA") || v.includes("PREVENT")) {
    return false;
  }
  if (
    v.includes("MOVIMENTACAO") ||
    v.includes("COMPRA") ||
    v.includes("AGUARDANDO") ||
    v.includes("AG. BAIXA") ||
    v.includes("INSTALACAO") ||
    v.includes("OBSOLETO") ||
    v.includes("RECEBIMENTO") ||
    v.includes("TREINAMENTO")
  ) {
    return false;
  }
  if (v.includes("CORRET") || v.includes("REPARO") || v.includes("ASSISTENCIA TECNICA")) return true;
  if (v.includes("INSTRUMENTAL")) return true;
  if (v.includes("MAN. EXTERNA") || v.includes("MANUTENCAO EXTERNA")) return true;
  return false;
}

export function categoriaReparo(tipo: string | null | undefined): GastoReparoCategoria {
  return normalizeTipo(tipo).includes("CORRET") ? "corretiva" : "outro";
}

export function parseOsCusto(value: string | number | null | undefined) {
  return parseBrNumber(value) ?? 0;
}

/** R$ 1.234; se o espaço for curto ou o número for grande, R$ 1,2 mil. */
export function formatGastoBarra(value: number, boxWidth: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const full = value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
  const char = 6.4;
  if (boxWidth >= full.length * char + 4) return full;
  const compact = formatGastoCompacto(value);
  if (boxWidth >= compact.length * char + 4) return compact;
  return null;
}

export function formatGastoCompacto(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function formatGastoEixo(value: number) {
  if (!Number.isFinite(value) || value === 0) return "R$ 0";
  return formatGastoCompacto(value);
}

function sampleGastoParaConferencia(items: GastoReparoRow[], n = 5) {
  const byClose = (a: GastoReparoRow, b: GastoReparoRow) => b.fechamento.getTime() - a.fechamento.getTime();
  const com = [...items.filter((item) => item.custoNum > 0)].sort(byClose);
  const zero = [...items.filter((item) => item.custoNum <= 0)].sort(byClose);
  const pickCom = com.slice(0, Math.min(3, n));
  const pickZero = zero.slice(0, Math.max(0, n - pickCom.length));
  const extraCom = com.slice(pickCom.length, pickCom.length + Math.max(0, n - pickCom.length - pickZero.length));
  return [...pickCom, ...pickZero, ...extraCom].slice(0, n);
}

export function buildGastoReparo(
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
    if (!tag) {
      semTag.push(item);
      continue;
    }
    if (!linkedToMedicalPark(tag, undefined, medicalTags, medicalIds)) {
      tagForaDoIndice.push(item);
      continue;
    }
    aposMedico.push(item);
  }

  const aposReparo = aposMedico.filter((item) => isTipoReparoMedico(item.TipoDeManutencao));
  const semFechamento = aposReparo.filter((item) => !osFechamentoDate(item));

  const rows: GastoReparoRow[] = [];
  for (const item of aposReparo) {
    const fechamento = osFechamentoDate(item);
    if (!fechamento) continue;
    if (!inRange(fechamento, range.start, range.end)) continue;
    rows.push({
      ...item,
      custoNum: parseOsCusto(item.Custo),
      fechamento,
      categoria: categoriaReparo(item.TipoDeManutencao),
    });
  }

  const months: GastoReparoMonth[] = range.months.map((slot) => {
    const doMes = rows.filter((item) => inMonth(item.fechamento, slot.year, slot.month));
    const gastoCorretiva = doMes
      .filter((item) => item.categoria === "corretiva")
      .reduce((sum, item) => sum + item.custoNum, 0);
    const gastoOutro = doMes
      .filter((item) => item.categoria === "outro")
      .reduce((sum, item) => sum + item.custoNum, 0);
    const osComCusto = doMes.filter((item) => item.custoNum > 0).length;
    return {
      ...slot,
      gasto: gastoCorretiva + gastoOutro,
      gastoCorretiva,
      gastoOutro,
      osCount: doMes.length,
      osComCusto,
      osCustoZero: doMes.length - osComCusto,
    };
  });

  const gastoTotal = rows.reduce((sum, item) => sum + item.custoNum, 0);
  const osComCusto = rows.filter((item) => item.custoNum > 0).length;
  const osCustoZero = rows.length - osComCusto;
  const gastoCorretiva = rows
    .filter((item) => item.categoria === "corretiva")
    .reduce((sum, item) => sum + item.custoNum, 0);
  const gastoOutro = rows
    .filter((item) => item.categoria === "outro")
    .reduce((sum, item) => sum + item.custoNum, 0);
  const empilhar = gastoCorretiva > 0 && gastoOutro > 0;
  const meses = range.months.length || 1;

  return {
    semTag,
    tagForaDoIndice,
    aposMedico,
    aposReparo,
    semFechamento,
    noIntervalo: rows,
    months,
    gastoTotal,
    mediaMensal: gastoTotal / meses,
    osComCusto,
    osCustoZero,
    gastoCorretiva,
    gastoOutro,
    empilhar,
    exemplos: sampleGastoParaConferencia(rows),
  };
}

export function gastoReparoDoMes(rows: GastoReparoRow[], year: number, month: number) {
  return rows.filter((item) => inMonth(item.fechamento, year, month));
}

export function gastoReparoComCusto(rows: GastoReparoRow[]) {
  return rows.filter((item) => item.custoNum > 0);
}

export function rotuloCustoOs(custo: number) {
  return formatBRL(custo);
}
