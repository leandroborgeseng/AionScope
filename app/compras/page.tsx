"use client";

import { useMemo } from "react";
import { ComprasBoard } from "@/components/compras/compras-board";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { buildComprasSnapshot } from "@/lib/pbi/compras";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, rollingYearRange } from "@/lib/pbi/volume-ec";

export default function ComprasPage() {
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
  const snapshot = useMemo(() => buildComprasSnapshot(raw, today), [raw, today]);
  const error = errorOf(osQ.data)?.message ?? null;

  return <ComprasBoard snapshot={osQ.isLoading ? null : snapshot} loading={osQ.isLoading} error={error} />;
}
