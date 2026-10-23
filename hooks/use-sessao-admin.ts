"use client";

import { useQuery } from "@tanstack/react-query";

/** Estado da sessão de admin (GET /api/cadastros/contratos/sessao). Mesma queryKey do cadastro de contratos. */
export function useSessaoAdmin() {
  const q = useQuery({
    queryKey: ["cadastros", "contratos", "sessao"],
    queryFn: async () => {
      const r = await fetch("/api/cadastros/contratos/sessao", { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; data?: { autenticado: boolean; habilitado: boolean } };
      return j.data ?? { autenticado: false, habilitado: false };
    },
    staleTime: 30_000,
  });
  const carregando = q.isLoading;
  // B3: enquanto carrega, estado neutro — `logado` fica true (não desabilita nem avisa); o servidor continua exigindo sessão (401).
  return { logado: carregando || Boolean(q.data?.autenticado), carregando, recarregar: q.refetch };
}
