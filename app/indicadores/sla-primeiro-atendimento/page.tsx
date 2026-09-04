"use client";

import { SlaPrimeiroAtendimentoCard } from "@/components/indicadores/sla-primeiro-atendimento-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";

export default function SlaPrimeiroAtendimentoPage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear();

  return (
    <SlaPrimeiroAtendimentoCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
    />
  );
}
