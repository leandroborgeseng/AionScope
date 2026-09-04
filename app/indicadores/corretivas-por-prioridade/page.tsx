"use client";

import { CorretivasPorPrioridadeCard } from "@/components/indicadores/corretivas-por-prioridade-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";

export default function CorretivasPorPrioridadePage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear();

  return (
    <CorretivasPorPrioridadeCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
    />
  );
}
