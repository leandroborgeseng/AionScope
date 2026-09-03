"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SaldoStackBarChart } from "@/components/charts/charts";
import {
  ChartCard,
  ChartFullscreenDialog,
  IndicadorHeading,
  OrigemCampo,
  useChartFullscreen,
} from "@/components/indicadores/chart-fullscreen";
import { FilterChip } from "@/components/indicadores/indicador-section";
import { KpiCard } from "@/components/kpi/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { formatDateBR } from "@/lib/pbi/dates";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import {
  RECORTE_EC_EXCLUIR,
  RECORTE_EC_INCLUIR,
  VOLUME_EC_CAMPOS,
  VOLUME_EC_PERIODO_API,
  VOLUME_EC_TIPO_API,
  buildVolumeAbertasFechadas,
  fraseSaldo,
  osFechamentoDate,
  rotuloSaldo,
  volumeEcDoMes,
  volumeEcDoPeriodo,
  type RollingYearRange,
  type VolumeEcMovimento,
  type VolumeEcRow,
} from "@/lib/pbi/volume-ec";

type Drill = {
  title: string;
  subtitle?: string;
  rows: VolumeEcRow[];
} | null;

const movimentoTone = (value: VolumeEcMovimento) => {
  if (value === "Fechada") return "ok" as const;
  if (value === "Ambas") return "info" as const;
  return "warn" as const;
};

export function OsVolumeCard({
  range,
  raw,
  bruta,
  loading,
  error,
}: {
  range: RollingYearRange;
  raw: OsAnaliticoItem[];
  bruta: number;
  loading: boolean;
  error: string | null;
}) {
  const [drill, setDrill] = useState<Drill>(null);
  const [mesFiltro, setMesFiltro] = useState<VolumeEcMovimento | "Todas" | null>(null);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const volume = useMemo(() => buildVolumeAbertasFechadas(raw, range), [raw, range]);

  const chartData = useMemo(
    () =>
      volume.months.map((m) => ({
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
      })),
    [volume.months],
  );

  const openMesLista = useCallback(
    (row: { name: string; year?: string | number; month?: string | number }) => {
      const year = Number(row.year);
      const month = Number(row.month);
      const slot = volume.months.find((m) => m.year === year && m.month === month);
      setMesFiltro("Todas");
      setDrill({
        title: `OS · ${row.name}`,
        subtitle: `${slot?.abertas ?? 0} entrou · ${slot?.fechadas ?? 0} executou · ${fraseSaldo(slot?.saldo ?? 0)}`,
        rows: volumeEcDoMes(volume.aposEc, year, month),
      });
    },
    [volume.aposEc, volume.months],
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
    { accessorKey: "DataDaSolucao", header: "Data da solução" },
    { accessorKey: "SituacaoDaOS", header: "Situação" },
  ];

  return (
    <section className="space-y-4">
      <IndicadorHeading
        title="OS abertas × fechadas"
        description={`Volume da oficina de Engenharia Clínica · ${range.label}. Recorte só por tipo de manutenção EC — este indicador não usa o filtro “somente eq. médicos”.`}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : (
        <>
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Abertas no período"
              value={String(volume.totalAbertas)}
              hint="Abertura no intervalo rolante"
              onClick={() => {
                setMesFiltro("Aberta");
                setDrill({
                  title: `OS abertas · ${range.label}`,
                  subtitle: "Abertura parseada cai no intervalo",
                  rows: volumeEcDoPeriodo(volume.aposEc, range, "aberta"),
                });
              }}
            />
            <KpiCard
              label="Fechadas no período"
              value={String(volume.totalFechadas)}
              hint="Fechamento ou, se vazio, DataDaSolucao"
              tone="ok"
              onClick={() => {
                setMesFiltro("Fechada");
                setDrill({
                  title: `OS fechadas · ${range.label}`,
                  subtitle: "Fechamento preenchido; senão DataDaSolucao",
                  rows: volumeEcDoPeriodo(volume.aposEc, range, "fechada"),
                });
              }}
            />
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
              onClick={() => {
                setMesFiltro("Todas");
                setDrill({
                  title: `Movimento · ${range.label}`,
                  subtitle: "OS com abertura ou fechamento no intervalo",
                  rows: volumeEcDoPeriodo(volume.aposEc, range),
                });
              }}
            />
          </div>

          <ChartCard
            title={`Entrada × execução por mês · ${range.label}`}
            onExpand={openFullscreen}
            hint="Cada coluna empilha o volume pareado (coberto) e o saldo do mês. Altura = o maior entre entrou e executou. Clique no mês para ver a lista."
          >
            <SaldoStackBarChart data={chartData} xKey="name" onRowClick={openMesLista} />
          </ChartCard>

          <Card className="border-teal-200 bg-teal-50/40">
            <CardHeader>
              <CardTitle>Recorte Engenharia Clínica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>
                Incluir OS cujo <strong>TipoDeManutencao</strong> {RECORTE_EC_INCLUIR.join(" ")}.
              </p>
              <p>Excluir tipos que começam com {RECORTE_EC_EXCLUIR.join(" ou ")}.</p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                Este indicador <strong>não usa</strong> o recorte “somente eq. médicos”. Só o tipo de manutenção EC. O
                objetivo é validar o volume da oficina, não só o parque médico.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>De onde vêm os dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
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
                  Recorte EC (tipo) + intervalo {range.fromISO} a {range.toISO} (início do mês de 12 meses atrás até o
                  fim do mês atual).
                </OrigemCampo>
                <OrigemCampo label="Campos">
                  <span className="font-mono text-xs">{VOLUME_EC_CAMPOS.join(", ")}</span>
                </OrigemCampo>
                <OrigemCampo label="Quantidade bruta (API)" valueClassName="mt-1 text-lg font-semibold tabular-nums">
                  {bruta}
                </OrigemCampo>
                <OrigemCampo label="Após filtro" valueClassName="mt-1 text-lg font-semibold tabular-nums">
                  {volume.aposEc.length} EC · {volume.noIntervalo.length} no intervalo
                </OrigemCampo>
              </dl>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Como contar</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Aberta no mês:</strong> campo Abertura (parsePbiDate) cai naquele mês.
                  </li>
                  <li>
                    <strong>Fechada no mês:</strong> Fechamento se preenchido; senão DataDaSolucao. Sem as duas, não
                    conta como fechada.
                  </li>
                </ul>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Como conferir uma OS no GlobalThings
                </p>
                <p>
                  Abra o GlobalThings, busque pelo código da OS (campo <strong>OS</strong>). Confira Tipo de manutenção,
                  data de abertura e data de fechamento (ou data da solução se o fechamento estiver vazio).
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
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Abertura</th>
                          <th className="px-3 py-2">Fechamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volume.exemplos.map((item) => (
                          <tr key={`${item.CodigoSerialOS}-${item.OS}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium">{item.OS || "—"}</td>
                            <td className="px-3 py-2">{item.TipoDeManutencao || "—"}</td>
                            <td className="px-3 py-2">{formatDateBR(item.Abertura)}</td>
                            <td className="px-3 py-2">{formatDateBR(osFechamentoDate(item))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ChartFullscreenDialog
        open={open}
        title={`Entrada × execução por mês · ${range.label}`}
        subtitle="Mesmo gráfico da home, em tela cheia. Clique no mês para ver a lista."
        onClose={closeFullscreen}
        ready={ready}
        chips={
          <>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              Abertas <strong className="tabular-nums text-slate-900">{volume.totalAbertas}</strong>
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-slate-600">
              Fechadas <strong className="tabular-nums text-emerald-800">{volume.totalFechadas}</strong>
            </span>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              Saldo <strong className="tabular-nums text-slate-900">{rotuloSaldo(volume.saldo)}</strong>
            </span>
          </>
        }
      >
        <SaldoStackBarChart
          key={`fullscreen-volume-${range.fromISO}-${range.toISO}`}
          data={chartData}
          xKey="name"
          className="h-full min-h-[280px]"
          maxBarSize={80}
          onRowClick={openMesLista}
        />
      </ChartFullscreenDialog>

      <Sheet
        open={!!drill}
        title={drill?.title ?? ""}
        subtitle={drill?.subtitle}
        onClose={() => {
          setDrill(null);
          setMesFiltro(null);
        }}
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
    </section>
  );
}
