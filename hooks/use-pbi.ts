"use client";

import { useQuery } from "@tanstack/react-query";
import type { PbiResource } from "@/lib/pbi/catalog";
import { toUpstreamParams, type DashboardFilters } from "@/lib/pbi/filters";
import type { Lookups, PbiResult } from "@/lib/pbi/types";

async function getJson<T>(url: string): Promise<PbiResult<T>> {
  const response = await fetch(url);
  return (await response.json()) as PbiResult<T>;
}

export function usePbiQuery<T>(
  resource: PbiResource,
  filters: DashboardFilters,
  extras?: Record<string, string>,
  enabled = true,
  options?: { refetchInterval?: number | false },
) {
  const params = toUpstreamParams(resource, filters, extras);
  const qs = params.toString();
  return useQuery({
    queryKey: ["pbi", resource, qs],
    queryFn: () => getJson<T>(`/api/pbi/${resource}?${qs}`),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
    refetchInterval: options?.refetchInterval,
  });
}

export function useLookups() {
  return useQuery({
    queryKey: ["pbi", "lookups"],
    queryFn: () => getJson<Lookups>("/api/pbi/lookups"),
    staleTime: 15 * 60_000,
  });
}

export function dataOf<T>(result: PbiResult<T> | undefined): T | undefined {
  return result?.ok ? result.data : undefined;
}

export function errorOf<T>(result: PbiResult<T> | undefined) {
  if (!result || result.ok) return null;
  return result;
}
