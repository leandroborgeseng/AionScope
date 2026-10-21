"use client";

import { useMemo } from "react";
import { usePbiQuery } from "@/hooks/use-pbi";
import { queryErrorMessage } from "@/lib/pbi/query-error";
import { startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { buildEquipamentoIndex } from "@/lib/pbi/indicadores-os";
import { buildMedicalIndex } from "@/lib/pbi/medical";
import type { DashboardFilters } from "@/lib/pbi/filters";
import type { EquipamentoItem } from "@/lib/pbi/types";

const LOOKUP_FILTERS: DashboardFilters = {
  from: startOfMonthISO(),
  to: todayISO(),
  empresas: [],
  empresaIds: [],
  setores: [],
  oficinas: [],
  criticidades: [],
  fabricantes: [],
  modelos: [],
  tipoManutencao: "Todos",
  somenteMedicos: false,
};

export function useMedicalIndex() {
  const query = usePbiQuery<EquipamentoItem[]>("equipamentos", LOOKUP_FILTERS, {
    apenasAtivos: "false",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "false",
  });

  const items = query.data?.ok ? query.data.data : [];
  const index = useMemo(() => buildMedicalIndex(items), [items]);
  const equipamentoIndex = useMemo(() => buildEquipamentoIndex(items), [items]);

  return {
    ...index,
    items,
    equipamentoIndex,
    loading: query.isLoading,
    ready: Boolean(query.data?.ok),
    error: queryErrorMessage(query.data, query.error, "cadastro de equipamentos indisponível"),
  };
}
