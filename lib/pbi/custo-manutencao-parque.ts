import { somaContratosNoMes, contratosDoMes } from "@/lib/cadastros/contratos";
import type { Contrato } from "@/lib/cadastros/types";
import type { GastoReparoMonth, GastoReparoRow } from "@/lib/pbi/gasto-reparo";
import { formatBRL } from "@/lib/pbi/indicators";
import type { RollingYearRange } from "@/lib/pbi/volume-ec";

export type DespesaParqueMonth = {
  year: number;
  month: number;
  key: string;
  label: string;
  contratos: number;
  avulsos: number;
  despesa: number;
  /** (despesa / valorParque) × 100 */
  pctParque: number | null;
  osCount: number;
  contratosAtivos: number;
};

export type DespesaParqueBuild = {
  months: DespesaParqueMonth[];
  despesaTotal: number;
  contratosTotal: number;
  avulsosTotal: number;
  mediaMensal: number;
  mediaPctParque: number | null;
  pctParquePeriodo: number | null;
  valorParque: number | null;
  fonteParque: "manual" | "api" | null;
};

export function buildDespesaParque(opts: {
  range: RollingYearRange;
  contratos: Contrato[];
  gastoMonths: GastoReparoMonth[];
  valorParque: number | null;
  fonteParque: "manual" | "api" | null;
}): DespesaParqueBuild {
  const gastoByKey = new Map(opts.gastoMonths.map((m) => [m.key, m]));

  const months: DespesaParqueMonth[] = opts.range.months.map((slot) => {
    const contratos = somaContratosNoMes(opts.contratos, slot.year, slot.month);
    const gasto = gastoByKey.get(slot.key);
    const avulsos = gasto?.gasto ?? 0;
    const despesa = contratos + avulsos;
    const pctParque =
      opts.valorParque != null && opts.valorParque > 0 ? (despesa / opts.valorParque) * 100 : null;
    return {
      ...slot,
      contratos,
      avulsos,
      despesa,
      pctParque,
      osCount: gasto?.osCount ?? 0,
      contratosAtivos: contratosDoMes(opts.contratos, slot.year, slot.month).length,
    };
  });

  const despesaTotal = months.reduce((s, m) => s + m.despesa, 0);
  const contratosTotal = months.reduce((s, m) => s + m.contratos, 0);
  const avulsosTotal = months.reduce((s, m) => s + m.avulsos, 0);
  const n = months.length || 1;
  const pcts = months.map((m) => m.pctParque).filter((v): v is number => v != null);
  const mediaPctParque = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  const pctParquePeriodo =
    opts.valorParque != null && opts.valorParque > 0 ? (despesaTotal / opts.valorParque) * 100 : null;

  return {
    months,
    despesaTotal,
    contratosTotal,
    avulsosTotal,
    mediaMensal: despesaTotal / n,
    mediaPctParque,
    pctParquePeriodo,
    valorParque: opts.valorParque,
    fonteParque: opts.fonteParque,
  };
}

export function formatPctParque(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

export function rotuloDespesaMes(month: DespesaParqueMonth) {
  return `${formatBRL(month.despesa)} · contratos ${formatBRL(month.contratos)} · avulsos ${formatBRL(month.avulsos)}`;
}

export type ListaDespesaMes = {
  contratos: Contrato[];
  os: GastoReparoRow[];
};
