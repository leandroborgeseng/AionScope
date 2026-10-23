"use client";

/**
 * Liga o `id` do catálogo (lib/indicadores/catalog.ts) ao hook que produz o resumo do card.
 * Indicador novo: uma linha aqui + uma entrada no catálogo; a tela da Sala não muda (I5).
 */
import { useMemo } from "react";
import { useCustoParque } from "@/hooks/use-custo-parque";
import { resumoCustoParque, type ResumoIndicador } from "@/lib/indicadores/resumo";

export type UsoResumo = () => { resumo: ResumoIndicador | null; carregando: boolean; erro: string | null };

function useResumoCustoParque() {
  const d = useCustoParque();
  const resumo = useMemo(() => (d.loading ? null : resumoCustoParque(d.ind, d.faltandoExtra)), [d.loading, d.ind, d.faltandoExtra]);
  return { resumo, carregando: d.loading, erro: d.erroLeitura };
}

export const RESUMOS_INDICADORES: Record<string, UsoResumo> = {
  "custo-manutencao-parque": useResumoCustoParque,
};
