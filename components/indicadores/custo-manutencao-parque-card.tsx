"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChartCard,
  ChartFullscreenDialog,
  useChartFullscreen,
} from "@/components/indicadores/chart-fullscreen";
import { IndicadorPageLayout } from "@/components/indicadores/indicador-page-layout";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/kpi/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { DespesaParqueBarChart, type DespesaParqueChartRow } from "@/components/charts/charts";
import { useParqueMeta } from "@/hooks/use-cadastros";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { useOsAnaliticoRollingYear } from "@/hooks/use-os-analitico-rolling-year";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import {
  buildDespesaParque,
  contratosLinhaDoMes,
  formatPctParque,
  type ListaDespesaMes,
} from "@/lib/pbi/custo-manutencao-parque";
import { FICHAS } from "@/lib/pbi/fichas";
import { buildGastoReparo, gastoReparoDoMes, type GastoReparoRow } from "@/lib/pbi/gasto-reparo";
import { formatBRL } from "@/lib/pbi/indicators";
import { EMPTY_FILTERS } from "@/lib/pbi/filters";
import { startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import {
  PARQUE_META_REFERENCIA,
  resumirValorParqueApi,
  valorParqueEfetivo,
} from "@/lib/pbi/parque-valor";
import type { ContratoPbiItem, EquipamentoItem } from "@/lib/pbi/types";

const FICHA = FICHAS["custo-manutencao-parque"];

type Drill = {
  title: string;
  year: number;
  month: number;
  contratos: ListaDespesaMes["contratos"];
  os: GastoReparoRow[];
} | null;

export function CustoManutencaoParqueCard() {
  const { range, raw, bruta, loading: osLoading, error: osError } = useOsAnaliticoRollingYear();
  const medical = useMedicalIndex();
  const parqueQ = useParqueMeta();
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();
  const [drill, setDrill] = useState<Drill>(null);

  const contratosQ = usePbiQuery<ContratoPbiItem[]>(
    "contratos",
    {
      ...EMPTY_FILTERS,
      from: range.fromISO,
      to: range.toISO,
      tipoManutencao: "Todos",
      somenteMedicos: false,
    },
    { pagina: "0", qtdPorPagina: "100000", omitDates: "true" },
  );

  const eqQ = usePbiQuery<EquipamentoItem[]>(
    "equipamentos",
    {
      ...EMPTY_FILTERS,
      from: startOfMonthISO(),
      to: todayISO(),
      tipoManutencao: "Todos",
      somenteMedicos: false,
    },
    {
      apenasAtivos: "true",
      incluirComponentes: "false",
      incluirCustoSubstituicao: "true",
    },
  );

  const contratos = dataOf(contratosQ.data) ?? [];
  const contratosErr = errorOf(contratosQ.data);

  const apiResumo = useMemo(() => {
    const items = dataOf(eqQ.data) ?? [];
    return items.length ? resumirValorParqueApi(items) : null;
  }, [eqQ.data]);

  const gasto = useMemo(
    () => buildGastoReparo(raw, range, medical.tags, medical.ids),
    [raw, range, medical.tags, medical.ids],
  );

  const apiPersistida = parqueQ.data?.valorApi ?? null;
  const apiLiveTodos = apiResumo?.substituicao.todos.total ?? null;

  const efetivo = valorParqueEfetivo({
    apiTodosSubstituicao: apiPersistida ?? apiLiveTodos,
  });

  const despesa = useMemo(
    () =>
      buildDespesaParque({
        range,
        contratos,
        gastoMonths: gasto.months,
        valorParque: efetivo.valor,
        fonteParque: efetivo.fonte,
      }),
    [range, contratos, gasto.months, efetivo.valor, efetivo.fonte],
  );

  const chartData: DespesaParqueChartRow[] = useMemo(
    () =>
      despesa.months.map((m) => ({
        name: m.label,
        key: m.key,
        year: m.year,
        month: m.month,
        contratos: m.contratos,
        avulsos: m.avulsos,
        despesa: m.despesa,
        pctParque: m.pctParque,
      })),
    [despesa.months],
  );

  const empilhar = despesa.contratosTotal > 0 && despesa.avulsosTotal > 0;

  const loading =
    osLoading || medical.loading || contratosQ.isLoading || parqueQ.isLoading || eqQ.isLoading;

  const contratosTokenAusente =
    Boolean(contratosErr) &&
    (contratosErr!.message.includes("PBI_TOKEN_CONTRATOS") ||
      contratosErr!.message.includes("Token ausente"));
  const contratosMsg = contratosErr
    ? contratosTokenAusente
      ? "Configure PBI_TOKEN_CONTRATOS no .env.local"
      : contratosErr.message
    : null;
  /** Sem contratos confiáveis: não publicar % do parque como se o numerador estivesse completo. */
  const contratosIndisponiveis = Boolean(contratosMsg);

  const error =
    osError ?? medical.error ?? (parqueQ.error instanceof Error ? parqueQ.error.message : null);

  function openMes(row: DespesaParqueChartRow) {
    const year = Number(row.year);
    const month = Number(row.month);
    setDrill({
      title: `Despesa de ${row.name}`,
      year,
      month,
      contratos: contratosLinhaDoMes(contratos, year, month),
      os: gastoReparoDoMes(gasto.noIntervalo, year, month),
    });
  }

  const osColumns: ColumnDef<GastoReparoRow>[] = [
    { accessorKey: "OS", header: "OS" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    { accessorKey: "TipoDeManutencao", header: "Tipo" },
    {
      id: "custo",
      header: "Custo",
      cell: ({ row }) => <span className="tabular-nums">{formatBRL(row.original.custoNum)}</span>,
    },
  ];

  return (
    <>
      <IndicadorPageLayout
        loading={loading}
        error={error}
        heading={
          <PageHeader
            title={FICHA.nomeDoIndicador}
            description="Despesa mensal (contratos + avulsos de OS de reparo) ÷ valor de substituição do parque (todos os equipamentos cadastrados)."
          />
        }
        kpis={
          <>
            {contratosIndisponiveis ? (
              <div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Contratos indisponíveis ({contratosMsg}). Mostramos só avulsos de OS;{" "}
                <strong>não</strong> publicamos % do parque com numerador incompleto.{" "}
                <Link href="/cadastros/contratos" className="underline">
                  Ver cadastro de contratos
                </Link>
                .
              </div>
            ) : null}
            <KpiCard
              label="Despesa do período"
              value={
                contratosIndisponiveis
                  ? formatBRL(despesa.avulsosTotal)
                  : formatBRL(despesa.despesaTotal)
              }
              hint={
                contratosIndisponiveis
                  ? `${formatBRL(despesa.avulsosTotal)} avulsos · contratos pendentes de token`
                  : `${formatBRL(despesa.contratosTotal)} contratos · ${formatBRL(despesa.avulsosTotal)} avulsos`
              }
            />
            <KpiCard
              label="% do parque (período)"
              value={
                contratosIndisponiveis ? "—" : formatPctParque(despesa.pctParquePeriodo)
              }
              hint={
                contratosIndisponiveis
                  ? "Indisponível sem contratos na API"
                  : efetivo.fonte === "api"
                    ? `API (todos) ${formatBRL(efetivo.valor)}`
                    : "Atualize o valor do parque pela API"
              }
              tone={
                contratosIndisponiveis || despesa.pctParquePeriodo == null
                  ? "neutral"
                  : despesa.pctParquePeriodo <= 4
                    ? "ok"
                    : despesa.pctParquePeriodo <= 6
                      ? "warn"
                      : "danger"
              }
            />
            <KpiCard
              label="Média mensal"
              value={
                contratosIndisponiveis
                  ? formatBRL(
                      despesa.months.length
                        ? despesa.avulsosTotal / despesa.months.length
                        : 0,
                    )
                  : formatBRL(despesa.mediaMensal)
              }
              hint={
                contratosIndisponiveis
                  ? "Média só de avulsos — % do parque omitido"
                  : `Média % do parque: ${formatPctParque(despesa.mediaPctParque)}`
              }
            />
          </>
        }
        chart={
          <ChartCard
            title={`Despesa mensal · ${range.label}`}
            onExpand={openFullscreen}
            hint={
              contratosIndisponiveis ? (
                <span className="text-amber-800">
                  Só avulsos de OS no gráfico — contratos ausentes; % do parque não é KPI oficial neste estado.
                </span>
              ) : efetivo.fonte === "api" ? (
                <span>
                  Valor puxado do cadastro de equipamentos (substituição, todos os cadastrados).{" "}
                  <Link href="/cadastros/parque" className="underline">
                    Ver / atualizar
                  </Link>
                  .
                </span>
              ) : efetivo.fonte == null ? (
                <span className="text-amber-800">
                  Sem valor do parque — % fica vazio.{" "}
                  <Link href="/cadastros/parque" className="underline">
                    Atualizar da API
                  </Link>
                </span>
              ) : (
                "Barras: contratos + avulsos (OS reparo médicos). Meta ficha ≤ 4% a.a. do parque."
              )
            }
          >
            <DespesaParqueBarChart
              data={chartData}
              xKey="name"
              stacked={empilhar}
              onRowClick={openMes}
            />
          </ChartCard>
        }
        selectionList={
          drill ? (
            <div className="space-y-4 rounded-xl border border-aion-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-aion-ink">{drill.title}</h3>
                  <p className="text-xs text-aion-muted">
                    {drill.contratos.length} contrato(s) · {drill.os.length} OS de reparo
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-aion-blue hover:underline"
                  onClick={() => setDrill(null)}
                >
                  Fechar
                </button>
              </div>
              {drill.contratos.length ? (
                <ul className="space-y-1 text-sm">
                  {drill.contratos.map((c) => (
                    <li key={c.id} className="flex justify-between gap-3">
                      <span>{c.nome}</span>
                      <span className="tabular-nums">{formatBRL(c.valorMensal)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-aion-muted">Nenhum contrato ativo neste mês.</p>
              )}
              {drill.os.length ? (
                <DataTable data={drill.os} columns={osColumns} />
              ) : (
                <p className="text-sm text-aion-muted">Nenhuma OS de reparo médico neste mês.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-aion-muted">
              Clique em um mês no gráfico para ver contratos e OS.
            </p>
          )
        }
        ficha={FICHA}
        detalhesItems={[
          {
            id: "denominador",
            title: "Valor do parque (denominador)",
            children: (
              <div className="space-y-2 text-sm text-aion-ink/85">
                <p>
                  Fonte efetiva:{" "}
                  <Badge tone={efetivo.fonte === "api" ? "ok" : "warn"}>
                    {efetivo.fonte ?? "nenhuma"}
                  </Badge>{" "}
                  · {formatBRL(efetivo.valor)}
                </p>
                <p>
                  Valor puxado do cadastro de equipamentos (substituição, todos os cadastrados).
                  Persistido: {formatBRL(apiPersistida)}. Ref. antiga 57 mi:{" "}
                  {formatBRL(PARQUE_META_REFERENCIA)} (não usada no cálculo).
                </p>
                {apiResumo ? (
                  <>
                    <p>
                      API live (todos — denominador):{" "}
                      <strong className="tabular-nums">
                        {formatBRL(apiResumo.substituicao.todos.total)}
                      </strong>{" "}
                      ({apiResumo.substituicao.todos.pctPreenchidos.toFixed(1)}% preenchidos)
                    </p>
                    <p>
                      API live (médicos — auditoria):{" "}
                      <strong className="tabular-nums">
                        {formatBRL(apiResumo.substituicao.medicos.total)}
                      </strong>
                    </p>
                    <p className="text-xs text-aion-muted">
                      Sem <code>incluirCustoSubstituicao=true</code>, ValorDeSubstituicao vem 0.
                    </p>
                  </>
                ) : null}
                <p>
                  Cadastro:{" "}
                  <Link href="/cadastros/parque" className="text-aion-blue underline">
                    /cadastros/parque
                  </Link>
                </p>
              </div>
            ),
          },
          {
            id: "numerador",
            title: "Despesa mensal (numerador)",
            children: (
              <div className="space-y-2 text-sm text-aion-ink/85">
                <p>
                  Contratos da API GlobalThings (vigência + parcelas no mês) + custo das OS de reparo
                  de equipamentos médicos fechadas no mês (mesmo recorte de gasto-reparo).
                </p>
                <p>
                  No mês: soma <code className="text-xs">Parcelas.ValorMoeda</code> com{" "}
                  <code className="text-xs">DataVencimento</code> no mês; sem parcelas, rateia{" "}
                  <code className="text-xs">ValorTotal</code> / vigência (
                  <code className="text-xs">DataInicio</code> →{" "}
                  <code className="text-xs">DataFimVigencia</code> ou{" "}
                  <code className="text-xs">DataFim</code>).
                </p>
                <p>
                  OS brutas no intervalo: {bruta}. Contratos na API: {contratos.length}.
                </p>
                <p>
                  Lista de contratos:{" "}
                  <Link href="/cadastros/contratos" className="text-aion-blue underline">
                    /cadastros/contratos
                  </Link>{" "}
                  (fonte: API GlobalThings).
                </p>
              </div>
            ),
          },
        ]}
      />

      <ChartFullscreenDialog
        open={open}
        ready={ready}
        title={`Despesa mensal · ${range.label}`}
        onClose={closeFullscreen}
      >
        <DespesaParqueBarChart
          data={chartData}
          xKey="name"
          stacked={empilhar}
          className="h-[70vh]"
          onRowClick={openMes}
        />
      </ChartFullscreenDialog>
    </>
  );
}
