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
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { nowInSaoPaulo, startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { equipamentosSemValor, frescorParque } from "@/lib/pbi/parque-frescor";
import { montarCustoParque } from "@/lib/indicadores/custo-parque-montar";
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

  const contratos = useMemo(() => contratosQ.data ?? [], [contratosQ.data]);
  const contratosErro = Boolean(contratosQ.error || contratosQ.isError);
  const eqItems = useMemo(() => dataOf(eqQ.data) ?? [], [eqQ.data]);
  // Mesma montagem do servidor (lib/indicadores/custo-parque-montar.ts, I3).
  const { ind, faltandoExtra, gasto, apiResumo, escolha, year, mesAtual } = useMemo(
    () =>
      montarCustoParque({
        range,
        hoje,
        os: raw,
        osErro: osError,
        medicalTags: medical.tags,
        medicalIds: medical.ids,
        medicalErro: medical.error,
        equipamentosAtivos: eqItems,
        parqueGravado: parqueQ.data?.valorApi ?? null,
        regra: parqueQ.data?.regra,
        mensal: parqueQ.data?.mensal,
        contratos,
        contratosErro,
      }),
    [range, hoje, raw, osError, medical.tags, medical.ids, medical.error, eqItems, parqueQ.data?.valorApi, parqueQ.data?.regra, parqueQ.data?.mensal, contratos, contratosErro],
  );
  const frescor = useMemo(() => {
    const iso = escolha.fonte === "ao-vivo" ? (eqQ.data?.cache?.fetchedAt ?? eqQ.data?.cachedAt ?? null) : (parqueQ.data?.atualizadoEm ?? null);
    return frescorParque(iso, Date.now());
  }, [escolha.fonte, eqQ.data, parqueQ.data?.atualizadoEm]);
  const semValor = useMemo(() => equipamentosSemValor(eqItems), [eqItems]);
  /** 401 em parque/contratos: sem sessão de admin (UX D1: "Entre para ver os valores do indicador"). */
  const precisaLogin = [parqueQ.error, contratosQ.error].some((e) => e instanceof Error && /senha de administrador|401/i.test(e.message));
  const estado = estadoCustoParque(ind, faltandoExtra);
  const loading = osLoading || medical.loading || contratosQ.isLoading || parqueQ.isLoading || eqQ.isLoading;
  /** falha de leitura (API/cadastro) — distinto de "sem dados" (ex.: parque não cadastrado) */
  const erroLeitura = osError || medical.error || contratosQ.isError || eqQ.isError ? "Não foi possível atualizar" : null;

  return { precisaLogin, range, bruta, apiResumo, escolha, frescor, semValor, osResult, medical, eqQ, gasto, contratos, year, mesAtual, ind, faltandoExtra, ...estado, loading, erroLeitura };
}
