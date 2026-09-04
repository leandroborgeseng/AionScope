import type { ContratoPbiItem, ContratoParcelaDto } from "@/lib/pbi/types";

function parseApiDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  // YYYY-MM-DD or ISO datetime
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toDateOnly(raw: string | null | undefined): string | null {
  const d = parseApiDate(raw);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nomeContratoPbi(c: ContratoPbiItem): string {
  const desc = (c.Descricao ?? "").trim();
  if (desc) return desc;
  const num = (c.Numero ?? "").trim();
  if (num) return `Contrato ${num}`;
  return `Contrato ${c.ContratoId}`;
}

export function fimVigenciaContrato(c: ContratoPbiItem): Date | null {
  return parseApiDate(c.DataFimVigencia) ?? parseApiDate(c.DataFim);
}

export function situacaoEncerrada(situacao: string | null | undefined) {
  const s = (situacao ?? "").toLocaleUpperCase("pt-BR");
  if (!s) return false;
  return (
    s.includes("ENCERR") ||
    s.includes("CANCEL") ||
    s.includes("INATIV") ||
    s.includes("RESIL") ||
    s.includes("FINALIZ")
  );
}

/** Vigência intersecta o mês calendário (year, month 0–11). */
export function vigenciaIntersectaMes(c: ContratoPbiItem, year: number, month: number) {
  if (situacaoEncerrada(c.Situacao)) return false;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const inicio = parseApiDate(c.DataInicio);
  const fim = fimVigenciaContrato(c);
  if (inicio && inicio > monthEnd) return false;
  if (fim && fim < monthStart) return false;
  return true;
}

function mesesVigencia(c: ContratoPbiItem): number {
  const inicio = parseApiDate(c.DataInicio);
  const fim = fimVigenciaContrato(c);
  if (!inicio) return 1;
  const end = fim ?? new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate());
  const months =
    (end.getFullYear() - inicio.getFullYear()) * 12 + (end.getMonth() - inicio.getMonth()) + 1;
  return Math.max(1, months);
}

function isPeriodicidadeMensal(periodicidade: string | null | undefined) {
  const p = (periodicidade ?? "").toLocaleUpperCase("pt-BR");
  return p.includes("MENSAL") || p === "MÊS" || p === "MES" || p.includes("MÊS");
}

/**
 * Estimativa de valor mensal para exibição na lista.
 * Preferência: média das Parcelas.ValorMoeda; senão ValorTotal rateado pela vigência
 * (ou ValorTotal inteiro se Periodicidade indicar mensal).
 */
export function estimativaValorMensal(c: ContratoPbiItem): number {
  const parcelas = (c.Parcelas ?? []).filter((p) => Number(p.ValorMoeda) > 0);
  if (parcelas.length) {
    const sum = parcelas.reduce((s, p) => s + (Number(p.ValorMoeda) || 0), 0);
    return sum / parcelas.length;
  }
  const total = Number(c.ValorTotal) || 0;
  if (!(total > 0)) {
    const previsto = Number(c.CustoPrevisto) || 0;
    return previsto > 0 ? previsto / mesesVigencia(c) : 0;
  }
  if (isPeriodicidadeMensal(c.Periodicidade)) return total;
  return total / mesesVigencia(c);
}

function parcelaNoMes(p: ContratoParcelaDto, year: number, month: number) {
  const venc = parseApiDate(p.DataVencimento);
  if (!venc) return false;
  return venc.getFullYear() === year && venc.getMonth() === month;
}

/**
 * Despesa do contrato no mês:
 * 1) Soma Parcelas.ValorMoeda com DataVencimento no mês;
 * 2) Senão, se vigência intersecta o mês, usa estimativaValorMensal.
 */
export function valorContratoNoMes(c: ContratoPbiItem, year: number, month: number): number {
  if (!vigenciaIntersectaMes(c, year, month)) return 0;

  const parcelas = c.Parcelas ?? [];
  const doMes = parcelas.filter((p) => parcelaNoMes(p, year, month));
  if (doMes.length) {
    return doMes.reduce((s, p) => s + (Number(p.ValorMoeda) || 0), 0);
  }

  // Sem parcela naquele mês: só rateia se não houver parcelas cadastradas
  // (evita contar valor fixo em meses sem cobrança quando o cronograma existe).
  if (parcelas.length > 0) return 0;

  const v = estimativaValorMensal(c);
  return v > 0 ? v : 0;
}

export function contratosDoMesPbi(contratos: ContratoPbiItem[], year: number, month: number) {
  return contratos.filter((c) => valorContratoNoMes(c, year, month) > 0);
}

export function somaContratosNoMesPbi(contratos: ContratoPbiItem[], year: number, month: number) {
  return contratos.reduce((sum, c) => sum + valorContratoNoMes(c, year, month), 0);
}

/** View enxuta para drill-down do indicador. */
export type ContratoMesLinha = {
  id: string;
  nome: string;
  fornecedor?: string;
  valorMensal: number;
  inicio?: string | null;
  fim?: string | null;
  situacao?: string;
  numero?: string;
};

export function contratoMesLinha(
  c: ContratoPbiItem,
  year: number,
  month: number,
): ContratoMesLinha {
  return {
    id: String(c.ContratoId),
    nome: nomeContratoPbi(c),
    fornecedor: (c.Fornecedor ?? "").trim() || undefined,
    valorMensal: valorContratoNoMes(c, year, month),
    inicio: toDateOnly(c.DataInicio),
    fim: toDateOnly(c.DataFimVigencia ?? c.DataFim),
    situacao: (c.Situacao ?? "").trim() || undefined,
    numero: (c.Numero ?? "").trim() || undefined,
  };
}
