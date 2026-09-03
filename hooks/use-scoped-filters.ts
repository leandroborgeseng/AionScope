"use client";

import { useMemo } from "react";
import { useFilters } from "@/hooks/use-filters";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import type { DashboardFilters } from "@/lib/pbi/filters";

export function useScopedFilters() {
  const base = useFilters();
  const medical = useMedicalIndex();
  const filters: DashboardFilters = useMemo(
    () => ({
      ...base.filters,
        medicalTags: medical.ready ? medical.tags : undefined,
        medicalIds: medical.ready ? medical.ids : undefined,
    }),
    [base.filters, medical.tags, medical.ids],
  );
  return { ...base, filters, medical };
}
