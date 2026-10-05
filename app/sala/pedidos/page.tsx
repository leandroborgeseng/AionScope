"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CompraEmail = {
  id: string;
  direcao: "enviado" | "recebido";
  data: string;
  de: string | null;
  para: string | null;
  assunto: string | null;
  trecho: string | null;
};

type Compra = {
  id: string;
  os: string | null;
  tag: string | null;
  equipamento: string | null;
  item: string | null;
  setor: string | null;
  solicitante_caixa: string | null;
  enviado_em: string | null;
  sc_numero: string | null;
  sc_em: string | null;
  entregue_em: string | null;
  origem_entrega: string | null;
  situacao: string;
  revisado_por: string | null;
  origem: "manual" | "email";
  emails: CompraEmail[];
};

type Pacote = {
  configurado: boolean;
  sync: { ok?: boolean; novos?: number; erros?: string[]; processados?: number } | null;
  compras: Compra[];
};

type Formulario = {
  os: string;
  tag: string;
  equipamento: string;
  item: string;
  setor: string;
  solicitante_caixa: string;
  enviado_em: string;
  sc_numero: string;
  sc_em: string;
  entregue_em: string;
  revisado_por: string;
};

type AbaLista = "abertos" | "todos" | "entregues";

const VAZIO: Formulario = {
  os: "",
  tag: "",
  equipamento: "",
  item: "",
  setor: "",
  solicitante_caixa: "",
  enviado_em: "",
  sc_numero: "",
  sc_em: "",
  entregue_em: "",
  revisado_por: "",
};

function isoParaInput(valor: string | null | undefined) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputParaIso(valor: string) {
  const t = valor.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toISOString();
}

function formatarQuando(valor: string | null) {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Campo({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  name: keyof Formulario;
  value: string;
  onChange: (name: keyof Formulario, value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-aion-ink">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-aion-muted uppercase">{label}</span>
      <Input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(evento) => onChange(name, evento.target.value)}
      />
    </label>
  );
}

function compraParaForm(compra: Compra): Formulario {
  return {
    os: compra.os ?? "",
    tag: compra.tag ?? "",
    equipamento: compra.equipamento ?? "",
    item: compra.item ?? "",
    setor: compra.setor ?? "",
    solicitante_caixa: compra.solicitante_caixa ?? "",
    enviado_em: isoParaInput(compra.enviado_em),
    sc_numero: compra.sc_numero ?? "",
    sc_em: isoParaInput(compra.sc_em),
    entregue_em: isoParaInput(compra.entregue_em),
    revisado_por: compra.revisado_por ?? "",
  };
}

export default function SalaPedidosPage() {
  const [dados, setDados] = useState<Pacote | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [aba, setAba] = useState<AbaLista>("abertos");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [sincronizando, setSincronizando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async (sync = false) => {
    const resposta = await fetch(`/api/sala/compras${sync ? "?sync=1" : ""}`, { cache: "no-store" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    setDados((await resposta.json()) as Pacote);
  }, []);

  useEffect(() => {
    void carregar().catch((falha) => setErro(falha instanceof Error ? falha.message : "falha"));
  }, [carregar]);

  const contagens = useMemo(() => {
    const lista = dados?.compras ?? [];
    return {
      abertos: lista.filter((c) => c.situacao !== "entregue").length,
      entregues: lista.filter((c) => c.situacao === "entregue").length,
      todos: lista.length,
    };
  }, [dados]);

  const compras = useMemo(() => {
    let lista = dados?.compras ?? [];
    if (aba === "abertos") lista = lista.filter((c) => c.situacao !== "entregue");
    if (aba === "entregues") lista = lista.filter((c) => c.situacao === "entregue");
    const q = filtro.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((c) =>
      [c.os, c.tag, c.equipamento, c.item, c.setor, c.sc_numero, c.situacao, c.origem]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(q)),
    );
  }, [dados, filtro, aba]);

  const compraEditando = useMemo(
    () => (editandoId ? (dados?.compras.find((c) => c.id === editandoId) ?? null) : null),
    [dados, editandoId],
  );

  function atualizarCampo(name: keyof Formulario, value: string) {
    setForm((atual) => ({ ...atual, [name]: value }));
  }

  function iniciarNovo() {
    setEditandoId(null);
    setForm(VAZIO);
    setErro(null);
    setOk(null);
  }

  function iniciarEdicao(compra: Compra) {
    setEditandoId(compra.id);
    setForm(compraParaForm(compra));
    setErro(null);
    setOk(null);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setOk(null);
    setSalvando(true);
    try {
      const body = {
        acao: editandoId ? "atualizar" : "criar",
        id: editandoId ?? undefined,
        os: form.os,
        tag: form.tag,
        equipamento: form.equipamento,
        item: form.item,
        setor: form.setor,
        solicitante_caixa: form.solicitante_caixa,
        enviado_em: inputParaIso(form.enviado_em),
        sc_numero: form.sc_numero,
        sc_em: inputParaIso(form.sc_em),
        entregue_em: inputParaIso(form.entregue_em),
        revisado_por: form.revisado_por,
        origem_entrega: form.entregue_em ? "manual" : undefined,
      };
      const resposta = await fetch("/api/sala/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await resposta.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setErro(json.message ?? "Falha ao gravar pedido.");
        return;
      }
      setOk(editandoId ? "Pedido atualizado." : "Pedido criado.");
      setEditandoId(null);
      setForm(VAZIO);
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao gravar.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(id: string) {
    if (!window.confirm("Apagar este pedido e os e-mails vinculados?")) return;
    setErro(null);
    setOk(null);
    const resposta = await fetch("/api/sala/compras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "apagar", id }),
    });
    const json = (await resposta.json()) as { ok: boolean; message?: string };
    if (!json.ok) {
      setErro(json.message ?? "Não foi possível apagar.");
      return;
    }
    if (editandoId === id) iniciarNovo();
    setOk("Pedido apagado.");
    await carregar();
  }

  async function marcarEntregue(compra: Compra) {
    setErro(null);
    setOk(null);
    const resposta = await fetch("/api/sala/compras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "atualizar",
        id: compra.id,
        entregue_em: new Date().toISOString(),
        origem_entrega: "manual",
      }),
    });
    const json = (await resposta.json()) as { ok: boolean; message?: string };
    if (!json.ok) {
      setErro(json.message ?? "Não foi possível marcar entregue.");
      return;
    }
    setOk(`Pedido ${compra.os || compra.id.slice(0, 8)} marcado como entregue.`);
    if (editandoId === compra.id) iniciarNovo();
    await carregar();
  }

  async function sincronizarEmail() {
    setSincronizando(true);
    setErro(null);
    setOk(null);
    try {
      await carregar(true);
      setOk("Sincronização com o Outlook concluída.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha no sync.");
    } finally {
      setSincronizando(false);
    }
  }

  const abas: Array<{ id: AbaLista; label: string; n: number }> = [
    { id: "abertos", label: "Abertos", n: contagens.abertos },
    { id: "entregues", label: "Entregues", n: contagens.entregues },
    { id: "todos", label: "Todos", n: contagens.todos },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos de compra"
        description="Acompanhe pedidos importados do e-mail e ajuste ou cadastre manualmente o que faltar."
      />
      <p className="text-sm text-aion-muted">
        A TV em{" "}
        <Link className="text-aion-blue underline" href="/sala/compras">
          /sala/compras
        </Link>{" "}
        usa estes registros. Origem: e-mail M365 e/ou cadastro manual. Ordens formais do robô (API) ficam em{" "}
        <Link className="text-aion-blue underline" href="/sala/ordens-compra">
          /sala/ordens-compra
        </Link>
        .
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void sincronizarEmail()}
          disabled={sincronizando || !dados?.configurado}
          className="rounded-lg border border-aion-line bg-white px-4 py-2 text-sm font-semibold text-aion-ink disabled:opacity-60"
          title={dados?.configurado ? "Buscar e-mails no Outlook" : "Configure M365 primeiro"}
        >
          {sincronizando ? "Sincronizando…" : "Sincronizar e-mail"}
        </button>
        <button
          type="button"
          onClick={iniciarNovo}
          className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white"
        >
          Novo pedido
        </button>
        <span className="text-sm text-aion-muted">
          M365: {dados?.configurado ? "configurado" : "não configurado"} · {contagens.abertos} aberto(s) ·{" "}
          {contagens.todos} no total
        </span>
      </div>

      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Lista</CardTitle>
              <Input
                className="max-w-xs"
                placeholder="Filtrar OS, item, SC…"
                value={filtro}
                onChange={(evento) => setFiltro(evento.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {abas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAba(item.id)}
                  className={
                    aba === item.id
                      ? "rounded-md bg-aion-blue px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-md border border-aion-line px-3 py-1.5 text-xs font-semibold text-aion-ink hover:bg-aion-mist"
                  }
                >
                  {item.label} ({item.n})
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {compras.length === 0 ? <p className="text-sm text-aion-muted">Nenhum pedido nesta visão.</p> : null}
            {compras.map((compra) => (
              <div
                key={compra.id}
                className={`flex flex-col gap-2 border-b border-aion-line py-3 sm:flex-row sm:items-start sm:justify-between ${
                  editandoId === compra.id ? "bg-aion-mist/40" : ""
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <strong className="font-mono">{compra.os || "sem OS"}</strong>
                    <span className="rounded bg-aion-mist px-2 py-0.5 text-xs font-semibold text-aion-blue">
                      {compra.situacao}
                    </span>
                    <span className="text-xs text-aion-muted uppercase">{compra.origem}</span>
                  </div>
                  <p className="text-sm text-aion-ink">
                    {compra.equipamento || "—"}
                    {compra.item ? ` · ${compra.item}` : ""}
                  </p>
                  <p className="text-xs text-aion-muted">
                    {compra.setor || "—"} · enviado {formatarQuando(compra.enviado_em)}
                    {compra.sc_numero ? ` · SC ${compra.sc_numero}` : ""}
                    {compra.emails.length ? ` · ${compra.emails.length} e-mail(s)` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-aion-line px-3 py-1.5 text-xs font-semibold text-aion-blue hover:bg-aion-mist"
                    onClick={() => iniciarEdicao(compra)}
                  >
                    Editar
                  </button>
                  {compra.situacao !== "entregue" ? (
                    <button
                      type="button"
                      className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                      onClick={() => void marcarEntregue(compra)}
                    >
                      Entregue
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => void apagar(compra.id)}
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div ref={formRef} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{editandoId ? "Editar pedido" : "Novo pedido"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(evento) => void salvar(evento)}>
                <Campo label="OS" name="os" value={form.os} onChange={atualizarCampo} placeholder="123456789" />
                <Campo label="Tag" name="tag" value={form.tag} onChange={atualizarCampo} placeholder="HSJ-00042" />
                <div className="sm:col-span-2">
                  <Campo
                    label="Equipamento"
                    name="equipamento"
                    value={form.equipamento}
                    onChange={atualizarCampo}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Campo label="Item" name="item" value={form.item} onChange={atualizarCampo} />
                </div>
                <Campo label="Setor" name="setor" value={form.setor} onChange={atualizarCampo} />
                <Campo
                  label="Solicitante / caixa"
                  name="solicitante_caixa"
                  value={form.solicitante_caixa}
                  onChange={atualizarCampo}
                  placeholder="nome ou e-mail"
                />
                <Campo
                  label="Enviado em"
                  name="enviado_em"
                  type="datetime-local"
                  value={form.enviado_em}
                  onChange={atualizarCampo}
                />
                <Campo label="SC" name="sc_numero" value={form.sc_numero} onChange={atualizarCampo} />
                <Campo
                  label="SC em"
                  name="sc_em"
                  type="datetime-local"
                  value={form.sc_em}
                  onChange={atualizarCampo}
                />
                <Campo
                  label="Entregue em"
                  name="entregue_em"
                  type="datetime-local"
                  value={form.entregue_em}
                  onChange={atualizarCampo}
                />
                <Campo
                  label="Revisado por"
                  name="revisado_por"
                  value={form.revisado_por}
                  onChange={atualizarCampo}
                />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    className="rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="submit"
                    disabled={salvando}
                  >
                    {salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Criar pedido"}
                  </button>
                  {editandoId ? (
                    <button
                      type="button"
                      className="rounded-lg border border-aion-line px-4 py-2 text-sm font-semibold"
                      onClick={iniciarNovo}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          {compraEditando?.emails.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-mails vinculados · {compraEditando.emails.length}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {compraEditando.emails.map((email) => (
                  <div key={email.id} className="border-b border-aion-line pb-3 text-sm last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-aion-mist px-2 py-0.5 text-xs font-semibold uppercase text-aion-blue">
                        {email.direcao}
                      </span>
                      <span className="text-xs text-aion-muted">{formatarQuando(email.data)}</span>
                    </div>
                    <p className="mt-1 font-medium text-aion-ink">{email.assunto || "(sem assunto)"}</p>
                    <p className="text-xs text-aion-muted">
                      de {email.de || "—"} → {email.para || "—"}
                    </p>
                    {email.trecho ? (
                      <p className="mt-1 line-clamp-3 text-xs text-aion-muted whitespace-pre-wrap">{email.trecho}</p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
