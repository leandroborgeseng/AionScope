"use client";

import { MotivosCorretivasCard } from "@/components/qmentum/motivos-corretivas-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";

export default function MotivosCorretivasPage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear();

  return (
    <MotivosCorretivasCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
    />
  );
}
