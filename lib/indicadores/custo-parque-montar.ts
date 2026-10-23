/**
 * Montagem ÚNICA do indicador custo/parque a partir dos dados brutos (I3/I10).
 * Usada pelo hook do navegador (página logada) e pelo cálculo no servidor (resumo da Sala, sem R$).
 * Pura: sem React, sem fetch, sem banco.
 */
import type { Contrato } from "@/lib/cadastros/types";
import { buildCustoParqueAno } from "@/lib/pbi/custo-manutencao-parque";
import { buildGastoReparo } from "@/lib/pbi/gasto-reparo";
import { escolherValorParque, valorParqueDoMes, type ParqueRegra } from "@/lib/pbi/parque-frescor";
import { resumirValorParqueApi, valorParqueEfetivo } from "@/lib/pbi/parque-valor";
import type { EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";
import type { RollingYearRange } from "@/lib/pbi/volume-ec";

export type EntradaCustoParque = {
  range: RollingYearRange;
  hoje: Date;
  os: OsAnaliticoItem[];
  osErro: string | null;
  medicalTags: Set<string>;
  medicalIds: Set<number>;
  medicalErro: string | null;
  /** equipamentos ativos com valor de substituição (soma ao vivo) */
  equipamentosAtivos: EquipamentoItem[];
  parqueGravado: number | null;
  regra?: ParqueRegra;
  mensal?: Array<{ competencia: string; valor: number }>;
  contratos: Contrato[];
  contratosErro: boolean;
};

export function montarCustoParque(e: EntradaCustoParque) {
  const apiResumo = e.equipamentosAtivos.length ? resumirValorParqueApi(e.equipamentosAtivos) : null;
  const gasto = buildGastoReparo(e.os, e.range, e.medicalTags, e.medicalIds);
  // P2: soma ao vivo primeiro; valor gravado só como reserva.
  const escolha = escolherValorParque({ aoVivo: apiResumo?.substituicao.todos.total ?? null, gravado: e.parqueGravado });
  const efetivo = valorParqueEfetivo({ apiTodosSubstituicao: escolha.valor });
  const year = e.range.months[0]?.year ?? e.hoje.getFullYear();
  const mesAtual = year === e.hoje.getFullYear() ? e.hoje.getMonth() : 11;
  const ind = buildCustoParqueAno({
    year,
    months: e.range.months,
    contratos: e.contratos,
    gastoMonths: gasto.months,
    valorParque: efetivo.valor,
    valorParqueDoMes: e.regra === "mensal" ? (c: string) => valorParqueDoMes("mensal", efetivo.valor, e.mensal ?? [], c) : undefined,
    avulsosDisponiveis: !e.osErro && !e.medicalErro,
    mesAtual,
  });
  const faltandoExtra = e.contratosErro ? ["cadastro de contratos indisponível"] : [];
  return { ind, faltandoExtra, gasto, apiResumo, escolha, year, mesAtual };
}
