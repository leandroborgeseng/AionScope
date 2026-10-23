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
  return { logado: Boolean(q.data?.autenticado), carregando: q.isLoading, recarregar: q.refetch };
}
