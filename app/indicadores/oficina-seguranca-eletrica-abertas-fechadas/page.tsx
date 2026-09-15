"use client";

import { OsVolumeCard } from "@/components/indicadores/os-volume-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { oficinaVolumePlanoBySlug } from "@/lib/pbi/volume-ec";

const cfg = oficinaVolumePlanoBySlug("oficina-seguranca-eletrica-abertas-fechadas")!;

export default function OficinaSegurancaEletricaAbertasFechadasPage() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear();

  return (
    <OsVolumeCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
      oficinaEquals={cfg.oficinaEquals}
      oficinaLabel={cfg.oficinaLabel}
      title={cfg.titulo}
      fichaId="oficina-seguranca-eletrica-abertas-fechadas"
    />
  );
}
