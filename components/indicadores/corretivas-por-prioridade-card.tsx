"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { PrioridadeStackBarChart } from "@/components/charts/charts";
import {
  ChartCard,
  ChartFullscreenDialog,
  IndicadorHeading,
  OrigemCampo,
  useChartFullscreen,
} from "@/components/indicadores/chart-fullscreen";
import { IndicadorPageLayout } from "@/components/indicadores/indicador-page-layout";
import { SelecaoOsLista } from "@/components/indicadores/selecao-os-lista";
import { FilterChip } from "@/components/indicadores/indicador-section";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/kpi/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { formatDateBR } from "@/lib/pbi/dates";
import { FICHAS } from "@/lib/pbi/fichas";
import {
  CORRETIVAS_PRIORIDADE_CAMPOS,
  PRIORIDADE_GRUPOS,
  buildCorretivasPorPrioridade,
  corretivasDoMes,
  filterPorPrioridade,
  monthsFromRows,
  type CorretivaPrioridadeRow,
  type PrioridadeGrupo,
} from "@/lib/pbi/corretivas-por-prioridade";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type PrioFiltro = PrioridadeGrupo | "Todas";

type Drill = {
  title: string;
  subtitle?: string;
  rows: CorretivaPrioridadeRow[];
  mesLabel?: string;
} | null;

const FICHA = FICHAS["corretivas-por-prioridade"];

function tituloLista(drill: Drill, prio: PrioFiltro) {
  if (!drill) return undefined;
  const parts: string[] = [];
  if (drill.mesLabel) parts.push(drill.mesLabel);
  if (prio !== "Todas") parts.push(prio);
  if (!parts.length) return drill.title;
  return `Corretivas · ${parts.join(" · ")}`;
}

function badgeTonePrio(grupo: PrioridadeGrupo): "ok" | "danger" | "warn" | "info" {
  if (grupo === "Alta") return "danger";
  if (grupo === "Média") return "warn";
  if (grupo === "Baixa") return "ok";
  return "info";
}

export function CorretivasPorPrioridadeCard({
  range,
  raw,
  bruta,
  loading,
  error,
  headingAs = "section",
}: {
  range: RollingYearRange;
  raw: OsAnaliticoItem[];
  bruta: number;
  loading: boolean;
  error: string | null;
  headingAs?: "page" | "section";
}) {
  const medical = useMedicalIndex();
  const [drill, setDrill] = useState<Drill>(null);
  const [prioFiltro, setPrioFiltro] = useState<PrioFiltro>("Todas");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const dados = useMemo(
    () => buildCorretivasPorPrioridade(raw, range, medical.tags, medical.ids),
    [raw, medical.tags, medical.ids, range],
  );

  const rowsVisiveis = useMemo(
    () => filterPorPrioridade(dados.noIntervalo, prioFiltro),
    [dados.noIntervalo, prioFiltro],
  );

  const monthsVisiveis = useMemo(() => monthsFromRows(range, rowsVisiveis), [range, rowsVisiveis]);

  const chartData = useMemo(
    () =>
      monthsVisiveis.map((m) => ({
        name: m.label,
        key: m.key,
        year: m.year,
        month: m.month,
        total: m.total,
        alta: m.alta,
        media: m.media,
        baixa: m.baixa,
        semPrioridade: m.semPrioridade,
      })),
    [monthsVisiveis],
  );

  const clearSelection = useCallback(() => {
    setDrill(null);
    setSheetOpen(false);
  }, []);

  const openMesLista = useCallback(
    (row: { name: string; year?: string | number; month?: string | number }) => {
      const year = Number(row.year);
      const month = Number(row.month);
      const doMes = corretivasDoMes(dados.noIntervalo, year, month);
      const alta = doMes.filter((r) => r.prioridadeGrupo === "Alta").length;
      const media = doMes.filter((r) => r.prioridadeGrupo === "Média").length;
      const baixa = doMes.filter((r) => r.prioridadeGrupo === "Baixa").length;
      const sem = doMes.filter((r) => r.prioridadeGrupo === "Sem prioridade").length;
      setDrill({
        title: `Corretivas · ${row.name}`,
        mesLabel: row.name,
        subtitle: `${doMes.length} OS · Alta ${alta} · Média ${media} · Baixa ${baixa} · Sem prio. ${sem}`,
        rows: doMes,
      });
    },
    [dados.noIntervalo],
  );

  const openPeriodo = useCallback((rows: CorretivaPrioridadeRow[], title: string, subtitle: string) => {
    setDrill({ title, subtitle, rows });
  }, []);

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    return filterPorPrioridade(drill.rows, prioFiltro);
  }, [drill, prioFiltro]);

  const cols: ColumnDef<CorretivaPrioridadeRow, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    {
      accessorKey: "prioridadeGrupo",
      header: "Prioridade",
      cell: ({ row }) => (
        <Badge tone={badgeTonePrio(row.original.prioridadeGrupo)}>{row.original.prioridadeGrupo}</Badge>
      ),
    },
    {
      accessorKey: "prioridadeRaw",
      header: "Prioridade (API)",
      cell: ({ row }) => row.original.prioridadeRaw,
    },
    { accessorKey: "TipoDeManutencao", header: "Tipo" },
    { accessorKey: "Tag", header: "Tag" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    {
      accessorKey: "Abertura",
      header: "Abertura",
      cell: ({ row }) => formatDateBR(row.original.aberturaDate),
    },
    { accessorKey: "SituacaoDaOS", header: "Situação" },
  ];

  const waiting = loading || medical.loading;
  const medicalError =
    medical.error ?? (!medical.loading && !medical.ready ? "Índice de equipamentos médicos indisponível." : null);
  const blockError = error || medicalError;

  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;
  const listaTitle = tituloLista(drill, prioFiltro);

  const filters = drill ? (
    <>
      <FilterChip
        active={prioFiltro === "Todas"}
        onClick={() => setPrioFiltro("Todas")}
      >
        Todas ({drill.rows.length})
      </FilterChip>
      {PRIORIDADE_GRUPOS.map((g) => (
        <FilterChip key={g} active={prioFiltro === g} onClick={() => setPrioFiltro(g)}>
          {g} ({drill.rows.filter((r) => r.prioridadeGrupo === g).length})
        </FilterChip>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        Abrir painel lateral
      </Button>
    </>
  ) : null;

  const table = drill ? <DataTable data={drillVisible} columns={cols} pageSize={15} /> : null;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "recorte",
      title: "Recorte: corretivas de equipamentos médicos",
      children: (
        <div className="space-y-3 text-slate-700">
          <p>
            Mesma regra de <code className="rounded bg-white px-1 py-0.5 text-xs">isCorretiva</code> usada em{" "}
            <Link href="/corretivas" className="font-medium text-aion-blue underline-offset-2 hover:underline">
              /corretivas
            </Link>
            : TipoDeManutencao contendo “CORRET”.
          </p>
          <p>
            Só entram OS com <strong>Tag</strong> no índice de equipamentos médicos. OS sem tag ou com tag não médica
            ficam de fora.
          </p>
          <p>
            O mês do gráfico é o mês de <strong>Abertura</strong> da OS (intervalo rolante {range.fromISO} a{" "}
            {range.toISO}).
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Este indicador mede <strong>volume / distribuição por Prioridade da OS</strong>. Não calcula prazo, SLA nem
            criticidade do parque.
          </p>
        </div>
      ),
    },
    {
      id: "origem",
      title: "De onde vêm os dados",
      children: (
        <div className="space-y-4 text-slate-700">
          <dl className="grid gap-3 sm:grid-cols-2">
            <OrigemCampo label="Endpoint">
              <span className="font-mono text-xs">GET /api/pbi/v1/listagem_analitica_das_os</span>
              <p className="mt-1 text-xs text-slate-500">via /api/pbi/os-analitico</p>
            </OrigemCampo>
            <OrigemCampo label="Params enviados">
              <span className="font-mono text-xs">
                periodo={VOLUME_EC_PERIODO_API} · tipoManutencao={VOLUME_EC_TIPO_API} · qtdPorPagina=100000
              </span>
            </OrigemCampo>
            <OrigemCampo label="Filtro local">
              Tag médica + isCorretiva + Abertura no intervalo. Prioridade agrupada localmente (Alta / Média / Baixa /
              Sem prioridade).
            </OrigemCampo>
            <OrigemCampo label="Campos">
              <span className="font-mono text-xs">{CORRETIVAS_PRIORIDADE_CAMPOS.join(", ")}</span>
            </OrigemCampo>
            <OrigemCampo label="Quantidade bruta (API)" valueClassName="mt-1 text-lg font-semibold tabular-nums">
              {bruta}
            </OrigemCampo>
            <OrigemCampo label="Após filtro" valueClassName="mt-1 text-sm font-semibold tabular-nums leading-relaxed">
              {dados.aposMedico.length} tag médica · {dados.aposCorretiva.length} corretiva ·{" "}
              {dados.noIntervalo.length} com Abertura no intervalo
            </OrigemCampo>
          </dl>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mistura por prioridade (período)
            </p>
            <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Prioridade</th>
                    <th className="px-3 py-2">OS</th>
                    <th className="px-3 py-2">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porPrioridade.map((row) => (
                    <tr key={row.grupo} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{row.grupo}</td>
                      <td className="px-3 py-2 tabular-nums">{row.total}</td>
                      <td className="px-3 py-2 tabular-nums">{row.pctLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Exemplos para conferir ({dados.exemplos.length} OS)
            </p>
            {dados.exemplos.length === 0 ? (
              <p className="text-slate-500">Nenhuma corretiva médica no intervalo para amostrar.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">OS</th>
                      <th className="px-3 py-2">Prioridade</th>
                      <th className="px-3 py-2">API</th>
                      <th className="px-3 py-2">Abertura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.exemplos.map((item) => (
                      <tr key={`${item.CodigoSerialOS}-${item.OS}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{item.OS || "—"}</td>
                        <td className="px-3 py-2">{item.prioridadeGrupo}</td>
                        <td className="px-3 py-2">{item.prioridadeRaw}</td>
                        <td className="px-3 py-2">{formatDateBR(item.aberturaDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Funil (honestidade)</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Sem tag / fora do índice médico:{" "}
                <strong className="tabular-nums">{dados.semTag.length + dados.tagForaDoIndice.length}</strong>
              </li>
              <li>
                Total no intervalo: <strong className="tabular-nums">{dados.total}</strong>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <IndicadorPageLayout
        loading={waiting}
        error={blockError}
        ficha={FICHA}
        detalhesItems={detalhesItems}
        heading={
          <Heading
            title="Corretivas por prioridade"
            description={`Volume de OS corretivas de eq. médicos por Prioridade (Alta / Média / Baixa / Sem prioridade) · ${range.label}. Sem cálculo de prazo.`}
          />
        }
        kpis={
          <>
            {dados.porPrioridade.map((row) => (
              <KpiCard
                key={row.grupo}
                label={row.grupo}
                value={String(row.total)}
                hint={`${row.pctLabel} do total · ${dados.total} OS`}
                tone={
                  row.grupo === "Alta"
                    ? row.total > 0
                      ? "danger"
                      : "neutral"
                    : row.grupo === "Média"
                      ? row.total > 0
                        ? "warn"
                        : "neutral"
                      : "neutral"
                }
                onClick={() => {
                  setPrioFiltro(row.grupo);
                  openPeriodo(
                    dados.noIntervalo,
                    `Corretivas · ${range.label}`,
                    `${dados.total} OS corretivas no período`,
                  );
                }}
              />
            ))}
          </>
        }
        chart={
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={prioFiltro === "Todas"} onClick={() => setPrioFiltro("Todas")}>
                Todas ({dados.total})
              </FilterChip>
              {PRIORIDADE_GRUPOS.map((g) => {
                const row = dados.porPrioridade.find((r) => r.grupo === g);
                return (
                  <FilterChip key={g} active={prioFiltro === g} onClick={() => setPrioFiltro(g)}>
                    {g} ({row?.total ?? 0})
                  </FilterChip>
                );
              })}
            </div>
            <ChartCard
              title={`Corretivas por mês e prioridade · ${range.label}`}
              onExpand={openFullscreen}
              hint="Barras empilhadas: Alta / Média / Baixa / Sem prioridade. Clique no mês para listar as OS. Chips acima refiltram gráfico, KPIs e lista."
            >
              <PrioridadeStackBarChart data={chartData} xKey="name" onRowClick={openMesLista} />
            </ChartCard>
          </div>
        }
        selectionList={
          <SelecaoOsLista
            hasSelection={!!drill}
            title={listaTitle}
            subtitle={drill?.subtitle}
            emptyHint="Clique em um mês no gráfico (ou em um KPI) para listar as OS."
            onClear={clearSelection}
            filters={filters}
          >
            {table}
          </SelecaoOsLista>
        }
      />

      <ChartFullscreenDialog
        open={open}
        title={`Corretivas por prioridade · ${range.label}`}
        subtitle="Mesmo gráfico, em tela cheia. Clique no mês para ver a lista na página."
        onClose={closeFullscreen}
        ready={ready}
        chips={
          <>
            {dados.porPrioridade.map((row) => (
              <span key={row.grupo} className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
                {row.grupo} <strong className="tabular-nums text-slate-900">{row.total}</strong>
              </span>
            ))}
          </>
        }
      >
        <PrioridadeStackBarChart
          key={`fullscreen-prio-${range.fromISO}-${range.toISO}-${prioFiltro}`}
          data={chartData}
          xKey="name"
          className="h-full min-h-[280px]"
          maxBarSize={80}
          onRowClick={(row) => {
            openMesLista(row);
            closeFullscreen();
          }}
        />
      </ChartFullscreenDialog>

      <Sheet
        open={sheetOpen && !!drill}
        title={listaTitle ?? drill?.title ?? ""}
        subtitle={drill?.subtitle}
        onClose={() => setSheetOpen(false)}
      >
        {drill ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={prioFiltro === "Todas"} onClick={() => setPrioFiltro("Todas")}>
                Todas ({drill.rows.length})
              </FilterChip>
              {PRIORIDADE_GRUPOS.map((g) => (
                <FilterChip key={g} active={prioFiltro === g} onClick={() => setPrioFiltro(g)}>
                  {g}
                </FilterChip>
              ))}
            </div>
            <DataTable data={drillVisible} columns={cols} pageSize={15} />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
