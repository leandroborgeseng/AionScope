"use client";

import { useMemo } from "react";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { nowInSaoPaulo, toApiDateTime } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import type { CronogramaItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, rollingYearRange } from "@/lib/pbi/volume-ec";

/** Cronograma PBI + OS analítica no intervalo rolante de 1 ano. */
export function useManutencoesPlanejadas() {
  const today = useMemo(() => nowInSaoPaulo(), []);
  const range = useMemo(() => rollingYearRange(today), [today]);

  const filters: DashboardFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      from: range.fromISO,
      to: range.toISO,
      tipoManutencao: VOLUME_EC_TIPO_API,
      somenteMedicos: false,
    }),
    [range.fromISO, range.toISO],
  );

  const cronogramaQ = usePbiQuery<CronogramaItem[]>("cronograma", filters, {
    dataInicio: toApiDateTime(range.fromISO),
    dataFim: toApiDateTime(range.toISO, true),
  });

  const osQ = usePbiQuery<OsAnaliticoItem[]>("os-analitico", filters, {
    periodo: VOLUME_EC_PERIODO_API,
    qtdPorPagina: "100000",
  });

  const cronograma = dataOf(cronogramaQ.data) ?? [];
  const os = dataOf(osQ.data) ?? [];
  const brutaOs = osQ.data?.ok ? (osQ.data.total ?? os.length) : os.length;
  const brutaCronograma = cronogramaQ.data?.ok
    ? (cronogramaQ.data.total ?? cronograma.length)
    : cronograma.length;

  const error =
    errorOf(cronogramaQ.data)?.message ?? errorOf(osQ.data)?.message ?? null;

  return {
    range,
    cronograma,
    os,
    brutaOs,
    brutaCronograma,
    loading: cronogramaQ.isLoading || osQ.isLoading,
    error,
  };
}
