"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { SlaPrazoBarChart, SimpleBarChart } from "@/components/charts/charts";
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
import { KpiCard, toneFromPct } from "@/components/kpi/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { formatDateBR } from "@/lib/pbi/dates";
import { FICHAS } from "@/lib/pbi/fichas";
import { formatPct, pct } from "@/lib/pbi/indicators";
import { BUSINESS_HOURS_LABEL } from "@/lib/pbi/business-hours";
import {
  FAIXAS_CRITICIDADE_QMENTUM,
  META_HORAS_UTEIS_POR_FAIXA,
  SLA_CRITICIDADE_CAMPOS,
  buildSlaCriticidade,
  filterSlaCriticidadePorStatus,
  filterSlaPorFaixa,
  monthsFromSlaCriticidadeRows,
  regraMetasCriticidade,
  slaCriticidadeDoMes,
  type FaixaCriticidadeQmentum,
  type SlaCriticidadeRow,
} from "@/lib/pbi/sla-criticidade";
import type { SlaAtendimentoStatus } from "@/lib/pbi/sla-primeiro-atendimento";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type FaixaFiltro = FaixaCriticidadeQmentum | "Todas";
type StatusFiltro = SlaAtendimentoStatus | "Todas" | "Com prazo";

type Drill = {
  title: string;
  subtitle?: string;
  rows: SlaCriticidadeRow[];
  mesLabel?: string;
} | null;

const FICHA = FICHAS["sla-criticidade"];

function badgeToneStatus(status: SlaAtendimentoStatus): "ok" | "danger" | "warn" | "info" {
  if (status === "Dentro do prazo") return "ok";
  if (status === "Fora do prazo") return "danger";
  if (status === "Sem 1º atendimento") return "warn";
  return "info";
}

function fmtHoras(h: number | null) {
  if (h == null) return "—";
  return `${h.toFixed(1)} h`;
}

export function SlaCriticidadeCard({
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
  const [faixaFiltro, setFaixaFiltro] = useState<FaixaFiltro>("Todas");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("Todas");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const dados = useMemo(
    () => buildSlaCriticidade(raw, range, medical.tags, medical.ids, medical.items),
    [raw, medical.tags, medical.ids, medical.items, range],
  );

  const rowsVisiveis = useMemo(
    () => filterSlaPorFaixa(dados.noIntervalo, faixaFiltro),
    [dados.noIntervalo, faixaFiltro],
  );

  const monthsVisiveis = useMemo(
    () => monthsFromSlaCriticidadeRows(range, rowsVisiveis),
    [range, rowsVisiveis],
  );

  const chartData = useMemo(
    () =>
      monthsVisiveis.map((m) => ({
        name: m.label,
        key: m.key,
        year: m.year,
        month: m.month,
        noPrazo: m.noPrazo,
        foraPrazo: m.foraPrazo,
        comPrazo: m.comPrazo,
        pctNoPrazo: m.pctNoPrazo,
        pctLabel: m.pctLabel,
      })),
    [monthsVisiveis],
  );

  const faixaChart = useMemo(
    () =>
      dados.porFaixa
        .filter((f) => f.faixa !== "Sem faixa")
        .map((f) => ({
          name: f.faixa,
          noPrazo: f.noPrazo,
          foraPrazo: f.foraPrazo,
          pctNoPrazo: f.pctNoPrazo ?? 0,
        })),
    [dados.porFaixa],
  );

  const kpisVisiveis = useMemo(() => {
    const noPrazo = rowsVisiveis.filter((r) => r.noPrazo === true).length;
    const foraPrazo = rowsVisiveis.filter((r) => r.noPrazo === false).length;
    const semPrazo = rowsVisiveis.filter((r) => r.status === "Sem prazo calculável").length;
    const semAtendimento = rowsVisiveis.filter((r) => r.status === "Sem 1º atendimento").length;
    const comPrazo = noPrazo + foraPrazo;
    const pctNoPrazo = pct(noPrazo, comPrazo);
    return {
      noPrazo,
      foraPrazo,
      semPrazo,
      semAtendimento,
      comPrazo,
      pctNoPrazo,
      pctLabel: formatPct(pctNoPrazo),
    };
  }, [rowsVisiveis]);

  const clearSelection = useCallback(() => {
    setDrill(null);
    setStatusFiltro("Todas");
    setSheetOpen(false);
  }, []);

  const openMesLista = useCallback(
    (row: { name: string; year?: string | number; month?: string | number }) => {
      const year = Number(row.year);
      const month = Number(row.month);
      const base = filterSlaPorFaixa(dados.noIntervalo, faixaFiltro);
      const doMes = slaCriticidadeDoMes(base, year, month);
      const noPrazo = doMes.filter((r) => r.noPrazo === true).length;
      const foraPrazo = doMes.filter((r) => r.noPrazo === false).length;
      const comPrazo = noPrazo + foraPrazo;
      setStatusFiltro("Todas");
      setDrill({
        title: `1º atendimento × criticidade · ${row.name}`,
        mesLabel: row.name,
        subtitle: `${formatPct(pct(noPrazo, comPrazo))} no prazo · ${noPrazo} no prazo · ${foraPrazo} fora`,
        rows: doMes,
      });
    },
    [dados.noIntervalo, faixaFiltro],
  );

  const openPeriodo = useCallback(
    (rows: SlaCriticidadeRow[], title: string, subtitle: string, status: StatusFiltro = "Todas") => {
      setStatusFiltro(status);
      setDrill({ title, subtitle, rows });
    },
    [],
  );

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    return filterSlaCriticidadePorStatus(drill.rows, statusFiltro);
  }, [drill, statusFiltro]);

  const cols: ColumnDef<SlaCriticidadeRow, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    {
      accessorKey: "status",
      header: "SLA",
      cell: ({ row }) => <Badge tone={badgeToneStatus(row.original.status)}>{row.original.status}</Badge>,
    },
    { accessorKey: "faixa", header: "Faixa" },
    { accessorKey: "criticidadeRaw", header: "Criticidade (API)" },
    {
      id: "meta",
      header: "Meta (h úteis)",
      cell: ({ row }) => (row.original.metaHorasUteis != null ? String(row.original.metaHorasUteis) : "—"),
    },
    {
      id: "horas",
      header: "Horas úteis",
      cell: ({ row }) => fmtHoras(row.original.horasUteisAteAtendimento),
    },
    { accessorKey: "Tag", header: "Tag" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    {
      accessorKey: "Abertura",
      header: "Abertura",
      cell: ({ row }) => formatDateBR(row.original.aberturaDate),
    },
    {
      accessorKey: "DataDoAtendimento",
      header: "1º atendimento",
      cell: ({ row }) => formatDateBR(row.original.atendimentoDate),
    },
  ];

  const waiting = loading || medical.loading;
  const medicalError =
    medical.error ?? (!medical.loading && !medical.ready ? "Índice de equipamentos médicos indisponível." : null);
  const blockError = error || medicalError;
  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;

  const filtros = drill ? (
    <>
      <FilterChip active={statusFiltro === "Todas"} onClick={() => setStatusFiltro("Todas")}>
        Todas ({drill.rows.length})
      </FilterChip>
      <FilterChip active={statusFiltro === "Dentro do prazo"} onClick={() => setStatusFiltro("Dentro do prazo")}>
        No prazo
      </FilterChip>
      <FilterChip active={statusFiltro === "Fora do prazo"} onClick={() => setStatusFiltro("Fora do prazo")}>
        Fora
      </FilterChip>
      <FilterChip
        active={statusFiltro === "Sem 1º atendimento"}
        onClick={() => setStatusFiltro("Sem 1º atendimento")}
      >
        Sem 1º atendimento
      </FilterChip>
      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        Abrir painel lateral
      </Button>
    </>
  ) : null;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "evento",
      title: "Evento = DataDoAtendimento · metas por criticidade",
      children: (
        <div className="space-y-3 text-slate-700">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950">
            Prazo mede se a <strong>DataDoAtendimento</strong> ocorreu dentro da meta em{" "}
            <strong>horas úteis</strong>. <strong>Não</strong> usa Fechamento.
          </p>
          <p>
            Metas default (editáveis depois): {regraMetasCriticidade()}.
          </p>
          <p>
            Mapeamento do parque: ALTA/CRÍTICO → Crítico ({META_HORAS_UTEIS_POR_FAIXA.Crítico}h); MÉDIA/SEMICRÍTICO →
            Semicrítico ({META_HORAS_UTEIS_POR_FAIXA.Semicrítico}h); BAIXA/NÃO CRÍTICO → Não crítico (
            {META_HORAS_UTEIS_POR_FAIXA["Não crítico"]}h).
          </p>
          <p>
            Indicador por Prioridade da OS permanece em{" "}
            <Link href="/indicadores/sla-primeiro-atendimento" className="font-medium text-aion-blue underline-offset-2 hover:underline">
              % 1º atendimento no prazo
            </Link>
            .
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
            <OrigemCampo label="Endpoint OS">
              <span className="font-mono text-xs">GET /api/pbi/os-analitico</span>
              <p className="mt-1 text-xs text-slate-500">
                periodo={VOLUME_EC_PERIODO_API} · tipoManutencao={VOLUME_EC_TIPO_API}
              </p>
            </OrigemCampo>
            <OrigemCampo label="Criticidade">
              Cadastro de equipamentos (join por Tag). Campos:{" "}
              <span className="font-mono text-xs">{SLA_CRITICIDADE_CAMPOS.join(", ")}</span>
            </OrigemCampo>
            <OrigemCampo label="Horas úteis">{BUSINESS_HOURS_LABEL}</OrigemCampo>
            <OrigemCampo label="Quantidade bruta / após filtro" valueClassName="mt-1 text-sm font-semibold tabular-nums">
              {bruta} brutas · {dados.aposCorretiva.length} corretivas médicas · {dados.noIntervalo.length} no
              intervalo
            </OrigemCampo>
          </dl>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Criticidades observadas na API (amostra do período)
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {dados.criticidadesRawObservadas.slice(0, 12).map((c) => (
                <li key={c.name}>
                  <span className="font-medium">{c.name}</span> · {c.count}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">% por faixa</p>
            <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Faixa</th>
                    <th className="px-3 py-2">Meta</th>
                    <th className="px-3 py-2">% no prazo</th>
                    <th className="px-3 py-2">No prazo</th>
                    <th className="px-3 py-2">Fora</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porFaixa.map((row) => (
                    <tr key={row.faixa} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{row.faixa}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.metaHorasUteis != null ? `${row.metaHorasUteis}h` : "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{row.pctLabel}</td>
                      <td className="px-3 py-2 tabular-nums">{row.noPrazo}</td>
                      <td className="px-3 py-2 tabular-nums">{row.foraPrazo}</td>
                      <td className="px-3 py-2 tabular-nums">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            title="% 1º atendimento × criticidade do equipamento"
            description={`QMentum · DataDoAtendimento em horas úteis · ${range.label}. Metas default: ${regraMetasCriticidade()}.`}
          />
        }
        kpis={
          <>
            <KpiCard
              label="% no prazo"
              value={kpisVisiveis.pctLabel}
              hint={`${kpisVisiveis.comPrazo} OS com 1º atendimento + faixa`}
              tone={toneFromPct(kpisVisiveis.pctNoPrazo)}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.noPrazo != null),
                  `% no prazo · ${range.label}`,
                  "Com DataDoAtendimento e faixa mapeada",
                  "Com prazo",
                )
              }
            />
            <KpiCard
              label="No prazo"
              value={String(kpisVisiveis.noPrazo)}
              hint="Horas úteis ≤ meta da faixa"
              tone="ok"
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.noPrazo === true),
                  `No prazo · ${range.label}`,
                  "Dentro da meta",
                  "Dentro do prazo",
                )
              }
            />
            <KpiCard
              label="Fora do prazo"
              value={String(kpisVisiveis.foraPrazo)}
              hint="Acima da meta em horas úteis"
              tone={kpisVisiveis.foraPrazo > 0 ? "danger" : "neutral"}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.noPrazo === false),
                  `Fora · ${range.label}`,
                  "Acima da meta",
                  "Fora do prazo",
                )
              }
            />
            <KpiCard
              label="Sem 1º atendimento"
              value={String(kpisVisiveis.semAtendimento)}
              hint="Fora do denominador do %"
              tone={kpisVisiveis.semAtendimento > 0 ? "warn" : "neutral"}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.status === "Sem 1º atendimento"),
                  `Sem 1º atendimento · ${range.label}`,
                  "Fechamento não conta",
                  "Sem 1º atendimento",
                )
              }
            />
          </>
        }
        chart={
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={faixaFiltro === "Todas"} onClick={() => setFaixaFiltro("Todas")}>
                Todas
              </FilterChip>
              {FAIXAS_CRITICIDADE_QMENTUM.map((g) => {
                const row = dados.porFaixa.find((r) => r.faixa === g);
                return (
                  <FilterChip key={g} active={faixaFiltro === g} onClick={() => setFaixaFiltro(g)}>
                    {g} ({row?.pctLabel ?? "—"} · {row?.total ?? 0})
                  </FilterChip>
                );
              })}
            </div>
            <ChartCard
              title={`% no prazo por mês · ${range.label}`}
              onExpand={openFullscreen}
              hint="Barras no prazo × fora. Clique no mês para listar."
            >
              <SlaPrazoBarChart data={chartData} xKey="name" onRowClick={openMesLista} />
            </ChartCard>
            <ChartCard title="% no prazo por faixa (período)" hint="Só faixas com meta (exclui Sem faixa).">
              <SimpleBarChart
                data={faixaChart.map((r) => ({
                  name: r.name,
                  "% no prazo": Math.round((r.pctNoPrazo ?? 0) * 10) / 10,
                }))}
                xKey="name"
                yKey="% no prazo"
                color="#0168b0"
              />
            </ChartCard>
          </div>
        }
        selectionList={
          <SelecaoOsLista
            hasSelection={!!drill}
            title={drill?.title}
            subtitle={drill?.subtitle}
            emptyHint="Clique em um mês no gráfico (ou em um KPI) para listar as OS."
            onClear={clearSelection}
            filters={filtros}
          >
            {drill ? <DataTable data={drillVisible} columns={cols} pageSize={15} /> : null}
          </SelecaoOsLista>
        }
      />

      <ChartFullscreenDialog
        open={open}
        title={`SLA criticidade · ${range.label}`}
        onClose={closeFullscreen}
        ready={ready}
      >
        <SlaPrazoBarChart
          key={`fs-sla-crit-${range.fromISO}-${faixaFiltro}`}
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

      <Sheet open={sheetOpen && !!drill} title={drill?.title ?? ""} subtitle={drill?.subtitle} onClose={() => setSheetOpen(false)}>
        {drill ? <DataTable data={drillVisible} columns={cols} pageSize={15} /> : null}
      </Sheet>
    </>
  );
}
