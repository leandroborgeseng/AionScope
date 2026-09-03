"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SimpleBarChart, SimpleLineChart } from "@/components/charts/charts";
import { CsvButton } from "@/components/export/csv-button";
import { KpiCard, toneFromPct } from "@/components/kpi/kpi-card";
import { SectionError } from "@/components/pending/pending-banner";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useScopedFilters } from "@/hooks/use-scoped-filters";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { filterMonitorAtendimento, filterMonitorReacao, filterOs } from "@/lib/pbi/apply-filters";
import { formatPct, liberadoParaUso, monitorPrazo, pareto, slaAtendimento, slaMonthly, slaSolucao } from "@/lib/pbi/indicators";
import type { MonitorAtendimentoItem, MonitorReacaoItem, OsAnaliticoItem, OsResumidaItem } from "@/lib/pbi/types";

function filledFlag(value: string) {
  const v = (value ?? "").trim().toLocaleUpperCase("pt-BR");
  return v && v !== "NÃO INFORMADO" && v !== "NAO INFORMADO";
}

export default function CorretivasPage() {
  const { filters } = useScopedFilters();
  const [selected, setSelected] = useState<OsAnaliticoItem | OsResumidaItem | null>(null);
  const resumidaQ = usePbiQuery<OsResumidaItem[]>("os-resumida", filters, { qtdPorPagina: "100000" });
  const detalheQ = usePbiQuery<OsAnaliticoItem[]>("os-analitico", filters);
  const reacaoQ = usePbiQuery<MonitorReacaoItem[]>("monitor-reacao", filters);
  const atendQ = usePbiQuery<MonitorAtendimentoItem[]>("monitor-atendimento", filters);

  const os = useMemo(() => filterOs(dataOf(resumidaQ.data) ?? [], filters), [resumidaQ.data, filters]);
  const detalhe = useMemo(() => filterOs(dataOf(detalheQ.data) ?? [], filters), [detalheQ.data, filters]);
  const reacao = useMemo(() => filterMonitorReacao(dataOf(reacaoQ.data) ?? [], filters), [reacaoQ.data, filters]);
  const atendimento = useMemo(
    () => filterMonitorAtendimento(dataOf(atendQ.data) ?? [], filters),
    [atendQ.data, filters],
  );

  const detalheMap = useMemo(() => new Map(detalhe.map((o) => [o.CodigoSerialOS, o])), [detalhe]);
  const selectedFull =
    selected && "DataLimiteDoAtendimento" in selected
      ? selected
      : selected
        ? detalheMap.get(selected.CodigoSerialOS) ?? selected
        : null;

  const slaA = slaAtendimento(detalhe);
  const slaS = slaSolucao(detalhe);
  const lib = liberadoParaUso(detalhe);
  const prazoReacao = monitorPrazo(reacao);
  const prazoAtend = monitorPrazo(atendimento);
  const causas = pareto(os.map((o) => o.Causa));
  const ocorrencias = pareto(os.map((o) => o.Ocorrencia));
  const trend = slaMonthly(detalhe);

  const columns: ColumnDef<OsResumidaItem, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    { accessorKey: "Empresa", header: "Empresa" },
    { accessorKey: "Oficina", header: "Oficina" },
    { accessorKey: "TipoDeManutencao", header: "Tipo" },
    { accessorKey: "SituacaoDaOS", header: "Situação" },
    { accessorKey: "Setor", header: "Setor" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    { accessorKey: "Abertura", header: "Abertura" },
    { accessorKey: "Fechamento", header: "Fechamento" },
    { accessorKey: "Ocorrencia", header: "Ocorrência" },
    { accessorKey: "Causa", header: "Causa" },
    {
      id: "liberado",
      header: "Liberado",
      cell: ({ row }) => {
        const full = detalheMap.get(row.original.CodigoSerialOS);
        const value = full?.LiberadoParaUso ?? "";
        const ok = filledFlag(value);
        return <Badge tone={ok ? "ok" : "danger"}>{ok ? value : "Ausente"}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Corretivas, SLA e ocorrências"
        description="A tabela usa a listagem resumida (paginada na origem). O detalhe completo da OS é carregado no drill-down."
        actions={<CsvButton filename="os-ec.csv" rows={os as unknown as Array<Record<string, unknown>>} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="SLA atendimento" value={formatPct(slaA.value)} hint={`${slaA.total} OS elegíveis`} tone={toneFromPct(slaA.value)} />
        <KpiCard label="SLA solução" value={formatPct(slaS.value)} hint={`${slaS.total} OS elegíveis`} tone={toneFromPct(slaS.value)} />
        <KpiCard
          label="Reação no prazo"
          value={formatPct(prazoReacao.value)}
          hint={prazoReacao.total ? `${prazoReacao.total} com prazo` : "PrazoParaAtendimento veio vazio na API"}
        />
        <KpiCard
          label="Liberado para uso"
          value={formatPct(lib.value)}
          hint={`${lib.missing.length} OS fechadas sem flag`}
          tone={toneFromPct(lib.value)}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tendência mensal de SLA</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length ? (
              <SimpleLineChart
                data={trend}
                xKey="mes"
                series={[
                  { key: "slaAtendimento", name: "Atendimento %", color: "#0f766e" },
                  { key: "slaSolucao", name: "Solução %", color: "#0369a1" },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">
                Sem datas-limite suficientes no período. Abra o detalhe de uma OS ou amplie o intervalo.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pareto de causas</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={causas.map((c) => ({ name: c.name, count: c.count }))} xKey="name" yKey="count" color="#d97706" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pareto de ocorrências</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={ocorrencias.map((c) => ({ name: c.name, count: c.count }))} xKey="name" yKey="count" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monitor de atendimento × prazo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Dentro do prazo: {prazoAtend.dentro.length} · Estourado: {prazoAtend.estourado.length} · Sem prazo
              informado: {prazoAtend.semPrazo.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {errorOf(resumidaQ.data) ? <SectionError message={errorOf(resumidaQ.data)!.message} /> : null}
      {resumidaQ.isLoading ? <TableSkeleton /> : <DataTable data={os} columns={columns} onRowClick={setSelected} />}

      <Sheet
        open={!!selected}
        title={selected ? `OS ${selected.OS}` : ""}
        subtitle={selected?.Equipamento || selected?.Setor}
        onClose={() => setSelected(null)}
      >
        {selectedFull ? (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {Object.entries(selectedFull).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{key}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-800">{String(value ?? "—") || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Carregando detalhe completo…</p>
        )}
      </Sheet>
    </div>
  );
}
