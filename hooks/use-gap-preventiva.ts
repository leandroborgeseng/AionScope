"use client";

import { useMemo } from "react";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { toApiDateTime } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import {
  buildGapPreventiva,
  gapPreventivaJanelaOperacional,
} from "@/lib/pbi/gap-preventiva";
import type { CronogramaItem, EquipamentoItem } from "@/lib/pbi/types";

/** Parque ativo + cronograma na janela operacional do gap (Preventiva). */
export function useGapPreventiva() {
  const janela = useMemo(() => gapPreventivaJanelaOperacional(), []);

  const filters: DashboardFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      from: janela.from,
      to: janela.to,
      tipoManutencao: "Todos",
      somenteMedicos: false,
    }),
    [janela.from, janela.to],
  );

  const eqQ = usePbiQuery<EquipamentoItem[]>("equipamentos", filters, {
    apenasAtivos: "true",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "false",
  });

  const cronQ = usePbiQuery<CronogramaItem[]>("cronograma", filters, {
    dataInicio: toApiDateTime(janela.from),
    dataFim: toApiDateTime(janela.to, true),
  });

  const equipamentos = dataOf(eqQ.data) ?? [];
  const cronograma = dataOf(cronQ.data) ?? [];

  const dados = useMemo(
    () => buildGapPreventiva(equipamentos, cronograma, janela),
    [equipamentos, cronograma, janela],
  );

  const error = errorOf(eqQ.data)?.message ?? errorOf(cronQ.data)?.message ?? null;

  return {
    janela,
    dados,
    brutaEquipamentos: eqQ.data?.ok ? (eqQ.data.total ?? equipamentos.length) : equipamentos.length,
    brutaCronograma: cronQ.data?.ok ? (cronQ.data.total ?? cronograma.length) : cronograma.length,
    loading: eqQ.isLoading || cronQ.isLoading,
    error,
  };
}
