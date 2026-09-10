"use client";

import { SlaCriticidadeCard } from "@/components/indicadores/sla-criticidade-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";

export default function SlaCriticidadePage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear();

  return (
    <SlaCriticidadeCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
    />
  );
}
