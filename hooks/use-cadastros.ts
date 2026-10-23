"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Contrato,
  ContratoInput,
  ParqueFonte,
  ParqueMeta,
} from "@/lib/cadastros/types";

type ParqueResponse = ParqueMeta & {
  valorEfetivo: number | null;
  fonteEfetiva: ParqueFonte | null;
  valorEfetivoManual: number | null;
  fonteManual: null;
  mensal?: Array<{ competencia: string; valor: number; itensComValor: number; itensTotal: number; atualizadoEm: string }>;
  regra?: "unico" | "mensal";
  historico?: Array<{ registradoEm: string; origem: string; valorAnterior: number | null; valorNovo: number; itensComValor: number; itensTotal: number }>;
  resumoApi?: {
    nTotal: number;
    nMedicos: number;
    substituicaoTodos: number;
    substituicaoMedicos: number;
  };
};

/** Sem sessão de admin (401) não adianta repetir: a tela mostra "Entre para ver…" na hora. */
function semRetrySemSessao(falhas: number, erro: unknown) {
  if (erro instanceof Error && /administrador/i.test(erro.message)) return false;
  return falhas < 3;
}

async function getJson<T>(url: string): Promise<{ ok: boolean; data?: T; message?: string }> {
  const res = await fetch(url);
  return (await res.json()) as { ok: boolean; data?: T; message?: string };
}

export function useParqueMeta() {
  return useQuery({
    queryKey: ["cadastros", "parque"],
    queryFn: async () => {
      const json = await getJson<ParqueResponse>("/api/cadastros/parque");
      if (!json.ok || !json.data) throw new Error(json.message ?? "Falha ao carregar parque.");
      return json.data;
    },
    staleTime: 30_000,
    retry: semRetrySemSessao,
  });
}

export function useRefreshParqueApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: { atualizadoPor?: string }) => {
      const res = await fetch("/api/cadastros/parque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = (await res.json()) as { ok: boolean; data?: ParqueResponse; message?: string };
      if (!json.ok || !json.data) throw new Error(json.message ?? "Falha ao atualizar da API.");
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cadastros", "parque"] });
    },
  });
}

export function useContratos() {
  return useQuery({
    queryKey: ["cadastros", "contratos"],
    retry: semRetrySemSessao,
    queryFn: async () => {
      const json = await getJson<Contrato[]>("/api/cadastros/contratos");
      if (!json.ok || !json.data) throw new Error(json.message ?? "Falha ao carregar contratos.");
      return json.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ContratoInput) => {
      const res = await fetch("/api/cadastros/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; data?: Contrato; message?: string };
      if (!json.ok || !json.data) throw new Error(json.message ?? "Falha ao criar.");
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cadastros", "contratos"] });
    },
  });
}

export function useUpdateContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ContratoInput & { id: string }) => {
      const res = await fetch(`/api/cadastros/contratos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; data?: Contrato; message?: string };
      if (!json.ok || !json.data) throw new Error(json.message ?? "Falha ao atualizar.");
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cadastros", "contratos"] });
    },
  });
}

export function useDeleteContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cadastros/contratos/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) throw new Error(json.message ?? "Falha ao excluir.");
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cadastros", "contratos"] });
    },
  });
}
