"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OsVinculoField } from "@/components/sala/os-vinculo-field";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CATEGORIA_ORDEM, type OrdemAnexo, type OrdemCompra } from "@/lib/ordens-compra/types";

type Pacote = {
  itens: OrdemCompra[];
  page: number;
  page_size: number;
  total: number;
};

type AbaLista = "abertas" | "excluidas" | "duplicadas" | "todas";

type Filtros = {
  categoria: string;
  fornecedor: string;
  mes: string;
  data_pedido_de: string;
  data_pedido_ate: string;
  os: string;
  sem_valor: boolean;
  aba: AbaLista;
  ordenar: "padrao" | "data_pedido";
};

const FILTROS_VAZIOS: Filtros = {
  categoria: "",
  fornecedor: "",
  mes: "",
  data_pedido_de: "",
  data_pedido_ate: "",
  os: "",
  sem_valor: false,
  aba: "abertas",
  ordenar: "data_pedido",
};

function formatarQuando(valor: string | null) {
  if (!valor) return "—";
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(soData ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("pt-BR");
}

function formatarValor(valor: string | null) {
  if (valor == null || valor === "") return "—";
  const n = Number(valor);
  if (!Number.isFinite(n)) return valor;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function idadeDias(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(soData ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function rotuloStatus(status: string | null) {
  if (status === "solicitado") return "Solicitado";
  if (status === "ordem_gerada") return "Ordem gerada";
  if (status === "cancelado") return "Cancelado";
  if (status === "fora_escopo") return "Fora do escopo";
  if (status === "duplicada") return "Duplicada";
  return status || "—";
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** JPEG/PNG/WebP — browsers render these in <img>; HEIC/HEIF open via link. */
function ehPreviewImagem(contentType: string) {
  return (
    contentType === "image/jpeg" ||
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/jpg"
  );
}

function ehPdfAnexo(contentType: string) {
  return contentType === "application/pdf";
}

function ehHeicAnexo(contentType: string) {
  return contentType === "image/heic" || contentType === "image/heif";
}

function rotuloOrigem(origem: string | null) {
  if (origem === "manutencao_sjh") return "Manutenção SJH";
  if (origem === "oficina_aion_cc") return "Oficina Aion CC";
  if (origem === "tramite_interno") return "Trâmite interno";
  return origem || "—";
}

function montarQuery(filtros: Filtros, page: number) {
  const q = new URLSearchParams();
  if (filtros.categoria) q.set("categoria", filtros.categoria);
  if (filtros.fornecedor) q.set("fornecedor", filtros.fornecedor);
  if (filtros.mes) q.set("mes", filtros.mes);
  if (filtros.data_pedido_de) q.set("data_pedido_de", filtros.data_pedido_de);
  if (filtros.data_pedido_ate) q.set("data_pedido_ate", filtros.data_pedido_ate);
  if (filtros.os) q.set("os", filtros.os);
  if (filtros.sem_valor) q.set("sem_valor", "1");
  if (filtros.aba === "abertas") q.set("abertas", "1");
  if (filtros.aba === "excluidas") q.set("excluidas", "1");
  if (filtros.aba === "duplicadas") q.set("duplicadas", "1");
  if (filtros.ordenar) q.set("ordenar", filtros.ordenar);
  q.set("page", String(page));
  q.set("page_size", "50");
  return q.toString();
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Pistas leves de possível duplicata na página carregada. */
function dicasDuplicata(itens: OrdemCompra[]): Map<string, string> {
  const mapa = new Map<string, string>();
  const porOrc = new Map<string, string[]>();
  const porMsg = new Map<string, string[]>();
  const porChave = new Map<string, string[]>();

  for (const o of itens) {
    if (o.numero_orcamento?.trim()) {
      const k = o.numero_orcamento.trim().toLowerCase();
      porOrc.set(k, [...(porOrc.get(k) ?? []), o.numero_ordem]);
    }
    if (o.email_message_id?.trim()) {
      const k = o.email_message_id.trim().toLowerCase();
      porMsg.set(k, [...(porMsg.get(k) ?? []), o.numero_ordem]);
    }
    const forn = (o.fornecedor ?? "").trim().toLowerCase();
    const valor = (o.valor_total ?? "").trim();
    const dia = (o.data_pedido ?? "").slice(0, 10);
    if (forn && valor && dia) {
      const k = `${forn}|${valor}|${dia}`;
      porChave.set(k, [...(porChave.get(k) ?? []), o.numero_ordem]);
    }
  }

  const marcar = (grupos: Map<string, string[]>, motivo: string) => {
    for (const nums of grupos.values()) {
      if (nums.length < 2) continue;
      for (const n of nums) {
        const outros = nums.filter((x) => x !== n).join(", ");
        const prev = mapa.get(n);
        mapa.set(n, prev ? `${prev}; ${motivo} (${outros})` : `${motivo} (${outros})`);
      }
    }
  };

  marcar(porOrc, "mesmo nº orçamento");
  marcar(porMsg, "mesmo e-mail");
  marcar(porChave, "mesmo valor+fornecedor+pedido");
  return mapa;
}

const ABAS: { id: AbaLista; rotulo: string }[] = [
  { id: "abertas", rotulo: "Abertas" },
  { id: "excluidas", rotulo: "Excluídas" },
  { id: "duplicadas", rotulo: "Duplicadas" },
  { id: "todas", rotulo: "Todas" },
];

export default function SalaOrdensCompraPage() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VAZIOS);
  const [page, setPage] = useState(1);
  const [dados, setDados] = useState<Pacote | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [draftOs, setDraftOs] = useState<Record<string, string>>({});
  const [draftEntrega, setDraftEntrega] = useState<Record<string, string>>({});
  const [draftItens, setDraftItens] = useState<Record<string, string>>({});
  const [draftMotivo, setDraftMotivo] = useState<Record<string, string>>({});
  const [anexosPorOrdem, setAnexosPorOrdem] = useState<Record<string, OrdemAnexo[]>>({});
  const [carregandoAnexos, setCarregandoAnexos] = useState<string | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState<string | null>(null);

  const carregar = useCallback(async (f: Filtros, p: number) => {
    const resposta = await fetch(`/api/sala/ordens-compra?${montarQuery(f, p)}`, { cache: "no-store" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const pacote = (await resposta.json()) as Pacote;
    setDados(pacote);
    setDraftOs((prev) => {
      const next = { ...prev };
      for (const o of pacote.itens) {
        if (next[o.numero_ordem] === undefined) next[o.numero_ordem] = o.numero_os ?? "";
      }
      return next;
    });
    setDraftEntrega((prev) => {
      const next = { ...prev };
      for (const o of pacote.itens) {
        if (next[o.numero_ordem] === undefined) {
          next[o.numero_ordem] = o.data_entrega?.slice(0, 10) ?? "";
        }
      }
      return next;
    });
    setDraftItens((prev) => {
      const next = { ...prev };
      for (const o of pacote.itens) {
        if (next[o.numero_ordem] === undefined) next[o.numero_ordem] = o.itens_entregues ?? "";
      }
      return next;
    });
    setDraftMotivo((prev) => {
      const next = { ...prev };
      for (const o of pacote.itens) {
        if (next[o.numero_ordem] === undefined) next[o.numero_ordem] = o.motivo_exclusao ?? "";
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void carregar(aplicados, page).catch((falha) =>
      setErro(falha instanceof Error ? falha.message : "falha ao carregar"),
    );
  }, [carregar, aplicados, page]);

  function aplicar(evento: FormEvent) {
    evento.preventDefault();
    setPage(1);
    setAplicados({ ...filtros });
  }

  function trocarAba(aba: AbaLista) {
    const next = { ...filtros, aba };
    setFiltros(next);
    setAplicados(next);
    setPage(1);
  }

  async function patchOrdem(numero: string, corpo: Record<string, unknown>, mensagemOk: string) {
    setSalvando(numero);
    setErro(null);
    setOk(null);
    try {
      const resposta = await fetch("/api/sala/ordens-compra", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero_ordem: numero, ...corpo }),
      });
      if (!resposta.ok) {
        const corpoErro = (await resposta.json().catch(() => ({}))) as { erro?: string };
        throw new Error(corpoErro.erro || `HTTP ${resposta.status}`);
      }
      setOk(mensagemOk);
      await carregar(aplicados, page);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "falha ao salvar");
    } finally {
      setSalvando(null);
    }
  }

  const carregarAnexos = useCallback(async (numero: string) => {
    setCarregandoAnexos(numero);
    try {
      const resposta = await fetch(
        `/api/sala/ordens-compra/${encodeURIComponent(numero)}/anexos`,
        { cache: "no-store" },
      );
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const pacote = (await resposta.json()) as { anexos: OrdemAnexo[] };
      setAnexosPorOrdem((prev) => ({ ...prev, [numero]: pacote.anexos }));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "falha ao carregar anexos");
    } finally {
      setCarregandoAnexos(null);
    }
  }, []);

  useEffect(() => {
    if (!aberta) return;
    if (anexosPorOrdem[aberta]) return;
    void carregarAnexos(aberta);
  }, [aberta, anexosPorOrdem, carregarAnexos]);

  async function enviarAnexo(numero: string, arquivo: File) {
    setEnviandoAnexo(numero);
    setErro(null);
    setOk(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const resposta = await fetch(
        `/api/sala/ordens-compra/${encodeURIComponent(numero)}/anexos`,
        { method: "POST", body: form },
      );
      if (!resposta.ok) {
        const corpoErro = (await resposta.json().catch(() => ({}))) as {
          erro?: string;
          detalhes?: Array<{ mensagem?: string }>;
        };
        const detalhe = corpoErro.detalhes?.[0]?.mensagem;
        throw new Error(detalhe || corpoErro.erro || `HTTP ${resposta.status}`);
      }
      setOk(`Anexo enviado para OC ${numero}.`);
      await carregarAnexos(numero);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "falha no upload");
    } finally {
      setEnviandoAnexo(null);
    }
  }

  async function excluirAnexo(numero: string, id: number) {
    setEnviandoAnexo(numero);
    setErro(null);
    setOk(null);
    try {
      const resposta = await fetch(
        `/api/sala/ordens-compra/${encodeURIComponent(numero)}/anexos/${id}`,
        { method: "DELETE" },
      );
      if (!resposta.ok) {
        const corpoErro = (await resposta.json().catch(() => ({}))) as { erro?: string };
        throw new Error(corpoErro.erro || `HTTP ${resposta.status}`);
      }
      setOk(`Anexo removido da OC ${numero}.`);
      await carregarAnexos(numero);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "falha ao excluir anexo");
    } finally {
      setEnviandoAnexo(null);
    }
  }

  const totalPaginas = useMemo(() => {
    if (!dados) return 1;
    return Math.max(1, Math.ceil(dados.total / dados.page_size));
  }, [dados]);

  const dicas = useMemo(() => dicasDuplicata(dados?.itens ?? []), [dados]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ordens de compra"
        description="OCs do robô E-Mails Compras. Classifique, vincule OS, registre entrega ou marque duplicada / fora do escopo — a TV Compras lista só as abertas."
      />

      <p className="text-sm text-aion-muted">
        Datas iguais à TV: <strong className="font-semibold text-aion-ink">Pedido (e-mail)</strong> ={" "}
        <code className="text-xs">data_pedido</code> ·{" "}
        <strong className="font-semibold text-aion-ink">Resposta / OC</strong> ={" "}
        <code className="text-xs">data_ordem</code>. A TV em{" "}
        <Link href="/sala/compras" className="font-semibold text-aion-blue hover:underline">
          /sala/compras
        </Link>{" "}
        exclui entregues, <code className="text-xs">cancelado</code>, <code className="text-xs">fora_escopo</code> e{" "}
        <code className="text-xs">duplicada</code>. Funil legado em{" "}
        <Link href="/sala/pedidos" className="font-semibold text-aion-blue hover:underline">
          /sala/pedidos
        </Link>
        .
      </p>

      {erro ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>
      ) : null}
      {ok ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ABAS.map((aba) => {
          const ativa = aplicados.aba === aba.id;
          return (
            <button
              key={aba.id}
              type="button"
              className={
                ativa
                  ? "rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-lg border border-aion-line px-4 py-2 text-sm font-semibold text-aion-ink"
              }
              onClick={() => trocarAba(aba.id)}
            >
              {aba.rotulo}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={aplicar}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
                Categoria
              </span>
              <select
                className="h-9 w-full rounded-lg border border-aion-line bg-white px-3 text-sm"
                value={filtros.categoria}
                onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}
              >
                <option value="">Todas</option>
                {CATEGORIA_ORDEM.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
                Fornecedor
              </span>
              <Input
                value={filtros.fornecedor}
                onChange={(e) => setFiltros((f) => ({ ...f, fornecedor: e.target.value }))}
                placeholder="parte do nome"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">Mês</span>
              <Input
                type="month"
                value={filtros.mes}
                onChange={(e) => setFiltros((f) => ({ ...f, mes: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
                Pedido de
              </span>
              <Input
                type="date"
                value={filtros.data_pedido_de}
                onChange={(e) => setFiltros((f) => ({ ...f, data_pedido_de: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
                Pedido até
              </span>
              <Input
                type="date"
                value={filtros.data_pedido_ate}
                onChange={(e) => setFiltros((f) => ({ ...f, data_pedido_ate: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">OS</span>
              <Input
                value={filtros.os}
                onChange={(e) => setFiltros((f) => ({ ...f, os: e.target.value }))}
                placeholder="número da OS"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
                Ordenar
              </span>
              <select
                className="h-9 w-full rounded-lg border border-aion-line bg-white px-3 text-sm"
                value={filtros.ordenar}
                onChange={(e) =>
                  setFiltros((f) => ({
                    ...f,
                    ordenar: e.target.value === "padrao" ? "padrao" : "data_pedido",
                  }))
                }
              >
                <option value="data_pedido">Pedido (e-mail)</option>
                <option value="padrao">Resposta / OC</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-1 text-sm">
              <input
                type="checkbox"
                checked={filtros.sem_valor}
                onChange={(e) => setFiltros((f) => ({ ...f, sem_valor: e.target.checked }))}
              />
              <span>Sem valor</span>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6">
              <button
                type="submit"
                className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white"
              >
                Filtrar
              </button>
              <button
                type="button"
                className="rounded-lg border border-aion-line px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  setFiltros(FILTROS_VAZIOS);
                  setAplicados(FILTROS_VAZIOS);
                  setPage(1);
                }}
              >
                Limpar
              </button>
              <span className="self-center text-xs text-aion-muted">
                {dados ? `${dados.total} ordem(ns)` : ""}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ordens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!dados ? <p className="text-sm text-aion-muted">Carregando…</p> : null}
          {dados && dados.itens.length === 0 ? (
            <p className="text-sm text-aion-muted">Nenhuma ordem com esses filtros.</p>
          ) : null}
          {dados?.itens.map((ordem) => {
            const abertaAgora = aberta === ordem.numero_ordem;
            const flags = ordem.editado_manualmente;
            const busy = salvando === ordem.numero_ordem;
            const entregue = Boolean(ordem.data_entrega?.trim());
            const foraEscopo = ordem.status === "fora_escopo";
            const duplicada = ordem.status === "duplicada";
            const aging = idadeDias(ordem.data_pedido || ordem.data_ordem || ordem.created_at);
            const dica = dicas.get(ordem.numero_ordem);
            return (
              <div key={ordem.numero_ordem} className="rounded-lg border border-aion-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <strong className="font-mono text-base">{ordem.numero_ordem}</strong>
                      <span className="rounded bg-aion-mist px-2 py-0.5 text-xs font-semibold text-aion-blue">
                        {rotuloStatus(ordem.status)}
                      </span>
                      {ordem.categoria ? (
                        <span className="rounded border border-aion-line px-2 py-0.5 text-xs font-semibold">
                          {ordem.categoria}
                        </span>
                      ) : null}
                      {duplicada ? (
                        <Badge tone="warn">duplicada</Badge>
                      ) : foraEscopo ? (
                        <Badge tone="warn">fora da TV</Badge>
                      ) : entregue ? (
                        <Badge tone="ok">entregue</Badge>
                      ) : (
                        <Badge tone="warn">aberta</Badge>
                      )}
                      {ordem.confianca ? (
                        <Badge tone={ordem.confianca === "baixa" ? "warn" : "info"}>{ordem.confianca}</Badge>
                      ) : null}
                      {flags.categoria ? <Badge tone="ok">categoria manual</Badge> : null}
                      {flags.numero_os ? <Badge tone="ok">OS manual</Badge> : null}
                      {flags.data_entrega ? <Badge tone="ok">entrega manual</Badge> : null}
                      {flags.status ? <Badge tone="ok">status manual</Badge> : null}
                    </div>

                    <p className="text-sm text-aion-ink">
                      <span className="font-semibold">{ordem.fornecedor || "sem fornecedor"}</span>
                      {" · "}
                      {formatarValor(ordem.valor_total)}
                      {ordem.numero_os ? (
                        <>
                          {" · "}
                          OS <span className="font-mono">{ordem.numero_os}</span>
                        </>
                      ) : (
                        " · sem OS"
                      )}
                      {aging != null ? ` · ${aging}d` : null}
                    </p>

                    <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <p>
                        <span className="text-xs font-semibold tracking-wide text-aion-muted uppercase">
                          Pedido (e-mail)
                        </span>
                        <br />
                        <span className="font-semibold text-aion-ink">{formatarQuando(ordem.data_pedido)}</span>
                      </p>
                      <p>
                        <span className="text-xs font-semibold tracking-wide text-aion-muted uppercase">
                          Resposta / OC
                        </span>
                        <br />
                        <span className="font-semibold text-aion-ink">{formatarQuando(ordem.data_ordem)}</span>
                      </p>
                      <p>
                        <span className="text-xs font-semibold tracking-wide text-aion-muted uppercase">
                          Entrega
                        </span>
                        <br />
                        <span className="font-semibold text-aion-ink">{formatarQuando(ordem.data_entrega)}</span>
                      </p>
                    </div>

                    <p className="text-xs text-aion-muted">
                      {rotuloOrigem(ordem.origem)}
                      {ordem.solicitante ? ` · Solicitante: ${ordem.solicitante}` : null}
                      {ordem.assunto_email ? ` · Assunto: ${ordem.assunto_email}` : null}
                      {ordem.numero_orcamento ? ` · Orçamento: ${ordem.numero_orcamento}` : null}
                    </p>

                    {dica ? (
                      <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-950">
                        Possível duplicata: {dica}
                      </p>
                    ) : null}

                    {(foraEscopo || duplicada) && ordem.motivo_exclusao ? (
                      <p className="text-xs text-amber-900">Motivo: {ordem.motivo_exclusao}</p>
                    ) : null}
                  </div>
                  <div className="flex min-w-[200px] flex-col gap-1">
                    <span className="text-xs font-semibold tracking-wide text-aion-muted uppercase">
                      Categoria
                    </span>
                    <select
                      className="h-9 rounded-lg border border-aion-line bg-white px-3 text-sm"
                      value={ordem.categoria ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        const valor = e.target.value;
                        if (!valor) return;
                        void patchOrdem(
                          ordem.numero_ordem,
                          { categoria: valor },
                          `Categoria da OC ${ordem.numero_ordem} atualizada.`,
                        );
                      }}
                    >
                      <option value="" disabled>
                        Definir…
                      </option>
                      {CATEGORIA_ORDEM.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <OsVinculoField
                    value={draftOs[ordem.numero_ordem] ?? ""}
                    disabled={busy}
                    onChange={(valor) =>
                      setDraftOs((d) => ({ ...d, [ordem.numero_ordem]: valor }))
                    }
                    onSalvar={() =>
                      void patchOrdem(
                        ordem.numero_ordem,
                        { numero_os: draftOs[ordem.numero_ordem]?.trim() || null },
                        `OS da OC ${ordem.numero_ordem} salva.`,
                      )
                    }
                  />
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
                      Data entrega
                    </span>
                    <Input
                      type="date"
                      value={draftEntrega[ordem.numero_ordem] ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setDraftEntrega((d) => ({ ...d, [ordem.numero_ordem]: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">
                      O que foi entregue
                    </span>
                    <Input
                      value={draftItens[ordem.numero_ordem] ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setDraftItens((d) => ({ ...d, [ordem.numero_ordem]: e.target.value }))
                      }
                      placeholder="ex.: 2 pinças, 1 cabo"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    disabled={busy || foraEscopo || duplicada}
                    onClick={() =>
                      void patchOrdem(
                        ordem.numero_ordem,
                        {
                          marcar_entregue: true,
                          data_entrega: draftEntrega[ordem.numero_ordem]?.trim() || hojeIso(),
                          itens_entregues: draftItens[ordem.numero_ordem]?.trim() || null,
                        },
                        `OC ${ordem.numero_ordem} marcada como entregue — sai da TV.`,
                      )
                    }
                  >
                    Marcar entregue
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-aion-line px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    disabled={busy}
                    onClick={() =>
                      void patchOrdem(
                        ordem.numero_ordem,
                        {
                          data_entrega: draftEntrega[ordem.numero_ordem]?.trim() || null,
                          itens_entregues: draftItens[ordem.numero_ordem]?.trim() || null,
                        },
                        `Entrega da OC ${ordem.numero_ordem} atualizada.`,
                      )
                    }
                  >
                    Salvar entrega
                  </button>
                  {entregue && !foraEscopo && !duplicada ? (
                    <button
                      type="button"
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-40"
                      disabled={busy}
                      onClick={() =>
                        void patchOrdem(
                          ordem.numero_ordem,
                          { data_entrega: null },
                          `OC ${ordem.numero_ordem} reaberta na TV.`,
                        )
                      }
                    >
                      Reabrir (limpar entrega)
                    </button>
                  ) : null}

                  {!foraEscopo && !duplicada ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="h-8 w-[180px] text-xs"
                        value={draftMotivo[ordem.numero_ordem] ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setDraftMotivo((d) => ({ ...d, [ordem.numero_ordem]: e.target.value }))
                        }
                        placeholder="motivo (opcional)"
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-950 disabled:opacity-40"
                        disabled={busy}
                        onClick={() =>
                          void patchOrdem(
                            ordem.numero_ordem,
                            {
                              marcar_duplicada: true,
                              motivo_exclusao: draftMotivo[ordem.numero_ordem]?.trim() || "duplicada",
                            },
                            `OC ${ordem.numero_ordem} marcada como duplicada — sai da TV.`,
                          )
                        }
                      >
                        Duplicada
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-40"
                        disabled={busy}
                        onClick={() =>
                          void patchOrdem(
                            ordem.numero_ordem,
                            {
                              marcar_fora_escopo: true,
                              motivo_exclusao: draftMotivo[ordem.numero_ordem]?.trim() || null,
                            },
                            `OC ${ordem.numero_ordem} fora do escopo — sai da TV.`,
                          )
                        }
                      >
                        Fora do escopo / outro cliente
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-40"
                      disabled={busy}
                      onClick={() =>
                        void patchOrdem(
                          ordem.numero_ordem,
                          { restaurar_tv: true },
                          `OC ${ordem.numero_ordem} restaurada na TV.`,
                        )
                      }
                    >
                      Desfazer (voltar à TV)
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs font-semibold text-aion-blue hover:underline"
                    onClick={() => setAberta(abertaAgora ? null : ordem.numero_ordem)}
                  >
                    {abertaAgora
                      ? "Ocultar detalhes"
                      : `Itens / anexos (${ordem.itens.length})`}
                  </button>
                </div>

                {abertaAgora ? (
                  <div className="mt-2 space-y-3">
                    <ul className="space-y-1 text-sm">
                      {ordem.itens.length === 0 ? (
                        <li className="text-aion-muted">Sem itens extraídos.</li>
                      ) : (
                        ordem.itens.map((item, i) => (
                          <li key={`${ordem.numero_ordem}-${i}`}>
                            {item.quantidade ? `${item.quantidade} ` : ""}
                            {item.unidade ? `${item.unidade} · ` : ""}
                            {item.descricao || "—"}
                            {item.valor_total ? ` · ${formatarValor(item.valor_total)}` : ""}
                          </li>
                        ))
                      )}
                      {ordem.email_message_id ? (
                        <li className="text-xs text-aion-muted">Msg ID: {ordem.email_message_id}</li>
                      ) : null}
                      {ordem.observacoes ? (
                        <li className="text-xs text-aion-muted">Obs.: {ordem.observacoes}</li>
                      ) : null}
                      {ordem.itens_entregues ? (
                        <li className="text-xs text-emerald-800">Entregue: {ordem.itens_entregues}</li>
                      ) : null}
                    </ul>

                    <div className="rounded-lg border border-dashed border-aion-line bg-aion-mist/40 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold tracking-wide text-aion-muted uppercase">
                          Anexos (fotos / PDF)
                        </p>
                        <label className="cursor-pointer rounded-lg border border-aion-line bg-white px-3 py-1.5 text-xs font-semibold">
                          {enviandoAnexo === ordem.numero_ordem ? "Enviando…" : "Enviar anexo"}
                          <input
                            type="file"
                            className="hidden"
                            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                            disabled={busy || enviandoAnexo === ordem.numero_ordem}
                            onChange={(e) => {
                              const arquivo = e.target.files?.[0];
                              e.target.value = "";
                              if (!arquivo) return;
                              void enviarAnexo(ordem.numero_ordem, arquivo);
                            }}
                          />
                        </label>
                      </div>
                      {carregandoAnexos === ordem.numero_ordem && !anexosPorOrdem[ordem.numero_ordem] ? (
                        <p className="text-xs text-aion-muted">Carregando anexos…</p>
                      ) : null}
                      {(anexosPorOrdem[ordem.numero_ordem] ?? []).length === 0 &&
                      carregandoAnexos !== ordem.numero_ordem ? (
                        <p className="text-xs text-aion-muted">
                          Nenhum anexo ainda. Envie foto da solicitação ou PDF para validar no painel.
                        </p>
                      ) : null}
                      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {(anexosPorOrdem[ordem.numero_ordem] ?? []).map((anexo) => {
                          const previewOk = ehPreviewImagem(anexo.content_type);
                          const pdf = ehPdfAnexo(anexo.content_type);
                          const heic = ehHeicAnexo(anexo.content_type);
                          return (
                            <li
                              key={anexo.id}
                              className="flex flex-col overflow-hidden rounded-lg border border-aion-line bg-white shadow-sm"
                            >
                              <a
                                href={anexo.url}
                                target="_blank"
                                rel="noreferrer"
                                title={`Abrir ${anexo.nome_original}`}
                                className="group relative flex aspect-square items-center justify-center bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-aion-blue"
                              >
                                {previewOk ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- blob/API preview URLs
                                  <img
                                    src={anexo.url}
                                    alt={anexo.nome_original}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition group-hover:opacity-90"
                                  />
                                ) : pdf ? (
                                  <div className="flex flex-col items-center gap-1 px-2 text-center">
                                    <svg
                                      viewBox="0 0 48 56"
                                      className="h-14 w-12 text-red-700"
                                      aria-hidden
                                    >
                                      <path
                                        fill="currentColor"
                                        d="M6 0h24l12 12v40a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z"
                                        opacity="0.15"
                                      />
                                      <path
                                        fill="currentColor"
                                        d="M30 0v10a2 2 0 0 0 2 2h10L30 0z"
                                      />
                                      <text
                                        x="24"
                                        y="38"
                                        textAnchor="middle"
                                        fill="currentColor"
                                        fontSize="11"
                                        fontWeight="700"
                                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                                      >
                                        PDF
                                      </text>
                                    </svg>
                                    <span className="line-clamp-2 text-[11px] font-medium text-slate-700">
                                      {anexo.nome_original}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1 px-2 text-center">
                                    <span className="rounded bg-slate-200 px-2 py-1 text-[10px] font-bold tracking-wide text-slate-700 uppercase">
                                      {heic ? "HEIC" : "ARQ"}
                                    </span>
                                    <span className="line-clamp-2 text-[11px] font-medium text-slate-700">
                                      {anexo.nome_original}
                                    </span>
                                  </div>
                                )}
                                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                                  Abrir preview
                                </span>
                              </a>
                              <div className="space-y-1 border-t border-aion-line p-2">
                                <p
                                  className="truncate text-xs font-medium"
                                  title={anexo.nome_original}
                                >
                                  {anexo.nome_original}
                                </p>
                                <p className="truncate text-[10px] text-aion-muted">
                                  {formatarTamanho(anexo.tamanho)} ·{" "}
                                  {anexo.fonte === "email_robot" ? "robô" : "manual"} ·{" "}
                                  {formatarQuando(anexo.created_at)}
                                </p>
                                <div className="flex flex-wrap gap-2 pt-0.5">
                                  <a
                                    href={anexo.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-semibold text-aion-blue hover:underline"
                                  >
                                    Abrir
                                  </a>
                                  <a
                                    href={`${anexo.url}?download=1`}
                                    className="text-[11px] font-semibold text-aion-blue hover:underline"
                                  >
                                    Baixar
                                  </a>
                                  <button
                                    type="button"
                                    className="text-[11px] font-semibold text-red-700 hover:underline disabled:opacity-40"
                                    disabled={enviandoAnexo === ordem.numero_ordem}
                                    onClick={() => void excluirAnexo(ordem.numero_ordem, anexo.id)}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {dados && dados.total > dados.page_size ? (
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="rounded-md border border-aion-line px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span className="self-center text-xs text-aion-muted">
                Página {page} de {totalPaginas}
              </span>
              <button
                type="button"
                className="rounded-md border border-aion-line px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                disabled={page >= totalPaginas}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
