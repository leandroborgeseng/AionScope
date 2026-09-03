"use client";

import { useMemo } from "react";
import { GastoReparoCard } from "@/components/indicadores/gasto-reparo-card";
import { OsVolumeCard } from "@/components/indicadores/os-volume-card";
import { PageHeader } from "@/components/shell/page-header";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import { nowInSaoPaulo } from "@/lib/pbi/dates";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, rollingYearRange } from "@/lib/pbi/volume-ec";

export default function HomePage() {
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
  const osError = errorOf(osQ.data)?.message ?? null;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Visão geral"
        description={`Intervalo rolante ${range.label}. Dois indicadores no mesmo padrão: volume da oficina e gasto com reparo de equipamentos médicos.`}
      />
      <OsVolumeCard range={range} raw={raw} bruta={bruta} loading={osQ.isLoading} error={osError} />
      <GastoReparoCard range={range} raw={raw} bruta={bruta} loading={osQ.isLoading} error={osError} />
    </div>
  );
}
