"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatDataBR,
  hojeBRT,
  labelTipo,
  situacaoVigencia,
  totaisPorTipo,
  type ErrosCampo,
  validarContrato,
} from "@/lib/cadastros/contratos-proprios";
import type { Contrato } from "@/lib/cadastros/types";
import { formatBRL } from "@/lib/pbi/indicators";

const API = "/api/cadastros/contratos";
const QK = ["cadastros", "contratos"] as const;
const QK_SESSAO = ["cadastros", "contratos", "sessao"] as const;

type Resp<T> = { ok: boolean; data?: T; message?: string; erros?: ErrosCampo };

class ErroApi extends Error {
  constructor(message: string, public status: number, public erros?: ErrosCampo) {
    super(message);
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  let body: Resp<T> = { ok: false };
  try {
    body = (await r.json()) as Resp<T>;
  } catch {
    /* corpo vazio */
  }
  if (!r.ok || !body.ok) throw new ErroApi(body.message ?? `Erro ${r.status}`, r.status, body.erros);
  return body.data as T;
}

type FormState = {
  id?: string;
  fornecedor: string;
  equipamento: string;
  tipo: string;
  numero: string;
  valorMensal: string;
  inicio: string;
  fim: string;
  observacao: string;
};

const VAZIO: FormState = {
  fornecedor: "",
  equipamento: "",
  tipo: "",
  numero: "",
  valorMensal: "",
  inicio: "2026-01-01",
  fim: "2027-01-01",
  observacao: "",
};

function paraForm(c: Contrato): FormState {
  return {
    id: c.id,
    fornecedor: c.fornecedor ?? "",
    equipamento: c.equipamento ?? "",
    tipo: c.tipo ?? "",
    numero: c.numero ?? "",
    valorMensal: c.valorMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    inicio: c.inicio ?? "",
    fim: c.fim ?? "",
    observacao: c.observacao ?? "",
  };
}

const selectCls =
  "h-9 w-full rounded-lg border border-aion-line bg-white px-2.5 text-sm text-aion-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aion-blue/35";

function Campo({
  id,
  label,
  erro,
  children,
  obrigatorio,
}: {
  id: string;
  label: string;
  erro?: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-aion-ink">
        {label}
        {obrigatorio ? <span aria-hidden="true" className="text-rose-700"> *</span> : null}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="text-sm text-rose-700">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function FormContrato({
  inicial,
  onFechar,
}: {
  inicial: FormState;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(inicial);
  const [erros, setErros] = useState<ErrosCampo>({});
  const [msg, setMsg] = useState<string | null>(null);
  const editando = Boolean(inicial.id);

  const salvar = useMutation({
    mutationFn: (dados: FormState) => {
      const { id, ...body } = dados;
      return chamar<Contrato>(id ? `${API}/${id}` : API, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({ ...body, nome: "" }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK });
      onFechar();
    },
    onError: (e: unknown) => {
      const err = e as ErroApi;
      setErros(err.erros ?? {});
      setMsg(err.status === 401 ? "Sua sessão expirou. Entre de novo para salvar." : err.message);
      if (err.status === 401) qc.invalidateQueries({ queryKey: QK_SESSAO });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    // Mesma regra da API (validarContrato): fornecedor, tipo, valor > 0 (0, negativo e vazio rejeitados),
    // início obrigatório e fim >= início.
    const { id: _id, ...dados } = f;
    void _id;
    const v = validarContrato({ ...dados, nome: "", valorMensal: dados.valorMensal as unknown as number });
    setErros(v.ok ? {} : v.erros);
    if (!v.ok) return;
    salvar.mutate(f);
  }

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const aria = (k: keyof ErrosCampo) =>
    erros[k] ? { "aria-invalid": true, "aria-describedby": `ct-${k}-erro` } : {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editando ? "Editar contrato" : "Novo contrato"}</CardTitle>
        <CardDescription>Campos com * são obrigatórios. A data final é inclusiva (horário de Brasília).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Campo id="ct-fornecedor" label="Fornecedor" obrigatorio erro={erros.fornecedor}>
            <Input id="ct-fornecedor" value={f.fornecedor} onChange={set("fornecedor")} {...aria("fornecedor")} />
          </Campo>
          <Campo id="ct-equipamento" label="Equipamento">
            <Input id="ct-equipamento" value={f.equipamento} onChange={set("equipamento")} />
          </Campo>
          <Campo id="ct-tipo" label="Tipo" obrigatorio erro={erros.tipo}>
            <select id="ct-tipo" className={selectCls} value={f.tipo} onChange={set("tipo")} {...aria("tipo")}>
              <option value="">Selecione…</option>
              <option value="MANUTENCAO">Manutenção</option>
              <option value="LOCACAO">Locação</option>
            </select>
          </Campo>
          <Campo id="ct-numero" label="Número do contrato">
            <Input id="ct-numero" value={f.numero} onChange={set("numero")} />
          </Campo>
          <Campo id="ct-valorMensal" label="Valor mensal (R$)" obrigatorio erro={erros.valorMensal}>
            <Input
              id="ct-valorMensal"
              inputMode="decimal"
              placeholder="0,00"
              value={f.valorMensal}
              onChange={set("valorMensal")}
              {...aria("valorMensal")}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="ct-inicio" label="Início" obrigatorio erro={erros.inicio}>
              <Input id="ct-inicio" type="date" value={f.inicio} onChange={set("inicio")} {...aria("inicio")} />
            </Campo>
            <Campo id="ct-fim" label="Fim" erro={erros.fim}>
              <Input id="ct-fim" type="date" value={f.fim} onChange={set("fim")} {...aria("fim")} />
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <Campo id="ct-observacao" label="Observação">
              <textarea
                id="ct-observacao"
                rows={2}
                className={`${selectCls} h-auto py-2`}
                value={f.observacao}
                onChange={set("observacao")}
              />
            </Campo>
          </div>
          {msg ? (
            <p role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {msg}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PainelLogin() {
  const qc = useQueryClient();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const entrar = useMutation({
    mutationFn: () => chamar(`${API}/sessao`, { method: "POST", body: JSON.stringify({ senha }) }),
    onSuccess: () => {
      setSenha("");
      setErro(null);
      qc.invalidateQueries({ queryKey: QK_SESSAO });
    },
    onError: (e: unknown) => setErro((e as Error).message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        entrar.mutate();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="space-y-1">
        <label htmlFor="ct-senha" className="block text-sm font-medium text-aion-ink">
          Senha de administrador
        </label>
        <Input
          id="ct-senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-56"
        />
      </div>
      <Button type="submit" disabled={!senha || entrar.isPending}>
        {entrar.isPending ? "Entrando…" : "Entrar para editar"}
      </Button>
      {erro ? (
        <p role="alert" className="w-full text-sm text-rose-700">
          {erro}
        </p>
      ) : null}
    </form>
  );
}

type FiltroStatus = "ativos" | "inativos" | "todos";

export function ContratosCadastroForm() {
  const qc = useQueryClient();
  const listaQ = useQuery({ queryKey: QK, queryFn: () => chamar<Contrato[]>(API) });
  const sessaoQ = useQuery({
    queryKey: QK_SESSAO,
    queryFn: () => chamar<{ autenticado: boolean; habilitado: boolean }>(`${API}/sessao`),
  });
  const logado = Boolean(sessaoQ.data?.autenticado);

  const [form, setForm] = useState<FormState | null>(null);
  const [tipo, setTipo] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [status, setStatus] = useState<FiltroStatus>("ativos");

  const alternar = useMutation({
    mutationFn: (c: Contrato) =>
      chamar<Contrato>(`${API}/${c.id}`, { method: "PATCH", body: JSON.stringify({ ativo: !c.ativo }) }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: QK_SESSAO });
    },
  });
  const sair = useMutation({
    mutationFn: () => chamar(`${API}/sessao`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: QK_SESSAO }),
  });

  const todos = useMemo(() => listaQ.data ?? [], [listaQ.data]);
  const fornecedores = useMemo(
    () => [...new Set(todos.map((c) => c.fornecedor).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [todos],
  );
  const filtrados = todos.filter(
    (c) =>
      (status === "todos" || (status === "ativos" ? c.ativo : !c.ativo)) &&
      (!tipo || (tipo === "SEM_TIPO" ? !c.tipo : c.tipo === tipo)) &&
      (!fornecedor || c.fornecedor === fornecedor),
  );
  const totais = totaisPorTipo(todos.filter((c) => c.ativo));
  const hoje = hojeBRT();

  const novo = () => setForm({ ...VAZIO });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Cadastro próprio do AionScope (Manutenção e Locação). Valores mensais por contrato."
        actions={
          <Link
            href="/cadastros"
            className="inline-flex h-8 items-center rounded-lg border border-aion-line bg-white px-2.5 text-xs font-medium text-aion-ink hover:border-aion-blue/40 hover:bg-aion-mist"
          >
            Voltar
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-4">
          {logado ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ok">Edição liberada</Badge>
              {!form ? <Button onClick={novo}>Novo contrato</Button> : null}
              <Button variant="ghost" size="sm" onClick={() => sair.mutate()}>
                Sair
              </Button>
            </div>
          ) : sessaoQ.data && !sessaoQ.data.habilitado ? (
            <p className="text-sm text-aion-muted">Edição indisponível neste ambiente (login de administrador não configurado).</p>
          ) : (
            <PainelLogin />
          )}
        </CardContent>
      </Card>

      {form ? <FormContrato key={form.id ?? "novo"} inicial={form} onFechar={() => setForm(null)} /> : null}

      <section aria-label="Totais mensais dos contratos ativos" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["Manutenção", totais.MANUTENCAO],
            ["Locação", totais.LOCACAO],
            ["Total geral", totais.TOTAL],
          ] as const
        ).map(([rotulo, t]) => (
          <Card key={rotulo}>
            <CardContent className="pt-4">
              <p className="text-sm text-aion-muted">{rotulo} (ativos)</p>
              <p className="text-xl font-semibold tabular-nums text-aion-ink">{formatBRL(t.valor)}</p>
              <p className="text-xs text-aion-muted">{t.qtde} contrato(s) · por mês</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {totais.SEM_TIPO.qtde > 0 ? (
        <p className="text-sm text-amber-900">
          {totais.SEM_TIPO.qtde} contrato(s) ativo(s) sem tipo ({formatBRL(totais.SEM_TIPO.valor)}) entram só no total geral.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
            <div>
              <label htmlFor="f-status" className="text-xs font-medium text-aion-muted">Situação</label>
              <select id="f-status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as FiltroStatus)}>
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-tipo" className="text-xs font-medium text-aion-muted">Tipo</label>
              <select id="f-tipo" className={selectCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="MANUTENCAO">Manutenção</option>
                <option value="LOCACAO">Locação</option>
                <option value="SEM_TIPO">Sem tipo</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-fornecedor" className="text-xs font-medium text-aion-muted">Fornecedor</label>
              <select id="f-fornecedor" className={selectCls} value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
                <option value="">Todos</option>
                {fornecedores.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {listaQ.isLoading ? <p className="text-sm text-aion-muted" role="status">Carregando contratos…</p> : null}

          {listaQ.isError ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Não foi possível carregar os contratos. {(listaQ.error as Error).message}{" "}
              <Button variant="outline" size="sm" onClick={() => listaQ.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : null}

          {listaQ.isSuccess && todos.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-aion-line p-4">
              <p className="text-sm text-aion-ink">Nenhum contrato cadastrado</p>
              {!form ? (
                <Button onClick={novo} disabled={!logado} title={logado ? undefined : "Entre com a senha para cadastrar"}>
                  Novo contrato
                </Button>
              ) : null}
              {!logado ? <p className="text-xs text-aion-muted">Entre com a senha de administrador para cadastrar.</p> : null}
            </div>
          ) : null}

          {listaQ.isSuccess && todos.length > 0 && filtrados.length === 0 ? (
            <p className="text-sm text-aion-muted">Nenhum contrato com esses filtros.</p>
          ) : null}

          <ul className="divide-y divide-aion-mist">
            {filtrados.map((c) => {
              const sit = situacaoVigencia(c, hoje);
              return (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-aion-ink">{c.fornecedor ?? c.nome}</p>
                      <Badge tone={c.tipo ? "info" : "warn"}>{labelTipo(c.tipo)}</Badge>
                      <Badge tone={sit === "Vigente" ? "ok" : sit === "Vencido" ? "danger" : "default"}>{sit}</Badge>
                      {!c.ativo ? <Badge tone="default">Inativo</Badge> : null}
                    </div>
                    <p className="text-sm text-aion-ink/80">
                      {[c.equipamento ?? (c.fornecedor ? c.nome : null), c.numero ? `nº ${c.numero}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-sm tabular-nums text-aion-ink">{formatBRL(c.valorMensal)}/mês</p>
                    <p className="text-xs text-aion-muted">
                      Vigência {formatDataBR(c.inicio)} a {formatDataBR(c.fim)}
                    </p>
                  </div>
                  {logado ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setForm(paraForm(c))} aria-label={`Editar ${c.nome}`}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={alternar.isPending}
                        onClick={() => {
                          if (!c.ativo || window.confirm(`Inativar ${c.nome}? Ele continua no histórico (filtro Inativos).`)) {
                            alternar.mutate(c);
                          }
                        }}
                        aria-label={`${c.ativo ? "Inativar" : "Reativar"} ${c.nome}`}
                      >
                        {c.ativo ? "Inativar" : "Reativar"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
