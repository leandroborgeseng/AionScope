"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { CsvButton } from "@/components/export/csv-button";
import { KpiCard } from "@/components/kpi/kpi-card";
import { SectionError } from "@/components/pending/pending-banner";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { TableSkeleton } from "@/components/ui/skeleton";
import { OsRelatoBloco } from "@/components/os/os-relato-bloco";
import {
  COMPRAS_FECHADAS_DIAS,
  COMPRAS_REGRA_UI,
  GLOBAL_THINGS_PORTAL_URL,
  TIPO_SOLICITACAO_COMPRA_EC,
  formatCompraAbertura,
  formatCompraFechamento,
  type CompraRow,
  type ComprasSnapshot,
} from "@/lib/pbi/compras";
import { cn } from "@/lib/utils";

type Aba = "abertas" | "fechadas";

function toneDias(dias: number): "ok" | "warn" | "danger" | "info" {
  if (dias >= 45) return "danger";
  if (dias >= 21) return "warn";
  if (dias >= 7) return "info";
  return "ok";
}

const DETAIL_SKIP = new Set([
  "aberturaDate",
  "fechamentoDate",
  "diasEspera",
  "abertaHaLabel",
  "diasAteFechar",
  // Exibidos em destaque em OsRelatoBloco
  "ObservacaoDaRequisicao",
  "ObservacaoDaOS",
  "Servico",
  "Requisitante",
]);

export function ComprasBoard({
  snapshot,
  loading,
  error,
}: {
  snapshot: ComprasSnapshot | null;
  loading: boolean;
  error: string | null;
}) {
  const [aba, setAba] = useState<Aba>("abertas");
  const [selected, setSelected] = useState<CompraRow | null>(null);

  const lista = aba === "abertas" ? snapshot?.abertas ?? [] : snapshot?.fechadas90d ?? [];
  const kpis = aba === "abertas" ? snapshot?.kpisAbertas : snapshot?.kpisFechadas;

  const columns = useMemo(() => {
    const cols: ColumnDef<CompraRow, unknown>[] = [
      { accessorKey: "OS", header: "OS" },
      {
        id: "tag",
        header: "Tag / equipamento",
        cell: ({ row }) => {
          const tag = row.original.Tag?.trim();
          const eq = row.original.Equipamento?.trim();
          if (tag && eq) return `${tag} · ${eq}`;
          return tag || eq || "—";
        },
      },
      { accessorKey: "Setor", header: "Setor" },
      { accessorKey: "Oficina", header: "Oficina" },
      {
        id: "tipo",
        header: "Tipo",
        cell: ({ row }) => row.original.TipoDeManutencao || "—",
      },
      {
        id: "abertura",
        header: "Abertura",
        accessorFn: (row) => row.aberturaDate.getTime(),
        cell: ({ row }) => formatCompraAbertura(row.original),
      },
    ];

    if (aba === "fechadas") {
      cols.push({
        id: "fechamento",
        header: "Fechamento",
        cell: ({ row }) => formatCompraFechamento(row.original),
      });
    }

    cols.push({
      id: "dias",
      header: aba === "abertas" ? "Dias de espera" : "Dias até fechar",
      accessorFn: (row) => row.diasEspera,
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <Badge tone={toneDias(row.original.diasEspera)} className="w-fit tabular-nums">
            {row.original.diasEspera}d
          </Badge>
          <span className="text-[11px] text-aion-muted">{row.original.abertaHaLabel}</span>
        </div>
      ),
    });

    return cols;
  }, [aba]);

  const csvRows = lista.map((item) => ({
    OS: item.OS,
    Tag: item.Tag,
    Equipamento: item.Equipamento,
    Setor: item.Setor,
    Oficina: item.Oficina,
    TipoDeManutencao: item.TipoDeManutencao,
    Abertura: item.Abertura,
    Fechamento: item.Fechamento,
    DataDaSolucao: item.DataDaSolucao,
    DiasEspera: item.diasEspera,
    Situacao: item.SituacaoDaOS,
  }));

  return (
    <div>
      <PageHeader
        title="Solicitações de compra"
        description="OS abertas do tipo solicitação de compra (Engenharia Clínica), com dias corridos de espera desde a Abertura."
        actions={
          <CsvButton
            filename={aba === "abertas" ? "compras-abertas.csv" : "compras-fechadas-90d.csv"}
            rows={csvRows}
          />
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-aion-blue" />
            Regra de identificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-aion-ink/80">
          <p>
            Tipo canônico na API:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">
              {snapshot?.tipoCanonico ?? TIPO_SOLICITACAO_COMPRA_EC}
            </code>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-aion-muted">
            {(snapshot?.regra ?? COMPRAS_REGRA_UI).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={aba === "abertas" ? "default" : "outline"}
          onClick={() => setAba("abertas")}
        >
          Abertas esperando
          {snapshot ? ` (${snapshot.kpisAbertas.quantidade})` : ""}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={aba === "fechadas" ? "default" : "outline"}
          onClick={() => setAba("fechadas")}
        >
          Fechadas {COMPRAS_FECHADAS_DIAS}d
          {snapshot ? ` (${snapshot.kpisFechadas.quantidade})` : ""}
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label={aba === "abertas" ? "Abertas" : `Fechadas (${COMPRAS_FECHADAS_DIAS}d)`}
          value={kpis ? String(kpis.quantidade) : "—"}
          hint={
            aba === "abertas"
              ? "Sem Fechamento / DataDaSolucao"
              : `Fechadas nos últimos ${COMPRAS_FECHADAS_DIAS} dias`
          }
          loading={loading}
          error={error}
        />
        <KpiCard
          label={aba === "abertas" ? "Idade média" : "Tempo médio até fechar"}
          value={kpis?.idadeMediaDias != null ? `${kpis.idadeMediaDias} d` : "—"}
          hint="Dias corridos (calendário · America/Sao_Paulo)"
          loading={loading}
        />
        <KpiCard
          label={aba === "abertas" ? "Mais antiga" : "Maior tempo até fechar"}
          value={kpis?.maisAntigaDias != null ? `${kpis.maisAntigaDias} d` : "—"}
          hint={lista[0] ? `OS ${lista[0].OS}` : undefined}
          loading={loading}
          tone={
            kpis?.maisAntigaDias == null
              ? "neutral"
              : kpis.maisAntigaDias >= 45
                ? "danger"
                : kpis.maisAntigaDias >= 21
                  ? "warn"
                  : "neutral"
          }
        />
      </div>

      {error ? <SectionError message={error} /> : null}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable data={lista} columns={columns} onRowClick={setSelected} pageSize={20} />
      )}

      <Sheet
        open={!!selected}
        title={selected ? `OS ${selected.OS}` : ""}
        subtitle={
          selected
            ? `${selected.Tag || "sem tag"} · ${selected.Equipamento || "—"} · ${selected.diasEspera}d`
            : undefined
        }
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneDias(selected.diasEspera)}>{selected.abertaHaLabel}</Badge>
              <a
                href={GLOBAL_THINGS_PORTAL_URL}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5 text-sm font-medium text-aion-blue hover:underline",
                )}
              >
                Abrir portal GlobalThings
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <span className="text-xs text-aion-muted">
                Busque a OS {selected.OS}
                {selected.CodigoSerialOS ? ` (serial ${selected.CodigoSerialOS})` : ""} no Effort /
                GlobalThings — não há deep-link estável na API.
              </span>
            </div>
            <OsRelatoBloco item={selected} />
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {Object.entries(selected)
                .filter(([key]) => !DETAIL_SKIP.has(key))
                .map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{key}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-slate-800">{String(value ?? "—") || "—"}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
