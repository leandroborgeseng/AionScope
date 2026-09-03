"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { GastoBarChart } from "@/components/charts/charts";
import {
  ChartCard,
  ChartFullscreenDialog,
  IndicadorHeading,
  OrigemCampo,
  useChartFullscreen,
} from "@/components/indicadores/chart-fullscreen";
import { PageHeader } from "@/components/shell/page-header";
import { FilterChip } from "@/components/indicadores/indicador-section";
import { KpiCard } from "@/components/kpi/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { formatDateBR } from "@/lib/pbi/dates";
import { formatBRL } from "@/lib/pbi/indicators";
import {
  GASTO_REPARO_CAMPOS,
  GASTO_REPARO_EXCLUIR,
  GASTO_REPARO_INCLUIR,
  buildGastoReparo,
  gastoReparoComCusto,
  gastoReparoDoMes,
  type GastoReparoRow,
} from "@/lib/pbi/gasto-reparo";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type Drill = {
  title: string;
  subtitle?: string;
  rows: GastoReparoRow[];
} | null;

export function GastoReparoCard({
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
  const [soComCusto, setSoComCusto] = useState(false);
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();

  const gasto = useMemo(
    () => buildGastoReparo(raw, range, medical.tags, medical.ids),
    [raw, range, medical.tags, medical.ids],
  );

  const chartData = useMemo(
    () =>
      gasto.months.map((m) => ({
        name: m.label,
        key: m.key,
        year: m.year,
        month: m.month,
        gasto: m.gasto,
        gastoCorretiva: m.gastoCorretiva,
        gastoOutro: m.gastoOutro,
        osCount: m.osCount,
        osComCusto: m.osComCusto,
      })),
    [gasto.months],
  );

  const openMesLista = useCallback(
    (row: { name: string; year?: string | number; month?: string | number }) => {
      const year = Number(row.year);
      const month = Number(row.month);
      const slot = gasto.months.find((m) => m.year === year && m.month === month);
      setSoComCusto(false);
      setDrill({
        title: `Reparo médico · ${row.name}`,
        subtitle: `${formatBRL(slot?.gasto ?? 0)} · ${slot?.osCount ?? 0} OS · ${slot?.osComCusto ?? 0} com custo > 0`,
        rows: gastoReparoDoMes(gasto.noIntervalo, year, month),
      });
    },
    [gasto.months, gasto.noIntervalo],
  );

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    return soComCusto ? gastoReparoComCusto(drill.rows) : drill.rows;
  }, [drill, soComCusto]);

  const cols: ColumnDef<GastoReparoRow, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    { accessorKey: "TipoDeManutencao", header: "Tipo" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    { accessorKey: "Tag", header: "Tag" },
    {
      accessorKey: "custoNum",
      header: "Custo",
      cell: ({ row }) => <span className="tabular-nums">{formatBRL(row.original.custoNum)}</span>,
    },
    {
      accessorKey: "Fechamento",
      header: "Fechamento",
      cell: ({ row }) => formatDateBR(row.original.fechamento),
    },
    { accessorKey: "DataDaSolucao", header: "Data da solução" },
    { accessorKey: "SituacaoDaOS", header: "Situação" },
  ];

  const waiting = loading || medical.loading;
  const medicalError = medical.error ?? (!medical.loading && !medical.ready ? "Índice de equipamentos médicos indisponível." : null);
  const blockError = error || medicalError;
  const maioriaZerada = gasto.noIntervalo.length > 0 && gasto.osComCusto / gasto.noIntervalo.length < 0.5;

  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;

  return (
    <section className="space-y-4">
      <Heading
        title="Gasto mensal com reparo de eq. médicos"
        description={`Soma do Custo das OS de reparo de equipamentos médicos · ${range.label}. Só entra OS com data de fechamento (Fechamento; senão DataDaSolucao) — reparo ainda aberto não conta no mês.`}
      />

      {waiting ? (
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
          {blockError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{blockError}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Gasto total no período"
              value={formatBRL(gasto.gastoTotal)}
              hint="Soma do Custo das OS de reparo médico fechadas no intervalo"
              onClick={() => {
                setSoComCusto(false);
                setDrill({
                  title: `Gasto · ${range.label}`,
                  subtitle: "OS de reparo médico com fechamento no intervalo",
                  rows: gasto.noIntervalo,
                });
              }}
            />
            <KpiCard
              label="Média mensal"
              value={formatBRL(gasto.mediaMensal)}
              hint={`Total ÷ ${range.months.length} meses do gráfico`}
              tone="ok"
              onClick={() => {
                setSoComCusto(false);
                setDrill({
                  title: `Gasto · ${range.label}`,
                  subtitle: "Mesma lista do gasto total — a média divide pelos meses do intervalo",
                  rows: gasto.noIntervalo,
                });
              }}
            />
            <KpiCard
              label="OS com custo > 0"
              value={String(gasto.osComCusto)}
              hint={`${gasto.osCustoZero} no período têm Custo 0 ou vazio`}
              tone={maioriaZerada ? "warn" : "neutral"}
              onClick={() => {
                setSoComCusto(true);
                setDrill({
                  title: `OS com custo > 0 · ${range.label}`,
                  subtitle: "Reparo médico fechado no intervalo e Custo parseado maior que zero",
                  rows: gastoReparoComCusto(gasto.noIntervalo),
                });
              }}
            />
          </div>

          <ChartCard
            title={`Gasto por mês · ${range.label}`}
            onExpand={openFullscreen}
            hint="Barra = soma do Custo no mês de fechamento. Número omitido se for 0 ou se o pedaço for baixo demais. Clique no mês para ver a lista."
          >
            <GastoBarChart
              data={chartData}
              xKey="name"
              stacked={gasto.empilhar}
              onRowClick={openMesLista}
            />
          </ChartCard>

          <Card className="border-aion-line bg-aion-mist/50">
            <CardHeader>
              <CardTitle>Recorte: reparo de equipamentos médicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>
                <strong>Equipamento médico:</strong> só OS cuja <strong>Tag</strong> está no índice de
                <code className="mx-1 rounded bg-white px-1 py-0.5 text-xs">lib/pbi/medical.ts</code>
                (cadastro de equipamentos). OS sem tag ou com tag não classificada como médica{" "}
                <strong>não entram</strong>.
              </p>
              <p>
                Incluir tipo de manutenção: {GASTO_REPARO_INCLUIR.join("; ")}. O prefixo “A -” sozinho não basta — em
                GlobalThings ele também marca calibração, preventiva, movimentação e compra.
              </p>
              <p>Excluir: {GASTO_REPARO_EXCLUIR.join("; ")}.</p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                Calibração, TSE e preventiva <strong>não são reparo</strong> — ficam de fora desta soma. OS sem
                Fechamento e sem DataDaSolucao também ficam de fora: o reparo ainda não foi concluído.
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
                  <p className="mt-1 text-xs text-slate-500">
                    Índice médico: GET /api/pbi/v1/equipamentos via /api/pbi/equipamentos
                  </p>
                </OrigemCampo>
                <OrigemCampo label="Params enviados">
                  <span className="font-mono text-xs">
                    periodo={VOLUME_EC_PERIODO_API} · tipoManutencao={VOLUME_EC_TIPO_API} · qtdPorPagina=100000
                  </span>
                </OrigemCampo>
                <OrigemCampo label="Filtro local">
                  Tag no índice médico + tipo de reparo + Fechamento/DataDaSolucao entre {range.fromISO} e{" "}
                  {range.toISO}. OS sem data de fechamento não entram no gasto do mês.
                </OrigemCampo>
                <OrigemCampo label="Campos">
                  <span className="font-mono text-xs">{GASTO_REPARO_CAMPOS.join(", ")}</span>
                  <p className="mt-1 text-xs text-slate-500">
                    Valor: campo <strong>Custo</strong> da OS analítica (parse número BR).
                  </p>
                </OrigemCampo>
                <OrigemCampo label="Quantidade bruta (API)" valueClassName="mt-1 text-lg font-semibold tabular-nums">
                  {bruta}
                </OrigemCampo>
                <OrigemCampo label="Após filtro" valueClassName="mt-1 text-sm font-semibold tabular-nums leading-relaxed">
                  {gasto.aposMedico.length} com tag médica · {gasto.aposReparo.length} reparo ·{" "}
                  {gasto.noIntervalo.length} fechadas no intervalo
                </OrigemCampo>
              </dl>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Fórmula</p>
                <p>
                  <strong>Gasto do mês</strong> = soma de <code className="rounded bg-slate-100 px-1">Custo</code> das
                  OS que passam no recorte e cuja data de fechamento cai naquele mês.
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Funil (honestidade)</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Sem tag: <strong className="tabular-nums">{gasto.semTag.length}</strong> — excluídas.
                  </li>
                  <li>
                    Tag fora do índice médico: <strong className="tabular-nums">{gasto.tagForaDoIndice.length}</strong> —
                    excluídas.
                  </li>
                  <li>
                    Reparo médico sem data de fechamento:{" "}
                    <strong className="tabular-nums">{gasto.semFechamento.length}</strong> — excluídas do gasto (ainda
                    não concluídas).
                  </li>
                  <li>
                    No intervalo: <strong className="tabular-nums">{gasto.noIntervalo.length}</strong> OS ·{" "}
                    <strong className="tabular-nums">{gasto.osComCusto}</strong> com custo &gt; 0 ·{" "}
                    <strong className="tabular-nums">{gasto.osCustoZero}</strong> com custo 0 ou vazio.
                  </li>
                </ul>
                <p
                  className={
                    maioriaZerada
                      ? "mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"
                      : "mt-2 text-slate-600"
                  }
                >
                  {gasto.osComCusto} de {gasto.noIntervalo.length} OS de reparo médico no período têm custo &gt; 0;{" "}
                  {gasto.osCustoZero} vêm {gasto.osCustoZero === 1 ? "zerada" : "zeradas"}. O gráfico <strong>não esconde</strong>{" "}
                  esses zeros — eles entram na soma como R$ 0.
                </p>
                {gasto.empilhar ? (
                  <p className="mt-2 text-slate-600">
                    Há duas categorias com gasto &gt; 0 no período (corretiva {formatBRL(gasto.gastoCorretiva)} · man.
                    externa / instrumental {formatBRL(gasto.gastoOutro)}), então as barras empilham.
                  </p>
                ) : (
                  <p className="mt-2 text-slate-600">
                    Barra única: não há duas categorias de reparo com gasto &gt; 0 ao mesmo tempo no período.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Como conferir uma OS no GlobalThings
                </p>
                <p>
                  Busque pelo código da OS. Confira Tag (equipamento médico), Tipo de manutenção (corretiva / A -, sem
                  ser preventiva, calibração ou TSE), data de fechamento e o campo Custo.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Exemplos para conferir ({gasto.exemplos.length} OS)
                </p>
                {gasto.exemplos.length === 0 ? (
                  <p className="text-slate-500">Nenhuma OS de reparo médico fechada no intervalo para amostrar.</p>
                ) : (
                  <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">OS</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Tag</th>
                          <th className="px-3 py-2">Custo</th>
                          <th className="px-3 py-2">Fechamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gasto.exemplos.map((item) => (
                          <tr key={`${item.CodigoSerialOS}-${item.OS}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium">{item.OS || "—"}</td>
                            <td className="px-3 py-2">{item.TipoDeManutencao || "—"}</td>
                            <td className="px-3 py-2">{item.Tag || "—"}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatBRL(item.custoNum)}
                              {item.custoNum <= 0 ? (
                                <Badge tone="warn" className="ml-2">
                                  zero
                                </Badge>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">{formatDateBR(item.fechamento)}</td>
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
        title={`Gasto por mês · ${range.label}`}
        subtitle="Mesmo gráfico, em tela cheia. Clique no mês para ver a lista."
        onClose={closeFullscreen}
        ready={ready}
        chips={
          <>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              Total <strong className="tabular-nums text-slate-900">{formatBRL(gasto.gastoTotal)}</strong>
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-slate-600">
              Média <strong className="tabular-nums text-emerald-800">{formatBRL(gasto.mediaMensal)}</strong>
            </span>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 text-slate-600">
              OS com custo &gt; 0 <strong className="tabular-nums text-slate-900">{gasto.osComCusto}</strong>
            </span>
          </>
        }
      >
        <GastoBarChart
          key={`fullscreen-gasto-${range.fromISO}-${range.toISO}`}
          data={chartData}
          xKey="name"
          stacked={gasto.empilhar}
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
          setSoComCusto(false);
        }}
      >
        {drill ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={!soComCusto} onClick={() => setSoComCusto(false)}>
                Todas ({drill.rows.length})
              </FilterChip>
              <FilterChip active={soComCusto} onClick={() => setSoComCusto(true)}>
                Custo &gt; 0 ({gastoReparoComCusto(drill.rows).length})
              </FilterChip>
            </div>
            <DataTable data={drillVisible} columns={cols} pageSize={15} />
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
