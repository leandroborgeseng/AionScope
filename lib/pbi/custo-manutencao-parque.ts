/**
 * Indicador "Custo de manutenção / valor do parque" (aceite 20/10/2026).
 * Puro: sem banco/React. Ano civil jan–dez; acumulado zera em janeiro.
 * Numerador do mês = contratos de MANUTENCAO do cadastro próprio (C1–C5) + avulsos (OS de reparo médico, C7).
 * Denominador = valor de substituição do parque (todos os equipamentos), inalterado.
 */
import { contratoContaNoIndicador, contratoSuspensoNoMes } from "@/lib/cadastros/contratos-proprios";
import type { Contrato } from "@/lib/cadastros/types";
import type { GastoReparoMonth } from "@/lib/pbi/gasto-reparo";

export const META_ANUAL_PCT = 4;

export type StatusMeta = "Dentro" | "Acima";

export type CustoParqueMes = {
  year: number;
  /** 0–11 */
  month: number;
  key: string;
  label: string;
  /** mês ainda não chegou (só meta) */
  futuro: boolean;
  contratos: number;
  avulsos: number;
  despesa: number;
  acumulado: number;
  /** acumulado / parque × 100; null = sem dados */
  pctAcumulado: number | null;
  /** 4 × m/12 */
  metaPct: number;
  status: StatusMeta | null;
  contratosNoMes: Contrato[];
  /** Contratos que contariam no mês, mas estão suspensos (fora do custo; linha à parte). */
  suspensosNoMes: Contrato[];
  suspensosValor: number;
  osCount: number;
};

export type CustoParqueAno = {
  year: number;
  months: CustoParqueMes[];
  /** mês de referência (atual) */
  atual: CustoParqueMes | null;
  valorParque: number | null;
  /** mensagens do que faltou; vazio = calculável */
  faltando: string[];
  semContratos: boolean;
};

export function metaProporcionalPct(month0: number) {
  return (META_ANUAL_PCT * (month0 + 1)) / 12;
}

export function contratosNoMes(contratos: Contrato[], year: number, month: number) {
  return contratos.filter((c) => contratoContaNoIndicador(c, year, month));
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function buildCustoParqueAno(opts: {
  year: number;
  months: Array<{ year: number; month: number; key: string; label: string }>;
  contratos: Contrato[];
  gastoMonths: GastoReparoMonth[];
  /** null/0 = parque ausente */
  valorParque: number | null;
  /** Regra mensal (PARQUE_REGRA=mensal): denominador por competência YYYY-MM; ausente = valor único. */
  valorParqueDoMes?: (competencia: string) => number | null;
  /** false = API GlobalThings fora / avulsos indisponíveis */
  avulsosDisponiveis: boolean;
  parqueErro?: string | null;
  /** último mês realizado (0–11) no ano; padrão 11 */
  mesAtual?: number;
}): CustoParqueAno {
  const faltando: string[] = [];
  const parqueOk = opts.valorParque != null && Number.isFinite(opts.valorParque) && opts.valorParque > 0;
  if (!parqueOk) faltando.push(opts.parqueErro ?? "valor do parque indisponível");
  if (!opts.avulsosDisponiveis) faltando.push("custos avulsos indisponíveis");
  const calculavel = faltando.length === 0;
  const mesAtual = opts.mesAtual ?? 11;

  const gastoByKey = new Map(opts.gastoMonths.map((m) => [m.key, m]));
  let acumulado = 0;
  const months: CustoParqueMes[] = opts.months
    .filter((s) => s.year === opts.year)
    .map((slot) => {
      const futuro = slot.month > mesAtual;
      const lista = futuro ? [] : contratosNoMes(opts.contratos, slot.year, slot.month);
      const susp = futuro ? [] : opts.contratos.filter((c) => contratoSuspensoNoMes(c, slot.year, slot.month));
      const contratos = round2(lista.reduce((s, c) => s + c.valorMensal, 0));
      const g = futuro ? undefined : gastoByKey.get(slot.key);
      const avulsos = round2(g?.gasto ?? 0);
      const despesa = round2(contratos + avulsos);
      acumulado = round2(acumulado + despesa);
      const metaPct = metaProporcionalPct(slot.month);
      const comp = `${slot.year}-${String(slot.month + 1).padStart(2, "0")}`;
      const den = opts.valorParqueDoMes?.(comp) ?? opts.valorParque!;
      const pctAcumulado = calculavel && !futuro && den > 0 ? (acumulado / den) * 100 : null;
      const status: StatusMeta | null = pctAcumulado == null ? null : pctAcumulado <= metaPct ? "Dentro" : "Acima";
      return {
        ...slot,
        futuro,
        contratos,
        avulsos,
        despesa,
        acumulado,
        pctAcumulado,
        metaPct,
        status,
        contratosNoMes: lista,
        suspensosNoMes: susp,
        suspensosValor: round2(susp.reduce((s, c) => s + c.valorMensal, 0)),
        osCount: g?.osCount ?? 0,
      };
    });

  const atual = months.find((m) => m.month === mesAtual) ?? null;
  return {
    year: opts.year,
    months,
    atual,
    valorParque: parqueOk ? opts.valorParque : null,
    faltando,
    semContratos: !opts.contratos.some((c) => c.tipo === "MANUTENCAO"),
  };
}

export function formatPctParque(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

export function rotuloStatus(status: StatusMeta | null) {
  return status === "Dentro" ? "Dentro da meta" : status === "Acima" ? "Acima da meta" : "Sem dados";
}

/** Série do gráfico. Sem dados (ex.: avulsos indisponíveis), não há barras nem acumulado: só a meta proporcional. */
export function serieGraficoParque(months: CustoParqueMes[], semDados: boolean) {
  return months.map((m) => ({
    name: m.label,
    mes: m,
    contratos: semDados || m.futuro ? null : m.contratos,
    avulsos: semDados || m.futuro ? null : m.avulsos,
    pct: semDados ? null : m.pctAcumulado,
    meta: m.metaPct,
  }));
}
