"use client";

import { OsVolumeCard } from "@/components/indicadores/os-volume-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";

export default function OsAbertasFechadasPage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear("calendarYear");
  const year = range.start.getFullYear();

  return (
    <OsVolumeCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
      title={`OS abertas × fechadas · ano vigente (${year})`}
    />
  );
}
