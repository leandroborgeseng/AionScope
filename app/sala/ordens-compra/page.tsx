"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CATEGORIA_ORDEM, type OrdemCompra } from "@/lib/ordens-compra/types";

type Pacote = {
  itens: OrdemCompra[];
  page: number;
  page_size: number;
  total: number;
};

type Filtros = {
  categoria: string;
  fornecedor: string;
  mes: string;
  os: string;
  sem_valor: boolean;
};

const FILTROS_VAZIOS: Filtros = {
  categoria: "",
  fornecedor: "",
  mes: "",
  os: "",
  sem_valor: false,
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

function rotuloStatus(status: string | null) {
  if (status === "solicitado") return "Solicitado";
  if (status === "ordem_gerada") return "Ordem gerada";
  if (status === "cancelado") return "Cancelado";
  return status || "—";
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
  if (filtros.os) q.set("os", filtros.os);
  if (filtros.sem_valor) q.set("sem_valor", "1");
  q.set("page", String(page));
  q.set("page_size", "50");
  return q.toString();
}

export default function SalaOrdensCompraPage() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VAZIOS);
  const [page, setPage] = useState(1);
  const [dados, setDados] = useState<Pacote | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(async (f: Filtros, p: number) => {
    const resposta = await fetch(`/api/sala/ordens-compra?${montarQuery(f, p)}`, { cache: "no-store" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    setDados((await resposta.json()) as Pacote);
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

  async function salvarCategoria(numero: string, categoria: string) {
    setSalvando(numero);
    setErro(null);
    setOk(null);
    try {
      const resposta = await fetch("/api/sala/ordens-compra", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero_ordem: numero, categoria }),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
        throw new Error(corpo.erro || `HTTP ${resposta.status}`);
      }
      setOk(`Categoria da OC ${numero} atualizada. O robô não vai sobrescrever este campo.`);
      await carregar(aplicados, page);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "falha ao salvar");
    } finally {
      setSalvando(null);
    }
  }

  const totalPaginas = useMemo(() => {
    if (!dados) return 1;
    return Math.max(1, Math.ceil(dados.total / dados.page_size));
  }, [dados]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ordens de compra"
        description="Ordens formais extraídas pelo robô E-Mails Compras (leandro.borges@aion.eng.br). Complementa o funil de pedidos/SC em Pedidos — não o substitui."
      />

      <p className="text-sm text-aion-muted">
        Pedidos enviados para compras (e-mail → SC → entrega) continuam em{" "}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={aplicar}>
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
              <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">OS</span>
              <Input
                value={filtros.os}
                onChange={(e) => setFiltros((f) => ({ ...f, os: e.target.value }))}
                placeholder="número da OS"
              />
            </label>
            <label className="flex items-end gap-2 pb-1 text-sm">
              <input
                type="checkbox"
                checked={filtros.sem_valor}
                onChange={(e) => setFiltros((f) => ({ ...f, sem_valor: e.target.checked }))}
              />
              <span>Sem valor</span>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
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
        <CardContent className="space-y-3">
          {!dados ? <p className="text-sm text-aion-muted">Carregando…</p> : null}
          {dados && dados.itens.length === 0 ? (
            <p className="text-sm text-aion-muted">Nenhuma ordem com esses filtros.</p>
          ) : null}
          {dados?.itens.map((ordem) => {
            const abertaAgora = aberta === ordem.numero_ordem;
            const categoriaManual = Boolean(ordem.editado_manualmente.categoria);
            return (
              <div key={ordem.numero_ordem} className="border-b border-aion-line pb-3 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <strong className="font-mono">{ordem.numero_ordem}</strong>
                      <span className="rounded bg-aion-mist px-2 py-0.5 text-xs font-semibold text-aion-blue">
                        {rotuloStatus(ordem.status)}
                      </span>
                      {ordem.confianca ? (
                        <Badge tone={ordem.confianca === "baixa" ? "warn" : "info"}>{ordem.confianca}</Badge>
                      ) : null}
                      {categoriaManual ? <Badge tone="ok">categoria manual</Badge> : null}
                    </div>
                    <p className="text-sm text-aion-ink">
                      {ordem.fornecedor || "sem fornecedor"} · {formatarValor(ordem.valor_total)}
                    </p>
                    <p className="text-xs text-aion-muted">
                      Pedido {formatarQuando(ordem.data_pedido)} · Ordem {formatarQuando(ordem.data_ordem)} · OS{" "}
                      {ordem.numero_os || "—"} · {rotuloOrigem(ordem.origem)}
                    </p>
                  </div>
                  <div className="flex min-w-[220px] flex-col gap-1">
                    <span className="text-xs font-semibold tracking-wide text-aion-muted uppercase">
                      Categoria
                    </span>
                    <select
                      className="h-9 rounded-lg border border-aion-line bg-white px-3 text-sm"
                      value={ordem.categoria ?? ""}
                      disabled={salvando === ordem.numero_ordem}
                      onChange={(e) => {
                        const valor = e.target.value;
                        if (!valor) return;
                        void salvarCategoria(ordem.numero_ordem, valor);
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
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-aion-blue hover:underline"
                  onClick={() => setAberta(abertaAgora ? null : ordem.numero_ordem)}
                >
                  {abertaAgora ? "Ocultar itens" : `Itens (${ordem.itens.length})`}
                </button>
                {abertaAgora ? (
                  <ul className="mt-2 space-y-1 text-sm">
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
                    {ordem.assunto_email ? (
                      <li className="text-xs text-aion-muted">E-mail: {ordem.assunto_email}</li>
                    ) : null}
                    {ordem.observacoes ? (
                      <li className="text-xs text-aion-muted">Obs.: {ordem.observacoes}</li>
                    ) : null}
                  </ul>
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
