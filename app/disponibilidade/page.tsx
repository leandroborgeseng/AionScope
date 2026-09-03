"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SimpleLineChart } from "@/components/charts/charts";
import { CsvButton } from "@/components/export/csv-button";
import { KpiCard, toneFromPct } from "@/components/kpi/kpi-card";
import { PendingBanner, SectionError } from "@/components/pending/pending-banner";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useScopedFilters } from "@/hooks/use-scoped-filters";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { filterDisponibilidade, filterTmef } from "@/lib/pbi/apply-filters";
import { disponibilidadeMedia, formatNumber, formatPct, monthlyTrend, mtbfMedio, mttrMedio } from "@/lib/pbi/indicators";
import type { DisponibilidadeItem, TmefItem } from "@/lib/pbi/types";

export default function DisponibilidadePage() {
  const { filters } = useScopedFilters();
  const [selected, setSelected] = useState<DisponibilidadeItem | null>(null);
  const enabled = filters.empresaIds.length > 0;
  const dispQ = usePbiQuery<DisponibilidadeItem[]>("disp-equipamento-mes", filters, undefined, enabled);
  const tmefQ = usePbiQuery<TmefItem[]>("tmef", filters);
  const tpmQ = usePbiQuery<unknown[]>("tpm", filters);
  const dispLegacyQ = usePbiQuery<unknown[]>("disp-equipamento", filters);

  const rows = useMemo(() => {
    const list = filterDisponibilidade(dataOf(dispQ.data) ?? [], filters);
    return [...list].sort((a, b) => a.DisponibilidadePercentualPeriodo - b.DisponibilidadePercentualPeriodo);
  }, [dispQ.data, filters]);
  const tmef = useMemo(() => filterTmef(dataOf(tmefQ.data) ?? [], filters), [tmefQ.data, filters]);
  const trend = monthlyTrend(rows);
  const alertas = rows.filter((r) => r.PossuiOSParadaSemFuncionamento);
  const dispMedia = disponibilidadeMedia(rows);

  const columns: ColumnDef<DisponibilidadeItem, unknown>[] = [
    { accessorKey: "Tag", header: "Tag" },
    { accessorKey: "EquipamentoDescricaoCompleta", header: "Equipamento" },
    { accessorKey: "SetorDescricao", header: "Setor" },
    { accessorKey: "Fabricante", header: "Fabricante" },
    { accessorKey: "Criticidade", header: "Criticidade" },
    {
      accessorKey: "DisponibilidadePercentualPeriodo",
      header: "Disp. %",
      cell: ({ getValue }) => `${Number(getValue() ?? 0).toFixed(1)}%`,
    },
    { accessorKey: "TMEF", header: "TMEF" },
    { accessorKey: "TMPR", header: "TMPR" },
    { accessorKey: "DiasParado", header: "Dias parado" },
    {
      accessorKey: "PossuiOSParadaSemFuncionamento",
      header: "Risco",
      cell: ({ getValue }) =>
        getValue() ? <Badge tone="danger">Parado sem OS</Badge> : <Badge tone="ok">OK</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Disponibilidade e confiabilidade"
        description="Série mensal a partir de DisponibilidadeMensal. O endpoint exige empresasId — preencha o campo 'IDs empresa' na barra de filtros."
        actions={<CsvButton filename="disponibilidade-ec.csv" rows={rows as unknown as Array<Record<string, unknown>>} />}
      />

      <div className="mb-4 space-y-3">
        {tpmQ.data && !tpmQ.data.ok && tpmQ.data.disabled ? (
          <PendingBanner title="API_PBI_REL_TPM bloqueada" detail={tpmQ.data.pendingReason} />
        ) : null}
        {dispLegacyQ.data && !dispLegacyQ.data.ok && dispLegacyQ.data.disabled ? (
          <PendingBanner title="API_PBI_REL_DISP_EQUIPAMENTO bloqueada" detail={dispLegacyQ.data.pendingReason} />
        ) : null}
        {!enabled ? (
          <PendingBanner
            title="Informe o ID numérico da empresa"
            detail="O endpoint disponibilidade_equipamento_mes_a_mes exige empresasId. O teste com ID 1 retornou outro parque (não HSJ). Coloque o ID correto do São Joaquim em 'IDs empresa' ou em PBI_DEFAULT_EMPRESA_IDS."
          />
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Disponibilidade média" value={formatPct(dispMedia)} tone={toneFromPct(dispMedia)} loading={dispQ.isLoading} />
        <KpiCard label="MTBF médio" value={formatNumber(mtbfMedio(rows, tmef))} loading={dispQ.isLoading || tmefQ.isLoading} />
        <KpiCard label="MTTR médio" value={formatNumber(mttrMedio(rows))} loading={dispQ.isLoading} />
        <KpiCard
          label="Parados sem OS"
          value={String(alertas.length)}
          tone={alertas.length ? "danger" : "ok"}
          hint="PossuiOSParadaSemFuncionamento = true"
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Série mensal · Disponibilidade, TMEF e TMPR</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length ? (
            <SimpleLineChart
              data={trend}
              xKey="mes"
              series={[
                { key: "disponibilidade", name: "Disponibilidade %", color: "#0f766e" },
                { key: "tmef", name: "TMEF", color: "#0369a1" },
                { key: "tmpr", name: "TMPR", color: "#d97706" },
              ]}
            />
          ) : (
            <p className="text-sm text-slate-500">Sem série mensal para os filtros atuais.</p>
          )}
        </CardContent>
      </Card>

      {errorOf(dispQ.data) ? <SectionError message={errorOf(dispQ.data)!.message} /> : null}
      {errorOf(tmefQ.data) ? <div className="mb-3"><SectionError message={errorOf(tmefQ.data)!.message} /></div> : null}

      {dispQ.isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable data={rows} columns={columns} onRowClick={setSelected} />
      )}

      <Sheet
        open={!!selected}
        title={selected ? selected.EquipamentoDescricaoCompleta : ""}
        subtitle={selected?.Tag}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <DataTable
            data={selected.DisponibilidadeMensal as unknown as Array<Record<string, unknown>>}
            columns={[
              { accessorKey: "Ano", header: "Ano" },
              { accessorKey: "Mes", header: "Mês" },
              { accessorKey: "DisponibilidadePercentual", header: "Disp. %" },
              { accessorKey: "TMEF", header: "TMEF" },
              { accessorKey: "TMPR", header: "TMPR" },
              { accessorKey: "DiasParado", header: "Dias parado" },
              { accessorKey: "DiasFuncionando", header: "Dias funcionando" },
            ]}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
