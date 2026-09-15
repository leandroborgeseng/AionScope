"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OsVolumeCard } from "@/components/indicadores/os-volume-card";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import type { FichaIndicadorId } from "@/lib/pbi/fichas";
import {
  oficinasPlanoCanonicalHref,
  parseOficinaPlanoFilterKey,
  resolveOficinaPlanoVolumeOptions,
  type OficinaPlanoFilterKey,
} from "@/lib/pbi/volume-ec";

function OficinasPlanoAbertasFechadasContent() {
  const { range, raw, bruta, loading, error } = useOsAnaliticoRollingYear("calendarYear");
  const searchParams = useSearchParams();
  const router = useRouter();

  const filterKey = parseOficinaPlanoFilterKey(searchParams.get("oficina"));
  const resolved = useMemo(() => resolveOficinaPlanoVolumeOptions(filterKey), [filterKey]);
  const year = range.start.getFullYear();
  const title = `${resolved.titulo} · ano vigente (${year})`;

  const onOficinaFilterChange = useCallback(
    (key: OficinaPlanoFilterKey) => {
      router.replace(oficinasPlanoCanonicalHref(key), { scroll: false });
    },
    [router],
  );

  return (
    <OsVolumeCard
      headingAs="page"
      range={range}
      raw={raw}
      bruta={bruta}
      loading={loading}
      error={error}
      oficinaEquals={resolved.oficinaEquals}
      oficinaEqualsIn={resolved.oficinaEqualsIn}
      oficinaLabel={resolved.oficinaLabel}
      title={title}
      fichaId={resolved.fichaSlug as FichaIndicadorId}
      oficinaFilterKey={filterKey}
      onOficinaFilterChange={onOficinaFilterChange}
    />
  );
}

export default function OficinasPlanoAbertasFechadasPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-slate-100" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      }
    >
      <OficinasPlanoAbertasFechadasContent />
    </Suspense>
  );
}
