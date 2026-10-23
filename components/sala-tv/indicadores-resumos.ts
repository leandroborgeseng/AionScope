"use client";

/**
 * Liga o `id` do catálogo (lib/indicadores/catalog.ts) ao hook que produz o resumo do card.
 * Indicador novo: uma linha aqui + uma entrada no catálogo; a tela da Sala não muda (I5).
 * A Sala/TV não tem login: lê só rotas de resumo calculadas no servidor, sem R$ (D1).
 */
import { useQuery } from "@tanstack/react-query";
import type { ResumoIndicador } from "@/lib/indicadores/resumo";

export type UsoResumo = () => { resumo: ResumoIndicador | null; carregando: boolean; erro: string | null };

function useResumoServidor(url: string): ReturnType<UsoResumo> {
  const q = useQuery({
    queryKey: ["sala-indicador", url],
    queryFn: async () => {
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; data?: ResumoIndicador; erro?: string | null; message?: string };
      if (!r.ok || !j.ok || !j.data) throw new Error(j.message ?? `HTTP ${r.status}`);
      return j;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  return {
    resumo: q.data?.data ?? null,
    carregando: q.isLoading,
    erro: q.isError ? "Não foi possível atualizar" : (q.data?.erro ?? null),
  };
}

function useResumoCustoParque() {
  return useResumoServidor("/api/indicadores/custo-manutencao-parque/resumo");
}

export const RESUMOS_INDICADORES: Record<string, UsoResumo> = {
  "custo-manutencao-parque": useResumoCustoParque,
};
