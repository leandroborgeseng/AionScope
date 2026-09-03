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
  CRITICIDADE_GRUPOS,
  SLA_CORRETIVA_CAMPOS,
  buildSlaCorretivaCriticidade,
  filterSlaPorCriticidade,
  filterSlaPorStatus,
  monthsFromRows,
  regraHorasPrioridade,
  rotuloFonteCriticidade,
  rotuloLimiteOrigem,
  slaCorretivaDoMes,
  type CriticidadeGrupo,
  type SlaCorretivaRow,
  type SlaStatus,
} from "@/lib/pbi/sla-corretiva-criticidade";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type CritFiltro = CriticidadeGrupo | "Todas";
type StatusFiltro = SlaStatus | "Todas" | "Com prazo";

type Drill = {
  title: string;
  subtitle?: string;
  rows: SlaCorretivaRow[];
  mesLabel?: string;
} | null;

const FICHA = FICHAS["sla-corretiva-criticidade"];

function tituloLista(drill: Drill, crit: CritFiltro, status: StatusFiltro) {
  if (!drill) return undefined;
  const parts: string[] = [];
  if (drill.mesLabel) parts.push(drill.mesLabel);
  if (crit !== "Todas") parts.push(crit);
  if (status !== "Todas" && status !== "Com prazo") parts.push(status);
  if (status === "Com prazo") parts.push("com prazo");
  if (!parts.length) return drill.title;
  return `Corretivas · ${parts.join(" · ")}`;
}

function badgeToneStatus(status: SlaStatus): "ok" | "danger" | "warn" | "info" {
  if (status === "Dentro do prazo") return "ok";
  if (status === "Fora do prazo") return "danger";
  if (status === "Sem atendimento") return "warn";
  return "info";
}

export function SlaCorretivaCriticidadeCard({
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
  const [critFiltro, setCritFiltro] = useState<CritFiltro>("Todas");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("Todas");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const dados = useMemo(
    () => buildSlaCorretivaCriticidade(raw, medical.items, range, medical.tags, medical.ids),
    [raw, medical.items, medical.tags, medical.ids, range],
  );

  const rowsVisiveis = useMemo(
    () => filterSlaPorCriticidade(dados.noIntervalo, critFiltro),
    [dados.noIntervalo, critFiltro],
  );

  const monthsVisiveis = useMemo(() => monthsFromRows(range, rowsVisiveis), [range, rowsVisiveis]);

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
    const comPrazo = noPrazo + foraPrazo;
    const pctNoPrazo = pct(noPrazo, comPrazo);
    return { noPrazo, foraPrazo, semPrazo, comPrazo, pctNoPrazo, pctLabel: formatPct(pctNoPrazo) };
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
      const slot = monthsVisiveis.find((m) => m.year === year && m.month === month);
      setStatusFiltro("Todas");
      setDrill({
        title: `Corretivas · ${row.name}`,
        mesLabel: row.name,
        subtitle: `${slot?.pctLabel ?? "—"} no prazo · ${slot?.noPrazo ?? 0} no prazo · ${slot?.foraPrazo ?? 0} fora · ${slot?.semPrazo ?? 0} sem prazo`,
        rows: slaCorretivaDoMes(rowsVisiveis, year, month),
      });
    },
    [monthsVisiveis, rowsVisiveis],
  );

  const openPeriodo = useCallback(
    (rows: SlaCorretivaRow[], title: string, subtitle: string, status: StatusFiltro = "Todas") => {
      setStatusFiltro(status);
      setDrill({ title, subtitle, rows });
    },
    [],
  );

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    return filterSlaPorStatus(drill.rows, statusFiltro);
  }, [drill, statusFiltro]);

  const cols: ColumnDef<SlaCorretivaRow, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    {
      accessorKey: "status",
      header: "SLA",
      cell: ({ row }) => <Badge tone={badgeToneStatus(row.original.status)}>{row.original.status}</Badge>,
    },
    {
      accessorKey: "criticidadeIndicador",
      header: "Criticidade (indica.)",
      cell: ({ row }) => (
        <span title={rotuloFonteCriticidade(row.original.fonteCriticidade)}>
          {row.original.criticidadeIndicador}
          <span className="ml-1 text-[10px] uppercase text-slate-400">
            {row.original.fonteCriticidade === "equipamento"
              ? "eq."
              : row.original.fonteCriticidade === "prioridade_os"
                ? "prio."
                : "—"}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "criticidadeEquipamentoRaw",
      header: "Crit. equipamento",
      cell: ({ row }) => row.original.criticidadeEquipamentoRaw || "—",
    },
    {
      accessorKey: "prioridadeRaw",
      header: "Prioridade OS",
      cell: ({ row }) => (
        <span title={row.original.prioridadeGrupo}>
          {row.original.prioridadeRaw}
          {row.original.prioridadeGrupo !== "Sem criticidade" ? (
            <span className="ml-1 text-[10px] text-slate-400">({row.original.prioridadeGrupo})</span>
          ) : null}
        </span>
      ),
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
      header: "Atendimento",
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
  const listaTitle = tituloLista(drill, critFiltro, statusFiltro);

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
        active={statusFiltro === "Sem prazo calculável"}
        onClick={() => setStatusFiltro("Sem prazo calculável")}
      >
        Sem prazo ({drill.rows.filter((r) => r.status === "Sem prazo calculável").length})
      </FilterChip>
      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        Abrir painel lateral
      </Button>
    </>
  ) : null;

  const table = drill ? <DataTable data={drillVisible} columns={cols} pageSize={15} /> : null;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "regra-criticidade",
      title: "Criticidade do equipamento × Prioridade da OS",
      children: (
        <div className="space-y-3 text-slate-700">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950">
            <strong>Quem manda no indicador:</strong> Criticidade do equipamento no parque quando a{" "}
            <strong>Tag</strong> casa com o cadastro e o campo Criticidade está preenchido. Se não houver match (ou
            criticidade vazia), usa-se a <strong>Prioridade da OS</strong> (Alta / Média / Baixa). Não inventamos
            criticidade.
          </p>
          <p>
            A lista de OS mostra <strong>os dois</strong> campos lado a lado. Quando divergem, a coluna “Criticidade
            (indica.)” deixa explícito se veio do equipamento ou da prioridade.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Fonte equipamento: <strong className="tabular-nums">{dados.fonteEquipamento}</strong> OS
            </li>
            <li>
              Fonte prioridade da OS: <strong className="tabular-nums">{dados.fontePrioridade}</strong> OS
            </li>
            <li>
              Sem criticidade/prioridade: <strong className="tabular-nums">{dados.fonteNenhuma}</strong> OS
            </li>
            <li>
              Divergentes (eq. ≠ prioridade, ambos preenchidos):{" "}
              <strong className="tabular-nums">{dados.divergentes.length}</strong> OS
            </li>
          </ul>
        </div>
      ),
    },
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
            Só entram OS com <strong>Tag</strong> no índice de equipamentos médicos (
            <code className="rounded bg-white px-1 py-0.5 text-xs">lib/pbi/medical.ts</code>). OS sem tag ou com tag
            não médica ficam de fora.
          </p>
          <p>
            O mês do gráfico é o mês de <strong>Abertura</strong> da OS (intervalo rolante {range.fromISO} a{" "}
            {range.toISO}).
          </p>
          <p className="text-sm text-slate-600">
            Detalhe operacional legado (SLA atendimento/solução, monitores, Pareto):{" "}
            <Link href="/corretivas" className="font-medium text-aion-blue underline-offset-2 hover:underline">
              ver /corretivas
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
            <OrigemCampo label="Endpoint">
              <span className="font-mono text-xs">GET /api/pbi/v1/listagem_analitica_das_os</span>
              <p className="mt-1 text-xs text-slate-500">via /api/pbi/os-analitico</p>
              <p className="mt-1 text-xs text-slate-500">
                Parque / Criticidade: GET /api/pbi/v1/equipamentos via /api/pbi/equipamentos
              </p>
            </OrigemCampo>
            <OrigemCampo label="Params enviados">
              <span className="font-mono text-xs">
                periodo={VOLUME_EC_PERIODO_API} · tipoManutencao={VOLUME_EC_TIPO_API} · qtdPorPagina=100000
              </span>
            </OrigemCampo>
            <OrigemCampo label="Filtro local">
              Tag médica + isCorretiva + Abertura no intervalo. Limite e criticidade resolvidos localmente.
            </OrigemCampo>
            <OrigemCampo label="Campos">
              <span className="font-mono text-xs">{SLA_CORRETIVA_CAMPOS.join(", ")}</span>
              <p className="mt-1 text-xs text-slate-500">+ Criticidade do cadastro de equipamentos (por Tag).</p>
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
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Fórmula / prazo</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>No prazo:</strong> DataDoAtendimento ≤ limite.
              </li>
              <li>
                <strong>Limite:</strong> DataLimiteDoAtendimento se preenchida; senão Abertura + horas da Prioridade (
                {regraHorasPrioridade()}).
              </li>
              <li>
                <strong>% no prazo:</strong> noPrazo ÷ (noPrazo + foraPrazo). Sem prazo calculável e sem atendimento{" "}
                <strong>não entram</strong> no denominador.
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
                Com prazo calculável: <strong className="tabular-nums">{dados.comPrazo}</strong> (
                {dados.noPrazo} no prazo · {dados.foraPrazo} fora)
              </li>
              <li>
                Sem prazo calculável: <strong className="tabular-nums">{dados.semPrazo}</strong>
              </li>
              <li>
                Sem atendimento (com limite): <strong className="tabular-nums">{dados.semAtendimento}</strong>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              % no prazo por criticidade (indicador)
            </p>
            <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Criticidade</th>
                    <th className="px-3 py-2">% no prazo</th>
                    <th className="px-3 py-2">No prazo</th>
                    <th className="px-3 py-2">Fora</th>
                    <th className="px-3 py-2">Total OS</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porCriticidade.map((row) => (
                    <tr key={row.grupo} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{row.grupo}</td>
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
                      <th className="px-3 py-2">Crit. ind.</th>
                      <th className="px-3 py-2">Prioridade</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Abertura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.exemplos.map((item) => (
                      <tr key={`${item.CodigoSerialOS}-${item.OS}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{item.OS || "—"}</td>
                        <td className="px-3 py-2">{item.criticidadeIndicador}</td>
                        <td className="px-3 py-2">{item.Prioridade || "—"}</td>
                        <td className="px-3 py-2">{item.status}</td>
                        <td className="px-3 py-2">{formatDateBR(item.aberturaDate)}</td>
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
            title="% Corretivas no prazo (por criticidade)"
            description={`Qmentum item 6 · cumprimento do tempo de atendimento corretivo · ${range.label}. Criticidade do equipamento manda quando a Tag casa no parque; senão Prioridade da OS.`}
          />
        }
        kpis={
          <>
            <KpiCard
              label="% no prazo"
              value={kpisVisiveis.pctLabel}
              hint={`${kpisVisiveis.comPrazo} OS com prazo calculável${critFiltro !== "Todas" ? ` · ${critFiltro}` : ""}`}
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
                  "Atendimento dentro do limite",
                  "Dentro do prazo",
                )
              }
            />
            <KpiCard
              label="Fora do prazo"
              value={String(kpisVisiveis.foraPrazo)}
              hint="Atendimento após o limite"
              tone={kpisVisiveis.foraPrazo > 0 ? "danger" : "neutral"}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.noPrazo === false),
                  `Fora do prazo · ${range.label}`,
                  "Atendimento depois do limite",
                  "Fora do prazo",
                )
              }
            />
            <KpiCard
              label="Sem prazo calculável"
              value={String(kpisVisiveis.semPrazo)}
              hint="Sem DataLimite e sem horas na Prioridade — fora do %"
              tone={kpisVisiveis.semPrazo > 0 ? "warn" : "neutral"}
              onClick={() =>
                openPeriodo(
                  rowsVisiveis.filter((r) => r.status === "Sem prazo calculável"),
                  `Sem prazo · ${range.label}`,
                  "Não entram no denominador do %",
                  "Sem prazo calculável",
                )
              }
            />
          </>
        }
        chart={
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={critFiltro === "Todas"} onClick={() => setCritFiltro("Todas")}>
                Todas
              </FilterChip>
              {CRITICIDADE_GRUPOS.map((g) => {
                const row = dados.porCriticidade.find((r) => r.grupo === g);
                return (
                  <FilterChip key={g} active={critFiltro === g} onClick={() => setCritFiltro(g)}>
                    {g} ({row?.total ?? 0})
                  </FilterChip>
                );
              })}
            </div>
            <ChartCard
              title={`No prazo × fora do prazo por mês · ${range.label}`}
              onExpand={openFullscreen}
              hint="Barras empilhadas com quantidade; rótulo no topo = % no prazo do mês. Clique no mês para listar as OS. Filtro de criticidade acima refiltra gráfico e KPIs."
            >
              {dados.semAtendimento > 0 ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Transparência: <strong className="tabular-nums">{dados.semAtendimento}</strong> OS corretivas no
                  período têm limite calculável mas <strong>sem DataDoAtendimento</strong> — ficam fora do % (nem no
                  prazo, nem fora). O denominador usa só as {dados.comPrazo} com atendimento + limite.
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
        title={`No prazo × fora do prazo · ${range.label}`}
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
          key={`fullscreen-sla-${range.fromISO}-${range.toISO}-${critFiltro}`}
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
            </div>
            <DataTable data={drillVisible} columns={cols} pageSize={15} />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
