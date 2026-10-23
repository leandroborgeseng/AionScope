/**
 * Fixture FICTÍCIA para /sala/indicadores?demo=indicadores (screenshots e testes).
 * Números redondos inventados; sem contrato real nem nome de fornecedor (I9).
 */
import type { Contrato } from "@/lib/cadastros/types";
import { buildCustoParqueAno, type CustoParqueAno } from "@/lib/pbi/custo-manutencao-parque";
import type { GastoReparoMonth } from "@/lib/pbi/gasto-reparo";
import { currentCalendarYearRange } from "@/lib/pbi/volume-ec";
import type { ResumoIndicador } from "@/lib/indicadores/resumo";

const ct = (id: string, valorMensal: number): Contrato => ({
  id,
  nome: `Contrato DEMO ${id}`,
  valorMensal,
  ativo: true,
  tipo: "MANUTENCAO",
  inicio: "2026-01-01",
  fim: null,
});

function gasto(year: number, valores: number[]): GastoReparoMonth[] {
  return valores.map((v, m) => ({
    year,
    month: m,
    key: `${year}-${String(m + 1).padStart(2, "0")}`,
    label: String(m),
    gasto: v,
    gastoCorretiva: v,
    gastoOutro: 0,
    osCount: 1,
    osComCusto: 1,
    osCustoZero: 0,
  }));
}

/** Ano DEMO 2026 até outubro: parque R$ 50 mi, contratos R$ 100 mil/mês + avulsos fictícios. */
export function custoParqueDemo(opts: { mesAtual?: number; valorParque?: number | null } = {}): CustoParqueAno {
  const year = 2026;
  const r = currentCalendarYearRange(new Date(year, 5, 1));
  return buildCustoParqueAno({
    year,
    months: r.months,
    contratos: [ct("A", 60_000), ct("B", 40_000)],
    gastoMonths: gasto(year, [20_000, 30_000, 25_000, 40_000, 35_000, 30_000, 45_000, 20_000, 30_000, 25_000, 0, 0]),
    valorParque: opts.valorParque === undefined ? 50_000_000 : opts.valorParque,
    avulsosDisponiveis: true,
    mesAtual: opts.mesAtual ?? 9,
  });
}

/** Cópias com títulos DEMO para testar a grade com N cards (I13). */
export function clonesDemo(base: ResumoIndicador, n: number): ResumoIndicador[] {
  return Array.from({ length: n }, (_, i) =>
    i === 0
      ? base
      : {
          ...base,
          id: `${base.id}-demo-${i + 1}`,
          titulo: `Indicador DEMO ${i + 1}`,
          ...(i % 3 === 2 ? { status: "acima" as const, valorPrincipal: "3,80%", valorPrincipalNum: 3.8 } : {}),
        },
  );
}
