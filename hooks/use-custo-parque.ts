"use client";

/**
 * Dados do indicador "Custo de manutenção / valor do parque" — fonte ÚNICA para a página
 * /indicadores/custo-manutencao-parque e para o card da Sala TV (I3/I10).
 */
import { useMemo } from "react";
import { useContratos, useParqueMeta } from "@/hooks/use-cadastros";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { dataOf, usePbiQuery } from "@/hooks/use-pbi";
import { buildCustoParqueAno } from "@/lib/pbi/custo-manutencao-parque";
import { buildGastoReparo } from "@/lib/pbi/gasto-reparo";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { nowInSaoPaulo, startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { resumirValorParqueApi, valorParqueEfetivo } from "@/lib/pbi/parque-valor";
import { equipamentosSemValor, escolherValorParque, frescorParque, valorParqueDoMes } from "@/lib/pbi/parque-frescor";
import type { EquipamentoItem } from "@/lib/pbi/types";
import { estadoCustoParque } from "@/lib/indicadores/resumo";

export function useCustoParque() {
  const { range, raw, bruta, loading: osLoading, error: osError, result: osResult } = useOsAnaliticoRollingYear("calendarYear");
  const medical = useMedicalIndex();
  const parqueQ = useParqueMeta();
  const contratosQ = useContratos();
  const hoje = useMemo(() => nowInSaoPaulo(), []);

  const eqQ = usePbiQuery<EquipamentoItem[]>(
    "equipamentos",
    { ...EMPTY_FILTERS, from: startOfMonthISO(), to: todayISO(), tipoManutencao: "Todos", somenteMedicos: false },
    { apenasAtivos: "true", incluirComponentes: "false", incluirCustoSubstituicao: "true" },
  );

  const apiResumo = useMemo(() => {
    const items = dataOf(eqQ.data) ?? [];
    return items.length ? resumirValorParqueApi(items) : null;
  }, [eqQ.data]);

  const gasto = useMemo(
    () => buildGastoReparo(raw, range, medical.tags, medical.ids),
    [raw, range, medical.tags, medical.ids],
  );

  // P2: soma ao vivo primeiro; valor gravado (parque_meta) só como reserva se a API/cache falhar.
  const escolha = escolherValorParque({
    aoVivo: apiResumo?.substituicao.todos.total ?? null,
    gravado: parqueQ.data?.valorApi ?? null,
  });
  const efetivo = valorParqueEfetivo({ apiTodosSubstituicao: escolha.valor });
  const frescor = useMemo(() => {
    const iso = escolha.fonte === "ao-vivo" ? (eqQ.data?.cache?.fetchedAt ?? eqQ.data?.cachedAt ?? null) : (parqueQ.data?.atualizadoEm ?? null);
    return frescorParque(iso, Date.now());
  }, [escolha.fonte, eqQ.data, parqueQ.data?.atualizadoEm]);
  const semValor = useMemo(() => equipamentosSemValor(dataOf(eqQ.data) ?? []), [eqQ.data]);

  const contratos = useMemo(() => contratosQ.data ?? [], [contratosQ.data]);
  const avulsosDisponiveis = !osError && !medical.error;
  const year = range.months[0]?.year ?? hoje.getFullYear();
  const mesAtual = year === hoje.getFullYear() ? hoje.getMonth() : 11;

  const ind = useMemo(
    () =>
      buildCustoParqueAno({
        year,
        months: range.months,
        contratos,
        gastoMonths: gasto.months,
        valorParque: efetivo.valor,
        valorParqueDoMes:
          parqueQ.data?.regra === "mensal"
            ? (c: string) => valorParqueDoMes("mensal", efetivo.valor, parqueQ.data?.mensal ?? [], c)
            : undefined,
        avulsosDisponiveis,
        mesAtual,
      }),
    [year, range.months, contratos, gasto.months, efetivo.valor, avulsosDisponiveis, mesAtual, parqueQ.data?.regra, parqueQ.data?.mensal],
  );
  const contratosErro = Boolean(contratosQ.error || contratosQ.isError);
  const faltandoExtra = useMemo(() => (contratosErro ? ["cadastro de contratos indisponível"] : []), [contratosErro]);
  const estado = estadoCustoParque(ind, faltandoExtra);
  const loading = osLoading || medical.loading || contratosQ.isLoading || parqueQ.isLoading || eqQ.isLoading;
  /** falha de leitura (API/cadastro) — distinto de "sem dados" (ex.: parque não cadastrado) */
  const erroLeitura = osError || medical.error || contratosQ.isError || eqQ.isError ? "Não foi possível atualizar" : null;

  return { range, bruta, apiResumo, escolha, frescor, semValor, osResult, medical, eqQ, gasto, contratos, year, mesAtual, ind, faltandoExtra, ...estado, loading, erroLeitura };
}
