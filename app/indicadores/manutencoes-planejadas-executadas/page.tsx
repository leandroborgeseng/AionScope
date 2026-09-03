"use client";

import { ManutencoesPlanejadasCard } from "@/components/indicadores/manutencoes-planejadas-card";
import { useManutencoesPlanejadas } from "@/hooks/use-manutencoes-planejadas";

export default function ManutencoesPlanejadasExecutadasPage() {
  const { range, cronograma, os, brutaOs, brutaCronograma, loading, error } = useManutencoesPlanejadas();

  return (
    <ManutencoesPlanejadasCard
      headingAs="page"
      range={range}
      cronograma={cronograma}
      os={os}
      brutaOs={brutaOs}
      brutaCronograma={brutaCronograma}
      loading={loading}
      error={error}
    />
  );
}
