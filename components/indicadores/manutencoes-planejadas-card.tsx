"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SaldoStackBarChart } from "@/components/charts/charts";
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
import { formatDateBR } from "@/lib/pbi/dates";
import { FICHAS } from "@/lib/pbi/fichas";
import {
  MANUT_PLANEJADAS_CAMPOS_CRONO,
  MANUT_PLANEJADAS_CAMPOS_OS,
  TAG_CONFIAVEL_MIN,
  buildManutencoesPlanejadasExecutadas,
  fraseSaldo,
  manutDoMes,
  manutDoPeriodo,
  rotuloSaldo,
  type ManutListaOrigem,
  type ManutListaRow,
} from "@/lib/pbi/manutencoes-planejadas";
import type { CronogramaItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type OrigemFiltro = ManutListaOrigem | "Todas";

type Drill = {
  title: string;
  subtitle?: string;
  rows: ManutListaRow[];
  mesLabel?: string;
} | null;

const FICHA = FICHAS["manutencoes-planejadas-executadas"];

const SALDO_LABELS = { entrada: "Planejado", execucao: "Executado" } as const;

function tituloLista(drill: Drill, filtro: OrigemFiltro) {
  if (!drill) return undefined;
  if (drill.mesLabel) {
    if (filtro === "Planejada") return `Planejadas de ${drill.mesLabel}`;
    if (filtro === "Executada") return `Executadas de ${drill.mesLabel}`;
    return `Planejadas e executadas · ${drill.mesLabel}`;
  }
  return drill.title;
}

export function ManutencoesPlanejadasCard({
  range,
  cronograma,
  os,
  brutaOs,
  brutaCronograma,
  loading,
  error,
  headingAs = "section",
}: {
  range: RollingYearRange;
  cronograma: CronogramaItem[];
  os: OsAnaliticoItem[];
  brutaOs: number;
  brutaCronograma: number;
  loading: boolean;
  error: string | null;
  headingAs?: "page" | "section";
}) {
  const [drill, setDrill] = useState<Drill>(null);
  const [origemFiltro, setOrigemFiltro] = useState<OrigemFiltro>("Todas");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const dados = useMemo(
    () => buildManutencoesPlanejadasExecutadas(cronograma, os, range),
    [cronograma, os, range],
  );

  const chartData = useMemo(
    () =>
      dados.months.map((m) => ({
        name: m.label,
        key: m.key,
        year: m.year,
        month: m.month,
        abertas: m.planejado,
        fechadas: m.executado,
        planejado: m.planejado,
        executado: m.executado,
        coberto: m.coberto,
        deficit: m.deficit,
        superavit: m.superavit,
        saldo: m.saldo,
        saldoLabel: m.saldo === 0 ? "" : rotuloSaldo(m.saldo),
      })),
    [dados.months],
  );

  const clearSelection = useCallback(() => {
    setDrill(null);
    setOrigemFiltro("Todas");
    setSheetOpen(false);
  }, []);

  const openMesLista = useCallback(
    (row: { name: string; year?: string | number; month?: string | number }) => {
      const year = Number(row.year);
      const month = Number(row.month);
      const slot = dados.months.find((m) => m.year === year && m.month === month);
      const { todas } = manutDoMes(dados, year, month);
      setOrigemFiltro("Todas");
      setDrill({
        title: `Manutenções · ${row.name}`,
        mesLabel: row.name,
        subtitle: `${slot?.planejado ?? 0} planejado · ${slot?.executado ?? 0} executado · ${fraseSaldo(slot?.saldo ?? 0)}`,
        rows: todas,
      });
    },
    [dados],
  );

  const openPeriodo = useCallback(
    (tipo: "planejada" | "executada" | "todas", title: string, subtitle: string) => {
      const pack = manutDoPeriodo(dados);
      setOrigemFiltro(tipo === "planejada" ? "Planejada" : tipo === "executada" ? "Executada" : "Todas");
      setDrill({
        title,
        subtitle,
        rows: tipo === "planejada" ? pack.planejadas : tipo === "executada" ? pack.executadas : pack.todas,
      });
    },
    [dados],
  );

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    if (origemFiltro === "Todas") return drill.rows;
    return drill.rows.filter((row) => row.origem === origemFiltro);
  }, [drill, origemFiltro]);

  const cols: ColumnDef<ManutListaRow, unknown>[] = [
    {
      accessorKey: "origem",
      header: "Origem",
      cell: ({ row }) => (
        <Badge tone={row.original.origem === "Executada" ? "ok" : "info"}>{row.original.origem}</Badge>
      ),
    },
    { accessorKey: "identificacao", header: "Identificação" },
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ row }) => <span title={row.original.tipoRaw}>{row.original.tipo}</span>,
    },
    { accessorKey: "setorTag", header: "Setor / Tag" },
    { accessorKey: "data", header: "Data" },
  ];

  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;
  const listaTitle = tituloLista(drill, origemFiltro);
  const modoLabel =
    dados.modo === "tag"
      ? `Tag presente em ${Math.round(dados.pctComTag * 100)}% das linhas — lista pode correlacionar por Tag+tipo; gráfico usa contagem independente`
      : `Tag em apenas ${Math.round(dados.pctComTag * 100)}% das linhas (< ${Math.round(TAG_CONFIAVEL_MIN * 100)}%) — contagem independente (cronograma × OS do tipo)`;

  const filters = drill ? (
    <>
      <FilterChip active={origemFiltro === "Todas"} onClick={() => setOrigemFiltro("Todas")}>
        Todas ({drill.rows.length})
      </FilterChip>
      <FilterChip active={origemFiltro === "Planejada"} onClick={() => setOrigemFiltro("Planejada")}>
        Planejadas ({drill.rows.filter((r) => r.origem === "Planejada").length})
      </FilterChip>
      <FilterChip active={origemFiltro === "Executada"} onClick={() => setOrigemFiltro("Executada")}>
        Executadas ({drill.rows.filter((r) => r.origem === "Executada").length})
      </FilterChip>
      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        Abrir painel lateral
      </Button>
    </>
  ) : null;

  const table = drill ? <DataTable data={drillVisible} columns={cols} pageSize={15} /> : null;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "origem",
      title: "De onde vêm os dados",
      children: (
        <div className="space-y-4 text-slate-700">
          <dl className="grid gap-3 sm:grid-cols-2">
            <OrigemCampo label="Endpoints">
              <span className="font-mono text-xs">GET /api/pbi/v1/cronograma</span>
              <p className="mt-1 text-xs text-slate-500">via /api/pbi/cronograma</p>
              <span className="mt-2 block font-mono text-xs">GET /api/pbi/v1/listagem_analitica_das_os</span>
              <p className="mt-1 text-xs text-slate-500">via /api/pbi/os-analitico</p>
            </OrigemCampo>
            <OrigemCampo label="Params enviados">
              <span className="font-mono text-xs">
                cronograma: dataInicio/dataFim do intervalo · OS: periodo={VOLUME_EC_PERIODO_API} ·
                tipoManutencao={VOLUME_EC_TIPO_API} · qtdPorPagina=100000
              </span>
            </OrigemCampo>
            <OrigemCampo label="Filtro local">
              Tipos Preventiva, Calibração e TSE (classifyPlanoEc / keepCronogramaPlano). Intervalo {range.fromISO} a{" "}
              {range.toISO}.
            </OrigemCampo>
            <OrigemCampo label="Campos">
              <p className="font-mono text-xs">Cronograma: {MANUT_PLANEJADAS_CAMPOS_CRONO.join(", ")}</p>
              <p className="mt-1 font-mono text-xs">OS: {MANUT_PLANEJADAS_CAMPOS_OS.join(", ")}</p>
            </OrigemCampo>
            <OrigemCampo label="Quantidade bruta (API)" valueClassName="mt-1 text-sm font-semibold tabular-nums">
              Cronograma {brutaCronograma} · OS {brutaOs}
            </OrigemCampo>
            <OrigemCampo label="Após filtro" valueClassName="mt-1 text-sm font-semibold tabular-nums leading-relaxed">
              {dados.cronogramaPlano.length} linhas de plano · {dados.osPlano.length} OS do tipo ·{" "}
              {dados.totalPlanejado} planejado no intervalo · {dados.totalExecutado} executado
            </OrigemCampo>
          </dl>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            <p className="text-xs font-semibold uppercase tracking-wide">Critério de match (honesto)</p>
            <p className="mt-1 text-sm">{modoLabel}</p>
            <p className="mt-2 text-sm">
              O gráfico e os KPIs <strong>não pareiam</strong> linha a linha cronograma↔OS. Planejado conta
              ocorrências do cronograma no mês; executado conta OS fechadas do mesmo tipo no mês. Assim o
              superávit (executou além do plano) aparece com clareza.
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Como contar</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Planejado no mês:</strong> ProximaRealizacao (YYYYMMDD[+d] ou YYYYMM+id com dia inválido →
                1º do mês) ou DataDaUltima + Perioridicade → meses previstos no intervalo (mesmo motor do
                cronograma anual).
              </li>
              <li>
                <strong>Executado no mês:</strong> OS com Fechamento (ou DataDaSolucao se vazio) naquele mês e tipo
                Preventiva / Calibração / TSE.
              </li>
              <li>
                <strong>Coberto</strong> = min(planejado, executado); <strong>déficit</strong> = planejado −
                executado (se positivo); <strong>superávit</strong> = executado − planejado (se positivo).
              </li>
            </ul>
          </div>

          {dados.semDataPlanejada > 0 ? (
            <p className="text-sm text-slate-600">
              {dados.semDataPlanejada} linha(s) do cronograma sem ProximaRealizacao/DataDaUltima parseável — não
              entram no planejado.
            </p>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Exemplos cronograma ({dados.exemplosCronograma.length})
            </p>
            {dados.exemplosCronograma.length === 0 ? (
              <p className="text-slate-500">Nenhuma linha de plano no recorte.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Tag</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Próxima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.exemplosCronograma.map((item, idx) => (
                      <tr
                        key={`${item.Tag}-${item.TipoDeManutencao}-${item.ProximaRealizacao}-${idx}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-2 font-medium">{item.Tag || "—"}</td>
                        <td className="px-3 py-2">{item.TipoDeManutencao || "—"}</td>
                        <td className="px-3 py-2">{formatDateBR(item.ProximaRealizacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Exemplos OS executadas ({dados.exemplosOs.length})
            </p>
            {dados.exemplosOs.length === 0 ? (
              <p className="text-slate-500">Nenhuma OS do tipo no intervalo.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">OS</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Tag</th>
                      <th className="px-3 py-2">Fechamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.exemplosOs.map((item) => (
                      <tr key={`${item.CodigoSerialOS}-${item.OS}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{item.OS || "—"}</td>
                        <td className="px-3 py-2">{item.TipoDeManutencao || "—"}</td>
                        <td className="px-3 py-2">{item.Tag || "—"}</td>
                        <td className="px-3 py-2">{formatDateBR(item.Fechamento || item.DataDaSolucao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <IndicadorPageLayout
        loading={loading}
        error={error}
        ficha={FICHA}
        detalhesItems={detalhesItems}
        heading={
          <Heading
            title="Manutenções planejadas × executadas"
            description={`Preventivas, calibrações e TSE · ${range.label}. Planejado no cronograma × OS fechadas do mesmo tipo — gap mês a mês (coberto, déficit e superávit).`}
          />
        }
        kpis={
          <>
            <KpiCard
              label="Planejado no período"
              value={String(dados.totalPlanejado)}
              hint="Ocorrências do cronograma (prev / calib / TSE) no intervalo"
              onClick={() =>
                openPeriodo(
                  "planejada",
                  `Planejado · ${range.label}`,
                  "Itens do cronograma com mês planejado no intervalo",
                )
              }
            />
            <KpiCard
              label="Executado no período"
              value={String(dados.totalExecutado)}
              hint="OS fechadas (Fechamento ou DataDaSolucao) do mesmo tipo"
              tone="ok"
              onClick={() =>
                openPeriodo(
                  "executada",
                  `Executado · ${range.label}`,
                  "OS preventivas / calibração / TSE com fechamento no intervalo",
                )
              }
            />
            <KpiCard
              label="Cumprimento / saldo"
              value={`${dados.cumprimentoLabel} · ${rotuloSaldo(dados.saldo)}`}
              hint={
                dados.saldo > 0
                  ? `Faltou ${dados.saldo} — planejou mais do que executou`
                  : dados.saldo < 0
                    ? `Superávit ${Math.abs(dados.saldo)} — executou além do plano`
                    : "Empate — planejado e executado iguais"
              }
              tone={dados.saldo > 0 ? "warn" : "ok"}
              onClick={() =>
                openPeriodo(
                  "todas",
                  `Planejado e executado · ${range.label}`,
                  "Lista unificada do intervalo rolante",
                )
              }
            />
          </>
        }
        chart={
          <ChartCard
            title={`Planejado × executado por mês · ${range.label}`}
            onExpand={openFullscreen}
            hint="Cada coluna empilha o volume pareado (coberto) e o saldo do mês. Clique no mês para listar planejadas e executadas abaixo."
          >
            <SaldoStackBarChart data={chartData} xKey="name" labels={SALDO_LABELS} onRowClick={openMesLista} />
          </ChartCard>
        }
        selectionList={
          <SelecaoOsLista
            hasSelection={!!drill}
            title={listaTitle}
            subtitle={drill?.subtitle}
            emptyHint="Clique em um mês…"
            onClear={clearSelection}
            filters={filters}
          >
            {table}
          </SelecaoOsLista>
        }
      />

      <ChartFullscreenDialog
        open={open}
        title={`Planejado × executado por mês · ${range.label}`}
        subtitle="Mesmo gráfico, em tela cheia. Clique no mês para ver a lista na página."
        onClose={closeFullscreen}
        ready={ready}
        chips={
          <>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              Planejado <strong className="tabular-nums text-slate-900">{dados.totalPlanejado}</strong>
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-slate-600">
              Executado <strong className="tabular-nums text-emerald-800">{dados.totalExecutado}</strong>
            </span>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              Saldo <strong className="tabular-nums text-slate-900">{rotuloSaldo(dados.saldo)}</strong>
            </span>
          </>
        }
      >
        <SaldoStackBarChart
          key={`fullscreen-manut-${range.fromISO}-${range.toISO}`}
          data={chartData}
          xKey="name"
          labels={SALDO_LABELS}
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
              <FilterChip active={origemFiltro === "Todas"} onClick={() => setOrigemFiltro("Todas")}>
                Todas ({drill.rows.length})
              </FilterChip>
              <FilterChip active={origemFiltro === "Planejada"} onClick={() => setOrigemFiltro("Planejada")}>
                Planejadas
              </FilterChip>
              <FilterChip active={origemFiltro === "Executada"} onClick={() => setOrigemFiltro("Executada")}>
                Executadas
              </FilterChip>
            </div>
            <DataTable data={drillVisible} columns={cols} pageSize={15} />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
