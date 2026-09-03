"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { TipoManutencaoFiltro } from "@/lib/pbi/catalog";
import { startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { fromCsv, type DashboardFilters } from "@/lib/pbi/filters";

function parseTipo(value: string | null): TipoManutencaoFiltro {
  if (value === "ApenasPreventiva" || value === "ApenasCorretiva" || value === "Todos") return value;
  return "Todos";
}

export function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: DashboardFilters = useMemo(
    () => ({
      from: searchParams.get("from") || startOfMonthISO(),
      to: searchParams.get("to") || todayISO(),
      empresas: fromCsv(searchParams.get("empresas")),
      empresaIds: fromCsv(searchParams.get("empresaIds")),
      setores: fromCsv(searchParams.get("setores")),
      oficinas: fromCsv(searchParams.get("oficinas")),
      criticidades: fromCsv(searchParams.get("criticidades")),
      fabricantes: fromCsv(searchParams.get("fabricantes")),
      modelos: fromCsv(searchParams.get("modelos")),
      tipoManutencao: parseTipo(searchParams.get("tipo")),
      somenteMedicos: searchParams.get("medicos") !== "0",
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<DashboardFilters>) => {
      const next = { ...filters, ...patch };
      const params = new URLSearchParams();
      params.set("from", next.from);
      params.set("to", next.to);
      if (next.tipoManutencao !== "Todos") params.set("tipo", next.tipoManutencao);
      if (!next.somenteMedicos) params.set("medicos", "0");
      const map: Array<[string, string[]]> = [
        ["empresas", next.empresas],
        ["empresaIds", next.empresaIds],
        ["setores", next.setores],
        ["oficinas", next.oficinas],
        ["criticidades", next.criticidades],
        ["fabricantes", next.fabricantes],
        ["modelos", next.modelos],
      ];
      for (const [key, values] of map) {
        if (values.length) params.set(key, values.join(","));
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [filters, pathname, router],
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return { filters, setFilters, clearFilters };
}
