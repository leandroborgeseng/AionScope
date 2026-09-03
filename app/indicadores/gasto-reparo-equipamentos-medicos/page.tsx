"use client";

import { GastoReparoCard } from "@/components/indicadores/gasto-reparo-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";

export default function GastoReparoEquipamentosMedicosPage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear();

  return (
    <GastoReparoCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
    />
  );
}
