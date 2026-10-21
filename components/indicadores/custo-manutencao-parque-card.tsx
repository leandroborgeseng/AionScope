"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import {
  ChartCard,
  ChartFullscreenDialog,
  useChartFullscreen,
} from "@/components/indicadores/chart-fullscreen";
import { IndicadorPageLayout } from "@/components/indicadores/indicador-page-layout";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/tables/data-table";
import { CustoParqueChart, textoTooltipMes } from "@/components/charts/custo-parque-chart";
import { useContratos, useParqueMeta } from "@/hooks/use-cadastros";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { dataOf, usePbiQuery } from "@/hooks/use-pbi";
import {
  META_ANUAL_PCT,
  buildCustoParqueAno,
  formatPctParque,
  rotuloStatus,
  type CustoParqueMes,
  type StatusMeta,
} from "@/lib/pbi/custo-manutencao-parque";
import { FICHAS } from "@/lib/pbi/fichas";
import { buildGastoReparo, gastoReparoDoMes, type GastoReparoRow } from "@/lib/pbi/gasto-reparo";
import { formatBRL } from "@/lib/pbi/indicators";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { nowInSaoPaulo, startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { resumirValorParqueApi, valorParqueEfetivo } from "@/lib/pbi/parque-valor";
import type { EquipamentoItem } from "@/lib/pbi/types";
import { cn } from "@/lib/utils";

const FICHA = FICHAS["custo-manutencao-parque"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function formatMi(v: number | null) {
  if (v == null) return "—";
  return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

function StatusChip({ status }: { status: StatusMeta | null }) {
  const cls =
    status === "Dentro"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : status === "Acima"
        ? "border-rose-300 bg-rose-50 text-rose-900"
        : "border-slate-300 bg-slate-100 text-slate-800";
  const Icon = status === "Dentro" ? CheckCircle2 : status === "Acima" ? AlertTriangle : MinusCircle;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", cls)}>
      <Icon className="size-3.5" aria-hidden />
      {rotuloStatus(status)}
    </span>
  );
}

export function CustoManutencaoParqueCard() {
  const { range, raw, bruta, loading: osLoading, error: osError } = useOsAnaliticoRollingYear("calendarYear");
  const medical = useMedicalIndex();
  const parqueQ = useParqueMeta();
  const contratosQ = useContratos();
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();
  const [drill, setDrill] = useState<CustoParqueMes | null>(null);
  const hoje = useMemo(() => nowInSaoPaulo(), []);

  const eqQ = usePbiQuery<EquipamentoItem[]>(
    "equipamentos",
    { ...EMPTY_FILTERS, from: startOfMonthISO(), to: todayISO(), tipoManutencao: "Todos", somenteMedicos: false },
    { apenasAtivos: "true", incluirComponentes: "false", incluirCustoSubstituicao: "true" },
  );

  const apiResumo = useMemo(() => {
    const items = dataOf(eqQ.data) ?? [];
    return items.length ? resumirValorParqueApi(items) : null;
  }, [eqQ.data]);

  const gasto = useMemo(
    () => buildGastoReparo(raw, range, medical.tags, medical.ids),
    [raw, range, medical.tags, medical.ids],
  );

  const efetivo = valorParqueEfetivo({
    apiTodosSubstituicao: parqueQ.data?.valorApi ?? apiResumo?.substituicao.todos.total ?? null,
  });

  const contratos = useMemo(() => contratosQ.data ?? [], [contratosQ.data]);
  const avulsosDisponiveis = !osError && !medical.error;
  const year = range.months[0]?.year ?? hoje.getFullYear();
  const mesAtual = year === hoje.getFullYear() ? hoje.getMonth() : 11;

  const ind = useMemo(
    () =>
      buildCustoParqueAno({
        year,
        months: range.months,
        contratos,
        gastoMonths: gasto.months,
        valorParque: efetivo.valor,
        avulsosDisponiveis,
        mesAtual,
      }),
    [year, range.months, contratos, gasto.months, efetivo.valor, avulsosDisponiveis, mesAtual],
  );
  const faltando = [...ind.faltando];
  if (contratosQ.error) faltando.push("cadastro de contratos indisponível");
  const semDados = faltando.length > 0;
  const atual = ind.atual;
  const pctAtual = semDados ? null : (atual?.pctAcumulado ?? null);
  const statusAtual = semDados ? null : (atual?.status ?? null);

  const loading = osLoading || medical.loading || contratosQ.isLoading || parqueQ.isLoading || eqQ.isLoading;

  const osDrill: GastoReparoRow[] = drill ? gastoReparoDoMes(gasto.noIntervalo, drill.year, drill.month) : [];
  const osColumns: ColumnDef<GastoReparoRow>[] = [
    { accessorKey: "OS", header: "OS" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    { accessorKey: "TipoDeManutencao", header: "Tipo" },
    { id: "custo", header: "Custo", cell: ({ row }) => <span className="tabular-nums">{formatBRL(row.original.custoNum)}</span> },
  ];
  const realizados = ind.months.filter((m) => !m.futuro);

  return (
    <>
      <IndicadorPageLayout
        loading={loading}
        error={null}
        heading={
          <PageHeader
            title={`Custo de manutenção do parque – ${year}`}
            description="Contratos de Manutenção + OS avulsas de equipamentos médicos, acumulado no ano ÷ valor de substituição do parque."
          />
        }
        kpis={
          <>
            <div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-aion-line bg-white p-4" data-testid="kpi-custo-parque">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div>
                  <p className="text-sm text-aion-muted">Acumulado até {MESES_LONGOS[mesAtual]} (% do parque)</p>
                  <p className="text-4xl font-bold tabular-nums text-aion-ink">{formatPctParque(pctAtual)}</p>
                  <p className="text-sm tabular-nums text-aion-ink/80">{semDados ? "—" : formatBRL(atual?.acumulado ?? 0)}</p>
                </div>
                <StatusChip status={statusAtual} />
              </div>
              <p className="mt-2 text-sm text-aion-ink/80">
                Meta até {MESES_LONGOS[mesAtual]}: {formatPctParque(atual?.metaPct ?? null)} · Teto anual:{" "}
                {formatPctParque(META_ANUAL_PCT)} · Parque: {formatMi(ind.valorParque)}
              </p>
              {semDados ? (
                <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Não foi possível calcular: {faltando.join("; ")}.{" "}
                  {ind.valorParque == null ? (
                    <Link href="/cadastros/parque" className="underline">Atualizar o valor do parque</Link>
                  ) : null}
                </p>
              ) : null}
              {!semDados && ind.semContratos ? (
                <p className="mt-3 rounded-lg border border-aion-line bg-aion-mist px-3 py-2 text-sm text-aion-ink">
                  Nenhum contrato de Manutenção cadastrado: o cálculo usa só as OS avulsas.{" "}
                  <Link href="/cadastros/contratos" className="underline">Cadastrar contratos</Link>
                </p>
              ) : null}
            </div>
          </>
        }
        chart={
          <ChartCard
            title={`Despesa mensal e acumulado · ${year}`}
            onExpand={openFullscreen}
            hint="Barras: Contratos + Avulsos (R$). Linha: acumulado (% do parque). Tracejado: meta proporcional; pontilhado: teto anual 4%."
          >
            <CustoParqueChart months={semDados ? ind.months.map((m) => ({ ...m, pctAcumulado: null, status: null })) : ind.months} onMonthClick={setDrill} />
          </ChartCard>
        }
        selectionList={
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-aion-line bg-white">
              <table className="hidden w-full text-sm md:table" aria-label="Tabela mensal do indicador">
                <thead className="bg-aion-mist text-left text-xs text-aion-ink">
                  <tr>
                    {["Mês", "Contratos", "Avulsos", "Total do mês", "Acumulado R$", "Acumulado %", "Meta %", "Status"].map((h, i) => (
                      <th key={h} className={cn("px-3 py-2 font-semibold", i > 0 && i < 7 && "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ind.months.map((m) => (
                    <tr
                      key={m.key}
                      className={cn("border-t border-aion-mist", m.month === mesAtual && "bg-sky-50 font-medium", !m.futuro && "cursor-pointer hover:bg-slate-50")}
                      onClick={() => !m.futuro && setDrill(m)}
                      title={m.futuro ? undefined : textoTooltipMes(m)}
                    >
                      <td className="px-3 py-2">{m.label}</td>
                      {m.futuro ? (
                        <>
                          <td colSpan={5} className="px-3 py-2 text-right text-aion-muted">a realizar</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatPctParque(m.metaPct)}</td>
                          <td className="px-3 py-2" />
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">{formatBRL(m.contratos)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{semDados ? "—" : formatBRL(m.avulsos)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{semDados ? "—" : formatBRL(m.despesa)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{semDados ? "—" : formatBRL(m.acumulado)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatPctParque(semDados ? null : m.pctAcumulado)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatPctParque(m.metaPct)}</td>
                          <td className="px-3 py-2"><StatusChip status={semDados ? null : m.status} /></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-aion-mist md:hidden" aria-label="Meses do indicador">
                {realizados.map((m) => (
                  <li key={m.key}>
                    <button type="button" className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm", m.month === mesAtual && "bg-sky-50")} onClick={() => setDrill(m)}>
                      <span>
                        <span className="font-medium">{m.label}</span>
                        <span className="block tabular-nums text-aion-ink/80">{semDados ? "—" : formatBRL(m.despesa)} · {formatPctParque(semDados ? null : m.pctAcumulado)}</span>
                      </span>
                      <StatusChip status={semDados ? null : m.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {drill ? (
              <div className="space-y-4 rounded-xl border border-aion-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-aion-ink">Despesa de {drill.label}: {formatBRL(drill.despesa)}</h3>
                    <p className="text-xs text-aion-muted">
                      {drill.contratosNoMes.length} contrato(s) {formatBRL(drill.contratos)} · {osDrill.length} OS {formatBRL(drill.avulsos)}
                    </p>
                  </div>
                  <button type="button" className="text-xs font-medium text-aion-blue hover:underline" onClick={() => setDrill(null)}>Fechar</button>
                </div>
                {drill.contratosNoMes.length ? (
                  <ul className="space-y-1 text-sm">
                    {drill.contratosNoMes.map((c) => (
                      <li key={c.id} className="flex justify-between gap-3">
                        <span>{[c.fornecedor, c.equipamento].filter(Boolean).join(" – ") || c.nome}</span>
                        <span className="tabular-nums">{formatBRL(c.valorMensal)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-aion-muted">Nenhum contrato de Manutenção neste mês.</p>
                )}
                {osDrill.length ? <DataTable data={osDrill} columns={osColumns} /> : <p className="text-sm text-aion-muted">Nenhuma OS de reparo médico neste mês.</p>}
              </div>
            ) : (
              <p className="text-sm text-aion-muted">Clique em um mês no gráfico ou na tabela para ver contratos e OS.</p>
            )}
          </div>
        }
        ficha={FICHA}
        detalhesItems={[
          {
            id: "como-calculado",
            title: "Como é calculado",
            children: (
              <div className="space-y-2 text-sm text-aion-ink/85">
                <p>
                  Soma das mensalidades dos contratos de Manutenção vigentes em pelo menos um dia do mês e das OS avulsas de
                  equipamentos médicos fechadas no mês. O acumulado recomeça em janeiro. Contratos de Locação não entram neste indicador.
                </p>
                <p>
                  Contrato inativado conta até o mês da inativação (inclusive). Status do mês: acumulado ≤ 4% × mês/12.
                  Contratos:{" "}
                  <Link href="/cadastros/contratos" className="text-aion-blue underline">/cadastros/contratos</Link>.
                  Parque (todos os equipamentos, valor de substituição):{" "}
                  <Link href="/cadastros/parque" className="text-aion-blue underline">/cadastros/parque</Link>.
                </p>
                <p className="text-xs text-aion-muted">OS brutas no ano: {bruta}. Contratos no cadastro: {contratos.length}.</p>
              </div>
            ),
          },
        ]}
      />

      <ChartFullscreenDialog open={open} ready={ready} title={`Custo de manutenção do parque · ${year}`} onClose={closeFullscreen}>
        <CustoParqueChart months={semDados ? ind.months.map((m) => ({ ...m, pctAcumulado: null, status: null })) : ind.months} className="h-[70vh]" onMonthClick={setDrill} />
      </ChartFullscreenDialog>
    </>
  );
}
