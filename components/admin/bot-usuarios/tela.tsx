"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessaoAdmin } from "@/hooks/use-sessao-admin";
import { PAPEIS_BOT_PADRAO } from "@/lib/bot/papeis";
import type { AuditoriaCarregada, ResultadoAcao, ResultadoRevelar } from "./painel";
import { PainelBotUsuarios } from "./painel";
import type { ConflitoGrupo, ConviteGrupoTela, EventoAuditoriaTela, PedidoConvite, UsuarioBot } from "@/lib/bot/apresentacao";

class ErroPermissao extends Error {}

async function lerJson(resposta: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await resposta.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mensagemDe(json: Record<string, unknown> | null) {
  return typeof json?.message === "string" ? json.message : "Não foi possível concluir a ação.";
}

export function TelaBotUsuarios() {
  const sessao = useSessaoAdmin();
  const confirmada = !sessao.carregando && sessao.logado;
  const cliente = useQueryClient();

  const lista = useQuery({
    queryKey: ["admin", "bot-usuarios"],
    enabled: confirmada,
    queryFn: async () => {
      const resposta = await fetch("/api/cadastros/bot-usuarios", { cache: "no-store" });
      const json = await lerJson(resposta);
      if (resposta.status === 401) throw new ErroPermissao();
      if (!resposta.ok || !json || json.ok !== true || !Array.isArray(json.data)) throw new Error("carregar");
      return {
        usuarios: json.data as UsuarioBot[],
        papeis: Array.isArray(json.papeis) && json.papeis.length ? (json.papeis as string[]) : [...PAPEIS_BOT_PADRAO],
      };
    },
  });

  const convite = useQuery({
    queryKey: ["admin", "bot-usuarios", "convite"],
    enabled: confirmada,
    queryFn: async () => {
      const resposta = await fetch("/api/cadastros/bot-usuarios/convite", { cache: "no-store" });
      const json = await lerJson(resposta);
      if (resposta.status === 401) throw new ErroPermissao();
      if (!resposta.ok || !json || json.ok !== true || !json.data || typeof json.data !== "object") throw new Error("convite");
      return json.data as ConviteGrupoTela;
    },
  });

  const idsPendentes = (lista.data?.usuarios ?? [])
    .filter((usuario) => usuario.situacao === "pendente")
    .map((usuario) => usuario.id)
    .sort();

  const conflitos = useQuery({
    queryKey: ["admin", "bot-usuarios", "conflitos", idsPendentes],
    enabled: confirmada && lista.isSuccess && idsPendentes.length > 0,
    queryFn: async () => {
      const mapa: Record<string, ConflitoGrupo> = {};
      await Promise.all(
        idsPendentes.map(async (id) => {
          const resposta = await fetch(`/api/cadastros/bot-usuarios/conflitos?id=${encodeURIComponent(id)}`, {
            cache: "no-store",
          });
          const json = await lerJson(resposta);
          const data = json?.data as { pendentes?: ConflitoGrupo["pendentes"]; aprovados?: ConflitoGrupo["aprovados"] } | undefined;
          if (resposta.ok && json?.ok === true && data) {
            mapa[id] = { pendentes: data.pendentes ?? [], aprovados: data.aprovados ?? [] };
          }
        }),
      );
      return mapa;
    },
  });

  const recarregar = useCallback(() => {
    void lista.refetch();
    void convite.refetch();
    void conflitos.refetch();
  }, [lista, convite, conflitos]);

  const onAcao = useCallback(
    async (id: string, corpo: Record<string, string>): Promise<ResultadoAcao> => {
      const resposta = await fetch(`/api/cadastros/bot-usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await lerJson(resposta);
      if (!resposta.ok || json?.ok !== true) return { ok: false, message: mensagemDe(json) };
      await cliente.invalidateQueries({ queryKey: ["admin", "bot-usuarios"] });
      return { ok: true };
    },
    [cliente],
  );

  const onConvite = useCallback(
    async (corpo: PedidoConvite): Promise<ResultadoAcao> => {
      const resposta = await fetch("/api/cadastros/bot-usuarios/convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await lerJson(resposta);
      if (!resposta.ok || json?.ok !== true) return { ok: false, message: mensagemDe(json) };
      await cliente.invalidateQueries({ queryKey: ["admin", "bot-usuarios", "convite"] });
      return { ok: true };
    },
    [cliente],
  );

  const onExcluir = useCallback(
    async (id: string): Promise<ResultadoAcao> => {
      const resposta = await fetch(`/api/cadastros/bot-usuarios/${id}`, { method: "DELETE" });
      const json = await lerJson(resposta);
      if (!resposta.ok || json?.ok !== true) return { ok: false, message: mensagemDe(json) };
      await cliente.invalidateQueries({ queryKey: ["admin", "bot-usuarios"] });
      return { ok: true };
    },
    [cliente],
  );

  const onRevelar = useCallback(async (id: string): Promise<ResultadoRevelar> => {
    const resposta = await fetch(`/api/cadastros/bot-usuarios/${id}/telefone`, { method: "POST" });
    const json = await lerJson(resposta);
    const data = json?.data as { telefone?: unknown } | undefined;
    if (!resposta.ok || json?.ok !== true || typeof data?.telefone !== "string") {
      return { ok: false, message: mensagemDe(json) };
    }
    return { ok: true, telefone: data.telefone };
  }, []);

  const onCarregarAuditoria = useCallback(async (id: string): Promise<AuditoriaCarregada | null> => {
    const resposta = await fetch(`/api/cadastros/bot-usuarios/${id}/auditoria`, { cache: "no-store" });
    const json = await lerJson(resposta);
    if (!resposta.ok || json?.ok !== true || !Array.isArray(json.data)) return null;
    return {
      dias: typeof json.dias === "number" ? json.dias : 90,
      eventos: json.data as EventoAuditoriaTela[],
    };
  }, []);

  const semPermissao = (!sessao.carregando && !sessao.logado) || lista.error instanceof ErroPermissao;
  const fase = semPermissao ? "sem-permissao" : lista.isError ? "erro" : confirmada && lista.isSuccess ? "pronto" : "carregando";

  return (
    <PainelBotUsuarios
      fase={fase}
      usuarios={fase === "pronto" ? (lista.data?.usuarios ?? []) : []}
      papeis={lista.data?.papeis ?? [...PAPEIS_BOT_PADRAO]}
      conflitos={fase === "pronto" ? (conflitos.data ?? {}) : {}}
      onRecarregar={recarregar}
      onAcao={onAcao}
      onRevelar={onRevelar}
      onCarregarAuditoria={onCarregarAuditoria}
      convite={convite.isSuccess ? convite.data : null}
      onConvite={fase === "pronto" && convite.isSuccess ? onConvite : undefined}
      onExcluir={onExcluir}
    />
  );
}
