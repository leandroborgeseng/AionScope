"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { SlaPrazoBarChart } from "@/components/charts/charts";
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
import {
  PRIORIDADE_GRUPOS,
  SLA_PRIMEIRO_ATENDIMENTO_CAMPOS,
  buildSlaPrimeiroAtendimento,
  filterSlaPorPrioridade,
  filterSlaPorStatus,
  monthsFromSlaRows,
  regraHorasPrioridade,
  rotuloLimiteOrigem,
  slaDoMes,
  type PrioridadeGrupo,
  type SlaAtendimentoStatus,
  type SlaPrimeiroAtendimentoRow,
} from "@/lib/pbi/sla-primeiro-atendimento";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type PrioFiltro = PrioridadeGrupo | "Todas";
type StatusFiltro = SlaAtendimentoStatus | "Todas" | "Com prazo";

type Drill = {
  title: string;
  subtitle?: string;
  rows: SlaPrimeiroAtendimentoRow[];
  mesLabel?: string;
} | null;

const FICHA = FICHAS["sla-primeiro-atendimento"];

function tituloLista(drill: Drill, prio: PrioFiltro, status: StatusFiltro) {
  if (!drill) return undefined;
  const parts: string[] = [];
  if (drill.mesLabel) parts.push(drill.mesLabel);
  if (prio !== "Todas") parts.push(prio);
  if (status !== "Todas" && status !== "Com prazo") parts.push(status);
  if (status === "Com prazo") parts.push("com 1º atendimento + limite");
  if (!parts.length) return drill.title;
  return `1º atendimento · ${parts.join(" · ")}`;
}

function badgeToneStatus(status: SlaAtendimentoStatus): "ok" | "danger" | "warn" | "info" {
  if (status === "Dentro do prazo") return "ok";
  if (status === "Fora do prazo") return "danger";
  if (status === "Sem 1º atendimento") return "warn";
  return "info";
}

export function SlaPrimeiroAtendimentoCard({
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
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("Todas");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const dados = useMemo(
    () => buildSlaPrimeiroAtendimento(raw, range, medical.tags, medical.ids),
    [raw, medical.tags, medical.ids, range],
  );

  const rowsVisiveis = useMemo(
    () => filterSlaPorPrioridade(dados.noIntervalo, prioFiltro),
    [dados.noIntervalo, prioFiltro],
  );

  const monthsVisiveis = useMemo(() => monthsFromSlaRows(range, rowsVisiveis), [range, rowsVisiveis]);

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
      const base = filterSlaPorPrioridade(dados.noIntervalo, prioFiltro);
      const doMes = slaDoMes(base, year, month);
      const noPrazo = doMes.filter((r) => r.noPrazo === true).length;
      const foraPrazo = doMes.filter((r) => r.noPrazo === false).length;
      const semAtendimento = doMes.filter((r) => r.status === "Sem 1º atendimento").length;
      const comPrazo = noPrazo + foraPrazo;
      const pctLabel = formatPct(pct(noPrazo, comPrazo));
      setStatusFiltro("Todas");
      setDrill({
        title: `1º atendimento · ${row.name}`,
        mesLabel: row.name,
        subtitle: `${pctLabel} no prazo · ${noPrazo} no prazo · ${foraPrazo} fora · ${semAtendimento} sem 1º atendimento`,
        rows: doMes,
      });
    },
    [dados.noIntervalo, prioFiltro],
  );

  const openPeriodo = useCallback(
    (rows: SlaPrimeiroAtendimentoRow[], title: string, subtitle: string, status: StatusFiltro = "Todas") => {
      setStatusFiltro(status);
      setDrill({ title, subtitle, rows });
    },
    [],
  );

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    return filterSlaPorStatus(drill.rows, statusFiltro);
  }, [drill, statusFiltro]);

  const cols: ColumnDef<SlaPrimeiroAtendimentoRow, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    {
      accessorKey: "status",
      header: "SLA 1º atendimento",
      cell: ({ row }) => <Badge tone={badgeToneStatus(row.original.status)}>{row.original.status}</Badge>,
    },
    {
      accessorKey: "prioridadeGrupo",
      header: "Prioridade",
      cell: ({ row }) => row.original.prioridadeGrupo,
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
    {
      accessorKey: "DataDoAtendimento",
      header: "1º atendimento",
      cell: ({ row }) => formatDateBR(row.original.atendimentoDate),
    },
    {
      id: "limite",
      header: "Limite",
      cell: ({ row }) => (
        <span title={rotuloLimiteOrigem(row.original.limiteOrigem)}>
          {formatDateBR(row.original.limiteDate)}
          <span className="ml-1 text-[10px] text-slate-400">{row.original.limiteOrigem}</span>
        </span>
      ),
    },
  ];

  const waiting = loading || medical.loading;
  const medicalError =
    medical.error ?? (!medical.loading && !medical.ready ? "Índice de equipamentos médicos indisponível." : null);
  const blockError = error || medicalError;

  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;
  const listaTitle = tituloLista(drill, prioFiltro, statusFiltro);

  const filters = drill ? (
    <>
      <FilterChip active={statusFiltro === "Todas"} onClick={() => setStatusFiltro("Todas")}>
        Todas ({drill.rows.length})
      </FilterChip>
      <FilterChip active={statusFiltro === "Dentro do prazo"} onClick={() => setStatusFiltro("Dentro do prazo")}>
        No prazo ({drill.rows.filter((r) => r.noPrazo === true).length})
      </FilterChip>
      <FilterChip active={statusFiltro === "Fora do prazo"} onClick={() => setStatusFiltro("Fora do prazo")}>
        Fora ({drill.rows.filter((r) => r.noPrazo === false).length})
      </FilterChip>
      <FilterChip
        active={statusFiltro === "Sem 1º atendimento"}
        onClick={() => setStatusFiltro("Sem 1º atendimento")}
      >
        Sem 1º atendimento ({drill.rows.filter((r) => r.status === "Sem 1º atendimento").length})
      </FilterChip>
      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        Abrir painel lateral
      </Button>
    </>
  ) : null;

  const table = drill ? <DataTable data={drillVisible} columns={cols} pageSize={15} /> : null;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "evento",
      title: "Evento de prazo = somente 1º atendimento",
      children: (
        <div className="space-y-3 text-slate-700">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950">
            O prazo mede se a <strong>DataDoAtendimento</strong> (1º atendimento) ocorreu até o limite.{" "}
            <strong>Não</strong> usa Fechamento nem DataDaSolucao como evento de SLA.
          </p>
          <p>
            Limite: <strong>DataLimiteDoAtendimento</strong> se preenchida; senão Abertura + horas da Prioridade (
            {regraHorasPrioridade()}). Na prática a API costuma deixar DataLimite vazia — o fallback por Prioridade
            domina.
          </p>
          <p>
            OS com limite mas sem DataDoAtendimento ficam em <strong>Sem 1º atendimento</strong> (fora do denominador
            do %). Fechamento sozinho não “salva” o SLA.
          </p>
        </div>
      ),
    },
    {
      id: "recorte",
      title: "Recorte: corretivas de equipamentos médicos",
      children: (
        <div className="space-y-3 text-slate-700">
          <p>
            Mesma regra de <code className="rounded bg-white px-1 py-0.5 text-xs">isCorretiva</code> + Tag no índice
            médico. Quebra por <strong>Prioridade da OS</strong> (não criticidade do parque).
          </p>
          <p>
            Volume sem prazo:{" "}
            <Link
              href="/indicadores/corretivas-por-prioridade"
              className="font-medium text-aion-blue underline-offset-2 hover:underline"
            >
              Corretivas por prioridade
            </Link>
            .
          </p>
          <p>
            Mês do gráfico = mês de <strong>Abertura</strong> ({range.fromISO} a {range.toISO}).
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
              Tag médica + isCorretiva + Abertura no intervalo. Prazo só com DataDoAtendimento × limite.
            </OrigemCampo>
            <OrigemCampo label="Campos">
              <span className="font-mono text-xs">{SLA_PRIMEIRO_ATENDIMENTO_CAMPOS.join(", ")}</span>
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
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Fórmula</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>No prazo:</strong> DataDoAtendimento ≤ limite.
              </li>
              <li>
                <strong>% no prazo:</strong> noPrazo ÷ (noPrazo + foraPrazo). Sem 1º atendimento e sem prazo calculável
                não entram no denominador.
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Funil (honestidade)</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Sem tag / fora do índice médico:{" "}
                <strong className="tabular-nums">{dados.semTag.length + dados.tagForaDoIndice.length}</strong>
              </li>
              <li>
                Com 1º atendimento + limite: <strong className="tabular-nums">{dados.comPrazo}</strong> (
                {dados.noPrazo} no prazo · {dados.foraPrazo} fora)
              </li>
              <li>
                Sem 1º atendimento (com limite): <strong className="tabular-nums">{dados.semAtendimento}</strong>
              </li>
              <li>
                Sem prazo calculável: <strong className="tabular-nums">{dados.semPrazo}</strong>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              % no prazo por prioridade
            </p>
            <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Prioridade</th>
                    <th className="px-3 py-2">% no prazo</th>
                    <th className="px-3 py-2">No prazo</th>
                    <th className="px-3 py-2">Fora</th>
                    <th className="px-3 py-2">Sem 1º atend.</th>
                    <th className="px-3 py-2">Total OS</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porPrioridade.map((row) => (
                    <tr key={row.grupo} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{row.grupo}</td>
                      <td className="px-3 py-2 tabular-nums">{row.pctLabel}</td>
                      <td className="px-3 py-2 tabular-nums">{row.noPrazo}</td>
                      <td className="px-3 py-2 tabular-nums">{row.foraPrazo}</td>
                      <td className="px-3 py-2 tabular-nums">{row.semAtendimento}</td>
                      <td className="px-3 py-2 tabular-nums">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Exemplos ({dados.exemplos.length} OS)
            </p>
            {dados.exemplos.length === 0 ? (
              <p className="text-slate-500">Nenhuma corretiva médica no intervalo.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">OS</th>
                      <th className="px-3 py-2">Prioridade</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">1º atendimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.exemplos.map((item) => (
                      <tr key={`${item.CodigoSerialOS}-${item.OS}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{item.OS || "—"}</td>
                        <td className="px-3 py-2">{item.prioridadeGrupo}</td>
                        <td className="px-3 py-2">{item.status}</td>
                        <td className="px-3 py-2">{formatDateBR(item.atendimentoDate)}</td>
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
        loading={waiting}
        error={blockError}
        ficha={FICHA}
        detalhesItems={detalhesItems}
        heading={
          <Heading
            title="% 1º atendimento no prazo (por prioridade)"
            description={`SLA do primeiro atendimento corretivo (DataDoAtendimento ≤ limite) · ${range.label}. Não usa Fechamento. Quebra por Prioridade da OS.`}
          />
        }
        kpis={
          <>
            <KpiCard
              label="% no prazo"
              value={kpisVisiveis.pctLabel}
              hint={`${kpisVisiveis.comPrazo} OS com 1º atendimento + limite${prioFiltro !== "Todas" ? ` · ${prioFiltro}` : ""}`}
              tone={toneFromPct(kpisVisiveis.pctNoPrazo)}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.noPrazo != null),
                  `% no prazo · ${range.label}`,
                  "OS com DataDoAtendimento e limite calculável",
                  "Com prazo",
                )
              }
            />
            <KpiCard
              label="No prazo"
              value={String(kpisVisiveis.noPrazo)}
              hint="DataDoAtendimento ≤ limite"
              tone="ok"
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.noPrazo === true),
                  `No prazo · ${range.label}`,
                  "1º atendimento dentro do limite",
                  "Dentro do prazo",
                )
              }
            />
            <KpiCard
              label="Fora do prazo"
              value={String(kpisVisiveis.foraPrazo)}
              hint="1º atendimento após o limite"
              tone={kpisVisiveis.foraPrazo > 0 ? "danger" : "neutral"}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.noPrazo === false),
                  `Fora do prazo · ${range.label}`,
                  "1º atendimento depois do limite",
                  "Fora do prazo",
                )
              }
            />
            <KpiCard
              label="Sem 1º atendimento"
              value={String(kpisVisiveis.semAtendimento)}
              hint="Com limite, sem DataDoAtendimento — fora do %"
              tone={kpisVisiveis.semAtendimento > 0 ? "warn" : "neutral"}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.status === "Sem 1º atendimento"),
                  `Sem 1º atendimento · ${range.label}`,
                  "Não entram no denominador do % (Fechamento não conta)",
                  "Sem 1º atendimento",
                )
              }
            />
          </>
        }
        chart={
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={prioFiltro === "Todas"} onClick={() => setPrioFiltro("Todas")}>
                Todas
              </FilterChip>
              {PRIORIDADE_GRUPOS.map((g) => {
                const row = dados.porPrioridade.find((r) => r.grupo === g);
                return (
                  <FilterChip key={g} active={prioFiltro === g} onClick={() => setPrioFiltro(g)}>
                    {g} ({row?.pctLabel ?? "—"} · {row?.total ?? 0})
                  </FilterChip>
                );
              })}
            </div>
            <ChartCard
              title={`1º atendimento no prazo × fora · ${range.label}`}
              onExpand={openFullscreen}
              hint="Barras empilhadas com quantidade; rótulo = % no prazo do mês (só OS com DataDoAtendimento + limite). Clique no mês para listar."
            >
              {dados.semAtendimento > 0 ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Transparência: <strong className="tabular-nums">{dados.semAtendimento}</strong> OS corretivas no
                  período têm limite calculável mas <strong>sem DataDoAtendimento</strong> — ficam fora do % (nem no
                  prazo, nem fora). Fechamento sozinho não entra. Denominador: {dados.comPrazo} OS.
                </p>
              ) : null}
              <SlaPrazoBarChart data={chartData} xKey="name" onRowClick={openMesLista} />
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
        title={`1º atendimento no prazo · ${range.label}`}
        subtitle="Mesmo gráfico, em tela cheia. Clique no mês para ver a lista na página."
        onClose={closeFullscreen}
        ready={ready}
        chips={
          <>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-slate-600">
              % no prazo <strong className="tabular-nums text-emerald-800">{kpisVisiveis.pctLabel}</strong>
            </span>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              No prazo <strong className="tabular-nums text-slate-900">{kpisVisiveis.noPrazo}</strong>
            </span>
            <span className="rounded-md bg-rose-50 px-2.5 py-1 text-slate-600">
              Fora <strong className="tabular-nums text-rose-800">{kpisVisiveis.foraPrazo}</strong>
            </span>
          </>
        }
      >
        <SlaPrazoBarChart
          key={`fullscreen-sla-atend-${range.fromISO}-${range.toISO}-${prioFiltro}`}
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
            </div>
            <DataTable data={drillVisible} columns={cols} pageSize={15} />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
