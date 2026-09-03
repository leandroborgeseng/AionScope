"use client";

import { SlaCorretivaCriticidadeCard } from "@/components/indicadores/sla-corretiva-criticidade-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";

export default function SlaCorretivaCriticidadePage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear();

  return (
    <SlaCorretivaCriticidadeCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
    />
  );
}
