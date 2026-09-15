"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SaldoStackBarChart, AbertasFechadasPctChart } from "@/components/charts/charts";
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
import { FICHAS, type FichaIndicadorId } from "@/lib/pbi/fichas";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import {
  OFICINAS_VOLUME_PLANO,
  RECORTE_EC_EXCLUIR,
  RECORTE_EC_INCLUIR,
  VOLUME_EC_CAMPOS,
  VOLUME_EC_PERIODO_API,
  VOLUME_EC_TIPO_API,
  buildVolumeAbertasFechadas,
  fraseSaldo,
  osDataFechadaIndicador,
  pctExecutadaMes,
  rotuloSaldo,
  volumeEcDoMes,
  volumeEcDoPeriodo,
  type OficinaPlanoFilterKey,
  type RollingYearRange,
  type VolumeEcMovimento,
  type VolumeEcRow,
} from "@/lib/pbi/volume-ec";

type Drill = {
  title: string;
  subtitle?: string;
  rows: VolumeEcRow[];
  mesLabel?: string;
} | null;

const movimentoTone = (value: VolumeEcMovimento) => {
  if (value === "Fechada") return "ok" as const;
  if (value === "Ambas") return "info" as const;
  return "warn" as const;
};

function tituloListaVolume(drill: Drill, mesFiltro: VolumeEcMovimento | "Todas" | null) {
  if (!drill) return undefined;
  if (drill.mesLabel) {
    if (mesFiltro === "Aberta") return `OS de ${drill.mesLabel} — abertas`;
    if (mesFiltro === "Fechada") return `OS de ${drill.mesLabel} — fechadas`;
    if (mesFiltro === "Ambas") return `OS de ${drill.mesLabel} — abertas e fechadas no mês`;
    return `OS de ${drill.mesLabel}`;
  }
  return drill.title;
}

export function OsVolumeCard({
  range,
  raw,
  bruta,
  loading,
  error,
  headingAs = "section",
  oficinaEquals,
  oficinaEqualsIn,
  oficinaLabel,
  title = "OS abertas × fechadas",
  description,
  fichaId = "os-abertas-fechadas",
  oficinaFilterKey,
  onOficinaFilterChange,
}: {
  range: RollingYearRange;
  raw: OsAnaliticoItem[];
  bruta: number;
  loading: boolean;
  error: string | null;
  headingAs?: "page" | "section";
  /** Recorte por Oficina equals (normalizado). Se omitido, usa o filtro de tipo EC. */
  oficinaEquals?: string;
  /** União de oficinas (equals). Usado no total Preventiva + Calibração + Segurança elétrica. */
  oficinaEqualsIn?: string[];
  /** Nome exibido da oficina (com acento), para títulos e documentação. */
  oficinaLabel?: string;
  title?: string;
  description?: string;
  fichaId?: FichaIndicadorId;
  /** Chips Todas / Preventiva / Calibração / Segurança elétrica no topo do gráfico. */
  oficinaFilterKey?: OficinaPlanoFilterKey;
  onOficinaFilterChange?: (key: OficinaPlanoFilterKey) => void;
}) {
  const [drill, setDrill] = useState<Drill>(null);
  const [mesFiltro, setMesFiltro] = useState<VolumeEcMovimento | "Todas" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const porOficina = Boolean(oficinaEquals || oficinaEqualsIn?.length);
  const multiOficina = Boolean(!oficinaEquals && oficinaEqualsIn && oficinaEqualsIn.length > 1);
  const oficinaExibida = oficinaLabel ?? oficinaEquals ?? "Engenharia Clínica";
  const FICHA = FICHAS[fichaId];
  const showOficinaFilters = Boolean(oficinaFilterKey && onOficinaFilterChange);

  const volumeOptions = useMemo(() => {
    if (oficinaEquals) return { oficinaEquals };
    if (oficinaEqualsIn?.length) return { oficinaEqualsIn };
    return undefined;
  }, [oficinaEquals, oficinaEqualsIn]);

  const volume = useMemo(
    () => buildVolumeAbertasFechadas(raw, range, volumeOptions),
    [raw, range, volumeOptions],
  );

  const chartData = useMemo(
    () =>
      volume.months.map((m) => {
        const pct = pctExecutadaMes(m.abertas, m.fechadas);
        const pctRounded = Math.round(pct * 10) / 10;
        return {
          name: m.label,
          key: m.key,
          year: m.year,
          month: m.month,
          abertas: m.abertas,
          fechadas: m.fechadas,
          coberto: m.coberto,
          deficit: m.deficit,
          superavit: m.superavit,
          saldo: m.saldo,
          saldoLabel: m.saldo === 0 ? "" : rotuloSaldo(m.saldo),
          pctExecutada: pctRounded,
          // Sem abertas: barra 0 e label "—" (não 0%) — % indefinido.
          pctLabel:
            m.abertas <= 0
              ? "—"
              : `${pctRounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
        };
      }),
    [volume.months],
  );

  const pctPeriodo = useMemo(
    () => pctExecutadaMes(volume.totalAbertas, volume.totalFechadas),
    [volume.totalAbertas, volume.totalFechadas],
  );

  const clearSelection = useCallback(() => {
    setDrill(null);
    setMesFiltro(null);
    setSheetOpen(false);
  }, []);

  useEffect(() => {
    if (oficinaFilterKey === undefined) return;
    clearSelection();
  }, [oficinaFilterKey, clearSelection]);

  const openMesLista = useCallback(
    (row: { name: string; year?: string | number; month?: string | number; abertas?: number; fechadas?: number }) => {
      const year = Number(row.year);
      const month = Number(row.month);
      const slot = volume.months.find((m) => m.year === year && m.month === month);
      const abertas = slot?.abertas ?? Number(row.abertas) ?? 0;
      const fechadas = slot?.fechadas ?? Number(row.fechadas) ?? 0;
      const pct = pctExecutadaMes(abertas, fechadas);
      const pctTexto =
        abertas <= 0 ? "—" : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
      setMesFiltro("Todas");
      setDrill({
        title: `OS · ${row.name}`,
        mesLabel: row.name,
        subtitle: `${abertas} abertas · ${fechadas} fechadas · ${pctTexto} executada · ${fraseSaldo(slot?.saldo ?? abertas - fechadas)}`,
        rows: volumeEcDoMes(volume.aposEc, year, month),
      });
    },
    [volume.aposEc, volume.months],
  );

  const openPeriodo = useCallback(
    (tipo: "aberta" | "fechada" | "todas", title: string, subtitle: string) => {
      setMesFiltro(tipo === "aberta" ? "Aberta" : tipo === "fechada" ? "Fechada" : "Todas");
      setDrill({
        title,
        subtitle,
        rows: volumeEcDoPeriodo(volume.aposEc, range, tipo),
      });
    },
    [range, volume.aposEc],
  );

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    if (!mesFiltro || mesFiltro === "Todas") return drill.rows;
    if (mesFiltro === "Ambas") return drill.rows.filter((row) => row.movimento === "Ambas");
    return drill.rows.filter((row) => row.movimento === mesFiltro || row.movimento === "Ambas");
  }, [drill, mesFiltro]);

  const cols: ColumnDef<VolumeEcRow, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    {
      accessorKey: "movimento",
      header: "Movimento",
      cell: ({ row }) => <Badge tone={movimentoTone(row.original.movimento)}>{row.original.movimento}</Badge>,
    },
    { accessorKey: "TipoDeManutencao", header: "Tipo" },
    { accessorKey: "Oficina", header: "Oficina" },
    { accessorKey: "Abertura", header: "Abertura" },
    { accessorKey: "Fechamento", header: "Fechamento" },
    { accessorKey: "DataDaSolucao", header: "Solução" },
    { accessorKey: "SituacaoDaOS", header: "Situação" },
  ];

  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;
  const listaTitle = tituloListaVolume(drill, mesFiltro);

  const intervaloOrigemTexto = `ano civil vigente (${range.start.getFullYear()}): ${range.fromISO} a ${range.toISO} (1º de janeiro → fim do mês atual; eixo do gráfico Jan–Dez, meses futuros zerados)`;

  const defaultDescription = multiOficina
    ? `Soma das oficinas de plano (Preventiva + Calibração + Segurança elétrica) · ${range.label}.`
    : porOficina
      ? `Fluxo da oficina ${oficinaExibida} · ${range.label}. Conta abertura × fechamento nessa oficina.`
      : `Volume da oficina de Engenharia Clínica · ${range.label}. Recorte só por tipo de manutenção EC — este indicador não usa o filtro “somente eq. médicos”.`;

  const handleOficinaFilter = useCallback(
    (key: OficinaPlanoFilterKey) => {
      clearSelection();
      onOficinaFilterChange?.(key);
    },
    [clearSelection, onOficinaFilterChange],
  );

  const oficinaToolbar = showOficinaFilters ? (
    <>
      <FilterChip active={oficinaFilterKey === "todas"} onClick={() => handleOficinaFilter("todas")}>
        Todas
      </FilterChip>
      {OFICINAS_VOLUME_PLANO.map((item) => (
        <FilterChip
          key={item.filterKey}
          active={oficinaFilterKey === item.filterKey}
          onClick={() => handleOficinaFilter(item.filterKey)}
        >
          {item.chipLabel}
        </FilterChip>
      ))}
    </>
  ) : null;

  const filters = drill ? (
    <>
      <FilterChip active={!mesFiltro || mesFiltro === "Todas"} onClick={() => setMesFiltro("Todas")}>
        Todas ({drill.rows.length})
      </FilterChip>
      <FilterChip active={mesFiltro === "Aberta"} onClick={() => setMesFiltro("Aberta")}>
        Abertas
      </FilterChip>
      <FilterChip active={mesFiltro === "Fechada"} onClick={() => setMesFiltro("Fechada")}>
        Fechadas
      </FilterChip>
      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        Abrir painel lateral
      </Button>
    </>
  ) : null;

  const table = drill ? <DataTable data={drillVisible} columns={cols} pageSize={15} /> : null;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "recorte",
      title: multiOficina
        ? "Recorte oficinas de plano (total)"
        : porOficina
          ? `Recorte oficina ${oficinaExibida}`
          : "Recorte Engenharia Clínica",
      children: multiOficina ? (
        <div className="space-y-3 text-slate-700">
          <p>
            Incluir OS cujo campo <strong>Oficina</strong> é equals (texto normalizado) a uma destas três:{" "}
            <span className="font-mono text-xs">PREVENTIVA EQUIPAMENTOS</span>,{" "}
            <span className="font-mono text-xs">CALIBRAÇÃO DE EQUIPAMENTOS</span>,{" "}
            <span className="font-mono text-xs">SEGURANÇA ELÉTRICA</span>.{" "}
            <strong>Não</strong> inclui OFICINA GERAL.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Isto mede o <strong>fluxo consolidado</strong> das oficinas de plano (quantas OS entraram vs quantas
            fecharam no mês) no <strong>ano vigente</strong>. Use os chips Todas / Preventiva / Calibração / Segurança
            elétrica para individualizar.
          </p>
        </div>
      ) : porOficina ? (
        <div className="space-y-3 text-slate-700">
          <p>
            Incluir somente OS cujo campo <strong>Oficina</strong> é equals (texto normalizado: sem acento, maiúsculas)
            a <span className="font-mono text-xs">{oficinaExibida}</span>.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Isto mede o <strong>fluxo da oficina</strong> (quantas OS entraram vs quantas fecharam no mês) no{" "}
            <strong>ano vigente</strong> — melhor do que um KPI genérico de “preventiva fechada” sem recorte de oficina.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-slate-700">
          <p>
            Incluir OS cujo <strong>TipoDeManutencao</strong> {RECORTE_EC_INCLUIR.join(" ")}.
          </p>
          <p>Excluir tipos que começam com {RECORTE_EC_EXCLUIR.join(" ou ")}.</p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Este indicador <strong>não usa</strong> o recorte “somente eq. médicos”. Só o tipo de manutenção EC. O
            objetivo é validar o volume da oficina no <strong>ano vigente</strong> (Jan–Dez; meses futuros zerados), não
            só o parque médico.
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
              {multiOficina
                ? `União das 3 oficinas de plano + ${intervaloOrigemTexto}.`
                : porOficina
                  ? `Oficina equals “${oficinaExibida}” + ${intervaloOrigemTexto}.`
                  : `Recorte EC (tipo) + ${intervaloOrigemTexto}.`}
            </OrigemCampo>
            <OrigemCampo label="Campos">
              <span className="font-mono text-xs">{VOLUME_EC_CAMPOS.join(", ")}</span>
            </OrigemCampo>
            <OrigemCampo label="Quantidade bruta (API)" valueClassName="mt-1 text-lg font-semibold tabular-nums">
              {bruta}
            </OrigemCampo>
            <OrigemCampo label="Após filtro" valueClassName="mt-1 text-lg font-semibold tabular-nums">
              {volume.aposEc.length} {multiOficina ? "nas oficinas de plano" : porOficina ? "na oficina" : "EC"} ·{" "}
              {volume.noIntervalo.length} no intervalo
            </OrigemCampo>
          </dl>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Como contar</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Aberta no mês:</strong> campo Abertura (parsePbiDate) cai naquele mês.
              </li>
              <li>
                <strong>Fechada no mês:</strong> Fechamento se preenchido; senão DataDaSolucao. OS com{" "}
                <strong>SituacaoDaOS = Cancelada</strong> entram como fechadas; se cancelada sem
                Fechamento/DataDaSolucao, usa-se a <strong>Abertura</strong> como mês.
              </li>
              <li>
                <strong>Aberta (estoque / Sala):</strong> sem Fechamento/DataDaSolucao e não cancelada.
              </li>
              {porOficina ? (
                <li>
                  <strong>% executada no mês:</strong> fechadas ÷ abertas × 100. Gráfico: uma barra por mês com o
                  percentual (rótulo no topo, ex. <strong>85%</strong>). Se abertas = 0, barra = 0 e label{" "}
                  <strong>—</strong> (sem abertas; não usar 0%). Clique no mês lista abertas e fechadas.
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Como conferir uma OS no GlobalThings
            </p>
            <p>
              Abra o GlobalThings, busque pelo código da OS (campo <strong>OS</strong>). Confira Oficina, Tipo de
              manutenção, Situação (cancelada conta como fechada), data de abertura e data de fechamento (ou data da
              solução se o fechamento estiver vazio).
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Exemplos para conferir ({volume.exemplos.length} OS)
            </p>
            {volume.exemplos.length === 0 ? (
              <p className="text-slate-500">Nenhuma OS no recorte para amostrar.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">OS</th>
                      <th className="px-3 py-2">Oficina</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Abertura</th>
                      <th className="px-3 py-2">Fechamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volume.exemplos.map((item) => (
                      <tr key={`${item.CodigoSerialOS}-${item.OS}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{item.OS || "—"}</td>
                        <td className="px-3 py-2">{item.Oficina || "—"}</td>
                        <td className="px-3 py-2">{item.TipoDeManutencao || "—"}</td>
                        <td className="px-3 py-2">{formatDateBR(item.Abertura)}</td>
                        <td className="px-3 py-2">{formatDateBR(osDataFechadaIndicador(item))}</td>
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

  const chartKey = oficinaEquals ?? oficinaEqualsIn?.join("|") ?? "ec";
  const chartTitle = porOficina
    ? `% executada por mês · ${range.label}`
    : `Entrada × execução por mês · ${range.label}`;
  const chartHint = porOficina
    ? "Uma barra = % executada (fechadas÷abertas×100). Rótulo no topo; se abertas=0 → barra 0 e label —. Eixo Jan–Dez; meses futuros zerados. Clique no mês para listar as OS."
    : "Cada coluna empilha o volume pareado (coberto) e o saldo do mês. Eixo Jan–Dez do ano vigente; meses futuros zerados. Clique no mês para listar as OS abaixo.";

  const chartNode = porOficina ? (
    <AbertasFechadasPctChart data={chartData} xKey="name" onRowClick={openMesLista} />
  ) : (
    <SaldoStackBarChart data={chartData} xKey="name" onRowClick={openMesLista} />
  );

  return (
    <>
      <IndicadorPageLayout
        loading={loading}
        error={error}
        ficha={FICHA}
        detalhesItems={detalhesItems}
        heading={
          <Heading title={title} description={description ?? defaultDescription} />
        }
        kpis={
          <>
            <KpiCard
              label="Abertas no período"
              value={String(volume.totalAbertas)}
              hint={`Abertura no ${range.label}`}
              onClick={() =>
                openPeriodo("aberta", `OS abertas · ${range.label}`, "Abertura parseada cai no intervalo")
              }
            />
            <KpiCard
              label="Fechadas no período"
              value={String(volume.totalFechadas)}
              hint="Fechamento ou, se vazio, DataDaSolucao"
              tone="ok"
              onClick={() =>
                openPeriodo(
                  "fechada",
                  `OS fechadas · ${range.label}`,
                  "Fechamento preenchido; senão DataDaSolucao",
                )
              }
            />
            {porOficina ? (
              <KpiCard
                label="% executada no período"
                value={
                  volume.totalAbertas <= 0
                    ? "—"
                    : `${pctPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                }
                hint={
                  volume.totalAbertas <= 0
                    ? "Sem abertas no ano vigente — % indefinido (—)"
                    : `fechadas ÷ abertas × 100 no ${range.label}`
                }
                tone={volume.totalAbertas <= 0 ? undefined : pctPeriodo >= 100 ? "ok" : "warn"}
                onClick={() =>
                  openPeriodo(
                    "todas",
                    `Movimento · ${range.label}`,
                    "OS com abertura ou fechamento no intervalo",
                  )
                }
              />
            ) : (
              <KpiCard
                label="Saldo do período"
                value={rotuloSaldo(volume.saldo)}
                hint={
                  volume.saldo > 0
                    ? `Faltou ${volume.saldo} — entrou mais do que executou`
                    : volume.saldo < 0
                      ? `Superávit ${Math.abs(volume.saldo)} — executou mais do que entrou`
                      : "Empate — entrada e execução iguais"
                }
                tone={volume.saldo > 0 ? "warn" : "ok"}
                onClick={() =>
                  openPeriodo(
                    "todas",
                    `Movimento · ${range.label}`,
                    "OS com abertura ou fechamento no intervalo",
                  )
                }
              />
            )}
          </>
        }
        chart={
          <ChartCard title={chartTitle} onExpand={openFullscreen} toolbar={oficinaToolbar} hint={chartHint}>
            {chartNode}
          </ChartCard>
        }
        selectionList={
          <SelecaoOsLista
            hasSelection={!!drill}
            title={listaTitle}
            subtitle={drill?.subtitle}
            emptyHint="Clique em um mês no gráfico para listar as OS correlacionadas."
            onClear={clearSelection}
            filters={filters}
          >
            {table}
          </SelecaoOsLista>
        }
      />

      <ChartFullscreenDialog
        open={open}
        title={chartTitle}
        subtitle="Mesmo gráfico, em tela cheia. Clique no mês para ver a lista na página."
        onClose={closeFullscreen}
        ready={ready}
        chips={
          <>
            {oficinaToolbar}
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              Abertas <strong className="tabular-nums text-slate-900">{volume.totalAbertas}</strong>
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-slate-600">
              Fechadas <strong className="tabular-nums text-emerald-800">{volume.totalFechadas}</strong>
            </span>
            {porOficina ? (
              <span className="rounded-md bg-amber-50 px-2.5 py-1 text-slate-600">
                % executada{" "}
                <strong className="tabular-nums text-amber-900">
                  {volume.totalAbertas <= 0
                    ? "—"
                    : `${pctPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                </strong>
              </span>
            ) : (
              <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
                Saldo <strong className="tabular-nums text-slate-900">{rotuloSaldo(volume.saldo)}</strong>
              </span>
            )}
          </>
        }
      >
        {porOficina ? (
          <AbertasFechadasPctChart
            key={`fullscreen-oficina-${range.fromISO}-${range.toISO}-${chartKey}`}
            data={chartData}
            xKey="name"
            className="h-full min-h-[280px]"
            maxBarSize={48}
            onRowClick={(row) => {
              openMesLista(row);
              closeFullscreen();
            }}
          />
        ) : (
          <SaldoStackBarChart
            key={`fullscreen-volume-${range.fromISO}-${range.toISO}-${chartKey}`}
            data={chartData}
            xKey="name"
            className="h-full min-h-[280px]"
            maxBarSize={80}
            onRowClick={(row) => {
              openMesLista(row);
              closeFullscreen();
            }}
          />
        )}
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
              <FilterChip active={!mesFiltro || mesFiltro === "Todas"} onClick={() => setMesFiltro("Todas")}>
                Todas ({drill.rows.length})
              </FilterChip>
              <FilterChip active={mesFiltro === "Aberta"} onClick={() => setMesFiltro("Aberta")}>
                Abertas
              </FilterChip>
              <FilterChip active={mesFiltro === "Fechada"} onClick={() => setMesFiltro("Fechada")}>
                Fechadas
              </FilterChip>
            </div>
            <DataTable data={drillVisible} columns={cols} pageSize={15} />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
