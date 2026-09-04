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
  fonteEfetiva: ParqueFonte | "env" | null;
  valorEfetivoManual: number | null;
  fonteManual: "manual" | "env" | null;
  databasePath?: string;
  resumoApi?: {
    nTotal: number;
    nMedicos: number;
    substituicaoTodos: number;
    substituicaoMedicos: number;
  };
};

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
  });
}

export function useSaveParqueMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { valorSubstituicaoManual: number | null; atualizadoPor?: string }) => {
      const res = await fetch("/api/cadastros/parque", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; data?: ParqueResponse; message?: string };
      if (!json.ok || !json.data) throw new Error(json.message ?? "Falha ao salvar.");
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cadastros", "parque"] });
    },
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
