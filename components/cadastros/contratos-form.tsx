"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useContratos,
  useCreateContrato,
  useDeleteContrato,
  useUpdateContrato,
} from "@/hooks/use-cadastros";
import { formatBRL } from "@/lib/pbi/indicators";
import type { Contrato, ContratoInput } from "@/lib/cadastros/types";

const EMPTY_FORM: ContratoInput = {
  nome: "",
  fornecedor: "",
  valorMensal: 0,
  inicio: "",
  fim: "",
  ativo: true,
  observacao: "",
};

function parseValorMensal(raw: string) {
  const t = raw.trim();
  if (!t) return 0;
  const normalized = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t.replace(/[^\d.]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function ContratosCadastroForm() {
  const listQ = useContratos();
  const create = useCreateContrato();
  const update = useUpdateContrato();
  const del = useDeleteContrato();
  const [form, setForm] = useState<ContratoInput>(EMPTY_FORM);
  const [valorStr, setValorStr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function loadEdit(c: Contrato) {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      fornecedor: c.fornecedor ?? "",
      valorMensal: c.valorMensal,
      inicio: c.inicio ?? "",
      fim: c.fim ?? "",
      ativo: c.ativo,
      observacao: c.observacao ?? "",
    });
    setValorStr(String(c.valorMensal));
    setMsg(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setValorStr("");
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const valorMensal = parseValorMensal(valorStr);
    if (!Number.isFinite(valorMensal) || valorMensal < 0) {
      setMsg("Valor mensal inválido.");
      return;
    }
    const payload: ContratoInput = {
      ...form,
      valorMensal,
      inicio: form.inicio || null,
      fim: form.fim || null,
    };
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, ...payload });
        setMsg("Contrato atualizado.");
      } else {
        await create.mutateAsync(payload);
        setMsg("Contrato criado.");
      }
      resetForm();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  const contratos = listQ.data ?? [];
  const somaAtivos = contratos.filter((c) => c.ativo).reduce((s, c) => s + c.valorMensal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos (despesa mensal)"
        description="Cadastre contratos de manutenção. A soma dos ativos entra no indicador de custo / valor do parque."
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
        <CardHeader>
          <CardTitle>{editingId ? "Editar contrato" : "Novo contrato"}</CardTitle>
          <CardDescription>
            Persistido em <code className="text-xs">data/contratos.json</code>. Commite o arquivo para
            versionar; no Railway o filesystem pode resetar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Nome *</span>
              <Input
                required
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Contrato GE — multimônitores"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Fornecedor</span>
              <Input
                value={form.fornecedor ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Valor mensal (R$) *</span>
              <Input
                required
                inputMode="decimal"
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
                placeholder="15000"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Início</span>
              <Input
                type="date"
                value={form.inicio ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Fim</span>
              <Input
                type="date"
                value={form.fim ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.ativo !== false}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                className="h-4 w-4 rounded border-aion-line"
              />
              Ativo
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Observação</span>
              <Input
                value={form.observacao ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editingId ? "Atualizar" : "Adicionar"}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar edição
                </Button>
              ) : null}
            </div>
            {msg ? <p className="text-sm text-aion-ink/80 md:col-span-2">{msg}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Lista</CardTitle>
            <CardDescription>
              {contratos.length} contrato(s) · ativos{" "}
              <span className="tabular-nums font-medium text-aion-ink">{formatBRL(somaAtivos)}</span>
              /mês
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? <p className="text-sm text-aion-muted">Carregando…</p> : null}
          {listQ.error ? (
            <p className="text-sm text-rose-700">{(listQ.error as Error).message}</p>
          ) : null}
          {!listQ.isLoading && contratos.length === 0 ? (
            <p className="text-sm text-aion-muted">Nenhum contrato cadastrado.</p>
          ) : null}
          <ul className="divide-y divide-aion-mist">
            {contratos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-aion-ink">{c.nome}</p>
                    <Badge tone={c.ativo ? "ok" : "default"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm tabular-nums text-aion-ink/80">{formatBRL(c.valorMensal)}/mês</p>
                  <p className="text-xs text-aion-muted">
                    {[c.fornecedor, c.inicio || c.fim ? `${c.inicio ?? "…"} → ${c.fim ?? "…"}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Sem fornecedor / vigência"}
                  </p>
                  {c.observacao ? <p className="mt-1 text-xs text-aion-muted">{c.observacao}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => loadEdit(c)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm(`Excluir “${c.nome}”?`)) void del.mutateAsync(c.id);
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
