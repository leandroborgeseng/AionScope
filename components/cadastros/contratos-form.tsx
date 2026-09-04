"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { estimativaValorMensal, nomeContratoPbi, toDateOnly } from "@/lib/pbi/contratos";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { formatBRL } from "@/lib/pbi/indicators";
import type { ContratoPbiItem } from "@/lib/pbi/types";
import { todayISO } from "@/lib/pbi/dates";

const LIST_FILTERS = {
  ...EMPTY_FILTERS,
  from: todayISO(),
  to: todayISO(),
  tipoManutencao: "Todos" as const,
  somenteMedicos: false,
};

export function ContratosCadastroForm() {
  const listQ = usePbiQuery<ContratoPbiItem[]>("contratos", LIST_FILTERS, {
    pagina: "0",
    qtdPorPagina: "100000",
    omitDates: "true",
  });

  const err = errorOf(listQ.data);
  const contratos = dataOf(listQ.data) ?? [];
  const tokenMissing =
    err?.message?.includes("PBI_TOKEN_CONTRATOS") ||
    err?.message?.includes("Token ausente") ||
    false;

  const somaEstimada = contratos.reduce((s, c) => s + estimativaValorMensal(c), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos (despesa mensal)"
        description="Lista de contratos de manutenção da API GlobalThings. A despesa mensal alimenta o indicador de custo / valor do parque."
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
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Lista</CardTitle>
            <CardDescription>
              Fonte: API GlobalThings (<code className="text-xs">GET /api/pbi/v1/contratos</code>
              ). Cadastro manual desativado.
            </CardDescription>
          </div>
          <Badge tone="ok">API</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {listQ.isLoading ? <p className="text-sm text-aion-muted">Carregando…</p> : null}

          {tokenMissing ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Configure <code className="text-xs">PBI_TOKEN_CONTRATOS</code> no{" "}
              <code className="text-xs">.env.local</code> (header <code className="text-xs">X-API-KEY</code>
              ).
            </p>
          ) : null}

          {err && !tokenMissing ? (
            <p className="text-sm text-rose-700">
              {err.message}
              {err.status != null ? ` (HTTP ${err.status})` : ""}
            </p>
          ) : null}

          {!listQ.isLoading && !err ? (
            <p className="text-sm text-aion-muted">
              {contratos.length} contrato(s) · estimativa mensal agregada{" "}
              <span className="tabular-nums font-medium text-aion-ink">{formatBRL(somaEstimada)}</span>
              {" "}
              (média de parcelas ou rateio de <code className="text-xs">ValorTotal</code>)
            </p>
          ) : null}

          {!listQ.isLoading && !err && contratos.length === 0 ? (
            <p className="text-sm text-aion-muted">Nenhum contrato retornado pela API.</p>
          ) : null}

          <ul className="divide-y divide-aion-mist">
            {contratos.map((c) => {
              const inicio = toDateOnly(c.DataInicio);
              const fim = toDateOnly(c.DataFimVigencia ?? c.DataFim);
              const mensal = estimativaValorMensal(c);
              return (
                <li key={c.ContratoId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-aion-ink">{nomeContratoPbi(c)}</p>
                      {c.Situacao ? <Badge tone="default">{c.Situacao}</Badge> : null}
                      {c.Numero ? (
                        <span className="text-xs text-aion-muted">#{c.Numero}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm tabular-nums text-aion-ink/80">
                      {formatBRL(mensal)}/mês est. · total {formatBRL(Number(c.ValorTotal) || 0)}
                    </p>
                    <p className="text-xs text-aion-muted">
                      {[
                        c.Fornecedor,
                        c.Empresa,
                        inicio || fim ? `${inicio ?? "…"} → ${fim ?? "…"}` : null,
                        c.Periodicidade,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Sem fornecedor / vigência"}
                    </p>
                    {c.TipoContrato || c.MetodoValor ? (
                      <p className="mt-1 text-xs text-aion-muted">
                        {[c.TipoContrato, c.MetodoValor].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
