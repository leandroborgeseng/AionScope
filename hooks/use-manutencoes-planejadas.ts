"use client";

import { useMemo } from "react";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { nowInSaoPaulo, toApiDateTime } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import type { CronogramaItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, rollingYearRange } from "@/lib/pbi/volume-ec";

function isoYmd(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Cronograma PBI + OS analítica no intervalo rolante de 1 ano. */
export function useManutencoesPlanejadas() {
  const today = useMemo(() => nowInSaoPaulo(), []);
  const range = useMemo(() => rollingYearRange(today), [today]);

  // A API filtra por ProximaRealizacao; a Perioridicade ainda gera meses no
  // intervalo a partir de âncoras fora dele — buscamos ±12 meses além do gráfico.
  const cronogramaApiFrom = useMemo(() => {
    const d = new Date(range.start.getFullYear(), range.start.getMonth() - 12, 1);
    return isoYmd(d.getFullYear(), d.getMonth(), 1);
  }, [range.start]);
  const cronogramaApiTo = useMemo(() => {
    const d = new Date(range.end.getFullYear(), range.end.getMonth() + 13, 0);
    return isoYmd(d.getFullYear(), d.getMonth(), d.getDate());
  }, [range.end]);

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
    dataInicio: toApiDateTime(cronogramaApiFrom),
    dataFim: toApiDateTime(cronogramaApiTo, true),
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
