"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParqueMeta, useRefreshParqueApi, useSaveParqueMeta } from "@/hooks/use-cadastros";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { formatBRL } from "@/lib/pbi/indicators";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { PARQUE_META_REFERENCIA, resumirValorParqueApi } from "@/lib/pbi/parque-valor";
import type { EquipamentoItem } from "@/lib/pbi/types";

function parseMoneyInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t.replace(/[^\d.]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function ParqueCadastroForm() {
  const parqueQ = useParqueMeta();
  const save = useSaveParqueMeta();
  const refreshApi = useRefreshParqueApi();
  const [valorStr, setValorStr] = useState("");
  const [por, setPor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!parqueQ.data) return;
    setValorStr(
      parqueQ.data.valorSubstituicaoManual != null
        ? String(parqueQ.data.valorSubstituicaoManual)
        : "",
    );
    setPor(parqueQ.data.atualizadoPor ?? "");
  }, [parqueQ.data]);

  const eqQ = usePbiQuery<EquipamentoItem[]>(
    "equipamentos",
    {
      ...EMPTY_FILTERS,
      from: startOfMonthISO(),
      to: todayISO(),
      tipoManutencao: "Todos",
      somenteMedicos: false,
    },
    {
      apenasAtivos: "true",
      incluirComponentes: "false",
      incluirCustoSubstituicao: "true",
    },
  );

  const apiResumo = useMemo(() => {
    const items = dataOf(eqQ.data) ?? [];
    if (!items.length) return null;
    return resumirValorParqueApi(items);
  }, [eqQ.data]);

  const valorPersistido = parqueQ.data?.valorApi ?? null;
  const fonteEfetiva = parqueQ.data?.fonteEfetiva ?? parqueQ.data?.fonte ?? null;
  const valorEfetivo = parqueQ.data?.valorEfetivo ?? valorPersistido;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = parseMoneyInput(valorStr);
    if (valorStr.trim() && Number.isNaN(n as number)) {
      setMsg("Valor inválido.");
      return;
    }
    try {
      await save.mutateAsync({
        valorSubstituicaoManual: n,
        atualizadoPor: por.trim() || undefined,
      });
      setMsg(
        n != null && n > 0
          ? "Override manual salvo (passa a ser o denominador)."
          : "Manual limpo — denominador volta para o valor da API.",
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  async function onRefreshApi() {
    setMsg(null);
    try {
      const data = await refreshApi.mutateAsync({ atualizadoPor: por.trim() || undefined });
      const todos = data.resumoApi?.substituicaoTodos ?? data.valorApi;
      setMsg(`API gravada: ${formatBRL(todos)} (todos os equipamentos).`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao atualizar da API.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Valor do parque"
        description="Valor puxado do cadastro de equipamentos (substituição, todos os cadastrados). Override manual só se salvar explicitamente."
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
          <CardTitle>Valor em uso (API)</CardTitle>
          <CardDescription>
            Persistido em SQLite (<code className="text-xs">DATABASE_PATH</code>, default{" "}
            <code className="text-xs">/data/aionscope.sqlite</code>). Escopo: todos os equipamentos
            cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={fonteEfetiva === "api" ? "ok" : "warn"}>
              fonte: {fonteEfetiva ?? "—"}
            </Badge>
            <Badge tone="info">escopo: {parqueQ.data?.escopo ?? "todos"}</Badge>
          </div>
          <p>
            Denominador efetivo:{" "}
            <strong className="tabular-nums">{formatBRL(valorEfetivo)}</strong>
          </p>
          <p>
            Soma API persistida (todos):{" "}
            <strong className="tabular-nums">{formatBRL(valorPersistido)}</strong>
            {parqueQ.data?.atualizadoEm ? (
              <span className="text-aion-muted">
                {" "}
                · atualizado {new Date(parqueQ.data.atualizadoEm).toLocaleString("pt-BR")}
              </span>
            ) : null}
          </p>
          {parqueQ.data?.notas ? (
            <p className="text-xs text-aion-muted">{parqueQ.data.notas}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onRefreshApi} disabled={refreshApi.isPending}>
              {refreshApi.isPending ? "Atualizando…" : "Atualizar da API"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Override manual (opcional)</CardTitle>
          <CardDescription>
            Se preenchido e salvo, substitui o valor da API. Deixe vazio e salve para voltar à API.
            Referência antiga (não usada): {formatBRL(PARQUE_META_REFERENCIA)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="grid max-w-xl gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-aion-ink">Valor manual (R$)</span>
              <Input
                inputMode="decimal"
                placeholder="deixe vazio para usar a API"
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-aion-ink">Atualizado por (opcional)</span>
              <Input value={por} onChange={(e) => setPor(e.target.value)} placeholder="Nome" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar override"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setValorStr("")}
              >
                Limpar campo
              </Button>
            </div>
            {msg ? <p className="text-sm text-aion-ink/80">{msg}</p> : null}
            {parqueQ.error ? (
              <p className="text-sm text-rose-700">{(parqueQ.error as Error).message}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria da API (live)</CardTitle>
          <CardDescription>
            GET equipamentos com <code className="text-xs">incluirCustoSubstituicao=true</code>. O
            cálculo usa a soma de <strong>todos</strong>; médicos só para comparação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {eqQ.isLoading ? <p className="text-aion-muted">Consultando API…</p> : null}
          {errorOf(eqQ.data)?.message ? (
            <p className="text-rose-700">{errorOf(eqQ.data)?.message}</p>
          ) : null}
          {apiResumo ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">{apiResumo.nTotal} equipamentos</Badge>
                <Badge tone="info">{apiResumo.nMedicos} médicos</Badge>
              </div>
              <ul className="space-y-1 text-aion-ink/85">
                <li>
                  Substituição (todos — denominador):{" "}
                  <strong className="tabular-nums">
                    {formatBRL(apiResumo.substituicao.todos.total)}
                  </strong>{" "}
                  · preenchidos {apiResumo.substituicao.todos.pctPreenchidos.toFixed(1)}%
                  {apiResumo.vsMetaTodosSubstituicao != null ? (
                    <span className="text-aion-muted">
                      {" "}
                      ({apiResumo.vsMetaTodosSubstituicao.toFixed(1)}% da ref. 57 mi)
                    </span>
                  ) : null}
                </li>
                <li>
                  Substituição (médicos — auditoria):{" "}
                  <strong className="tabular-nums">
                    {formatBRL(apiResumo.substituicao.medicos.total)}
                  </strong>{" "}
                  · preenchidos {apiResumo.substituicao.medicos.pctPreenchidos.toFixed(1)}%
                </li>
                <li>
                  Aquisição (todos):{" "}
                  <strong className="tabular-nums">{formatBRL(apiResumo.aquisicao.todos.total)}</strong>{" "}
                  — não usar (outliers).
                </li>
              </ul>
              <ul className="list-disc space-y-1 pl-5 text-xs text-aion-muted">
                {apiResumo.notas.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
