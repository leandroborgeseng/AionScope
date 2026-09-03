"use client";

import { useMemo } from "react";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, rollingYearRange } from "@/lib/pbi/volume-ec";

/** Mesma consulta da antiga home: OS analítica no intervalo rolante de 1 ano. */
export function useOsAnaliticoRollingYear() {
  const today = useMemo(() => nowInSaoPaulo(), []);
  const range = useMemo(() => rollingYearRange(today), [today]);

  const osFilters: DashboardFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      from: range.fromISO,
      to: range.toISO,
      tipoManutencao: VOLUME_EC_TIPO_API,
      somenteMedicos: false,
    }),
    [range.fromISO, range.toISO],
  );

  const osQ = usePbiQuery<OsAnaliticoItem[]>("os-analitico", osFilters, {
    periodo: VOLUME_EC_PERIODO_API,
    qtdPorPagina: "100000",
  });

  const raw = dataOf(osQ.data) ?? [];
  const bruta = osQ.data?.ok ? (osQ.data.total ?? raw.length) : raw.length;
  const error = errorOf(osQ.data)?.message ?? null;

  return { range, raw, bruta, loading: osQ.isLoading, error };
}
