"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import {
  ChartCard,
  ChartFullscreenDialog,
  useChartFullscreen,
} from "@/components/indicadores/chart-fullscreen";
import { GlobalThingsFreshness } from "@/components/indicadores/globalthings-freshness";
import { IndicadorPageLayout } from "@/components/indicadores/indicador-page-layout";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/tables/data-table";
import { CustoParqueChart, textoTooltipMes } from "@/components/charts/custo-parque-chart";
import { useCustoParque } from "@/hooks/use-custo-parque";
import {
  META_ANUAL_PCT,
  formatPctParque,
  rotuloStatus,
  type CustoParqueMes,
  type StatusMeta,
} from "@/lib/pbi/custo-manutencao-parque";
import { FICHAS } from "@/lib/pbi/fichas";
import { gastoReparoDoMes, type GastoReparoRow } from "@/lib/pbi/gasto-reparo";
import { formatBRL } from "@/lib/pbi/indicators";
import { PARQUE_ALERTA_DIAS } from "@/lib/pbi/parque-frescor";
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

/** Sem sessão (401 em parque/contratos): em vez de "Buscando dados…" para sempre (UX D1). */
function EntrarParaVerIndicador() {
  const [voltar, setVoltar] = useState("/indicadores/custo-manutencao-parque");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setVoltar(`${window.location.pathname}${window.location.search}`), []);
  return (
    <div className="space-y-4">
      <PageHeader title="Custo de manutenção do parque" description="Contratos de Manutenção + OS avulsas ÷ valor de substituição do parque." />
      <div role="status" data-testid="entrar-para-ver" className="rounded-xl border border-aion-line bg-white p-6">
        <p className="text-lg font-semibold text-aion-ink">Entre para ver os valores do indicador</p>
        <p className="mt-1 text-sm text-aion-muted">Os valores em R$ ficam restritos a administradores. O % e o status aparecem na Sala.</p>
        <Link
          href={`/cadastros/contratos?voltar=${encodeURIComponent(voltar)}`}
          className="mt-4 inline-flex rounded-lg bg-aion-blue px-4 py-2 text-sm font-semibold text-white"
        >
          Entrar
        </Link>
      </div>
    </div>
  );
}

export function CustoManutencaoParqueCard() {
  const { open, ready, openFullscreen, closeFullscreen } = useChartFullscreen();
  const [drill, setDrill] = useState<CustoParqueMes | null>(null);
  // Fonte única com o card da Sala TV (hooks/use-custo-parque.ts, I3).
  const {
    bruta, osResult, medical, eqQ, gasto, contratos, year, mesAtual, ind, faltando, semDados, atual, pctAtual, statusAtual, loading,
    apiResumo, escolha, frescor, semValor, precisaLogin,
  } = useCustoParque();

  if (precisaLogin) return <EntrarParaVerIndicador />;

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
              <div className="mt-2 space-y-1 text-sm text-aion-muted" data-testid="parque-frescor">
                <p>
                  {frescor.texto}
                  {escolha.fonte === "gravado" ? " (valor gravado; soma ao vivo indisponível)" : escolha.fonte === "ao-vivo" ? " (soma ao vivo dos equipamentos ativos)" : ""}
                  {apiResumo ? (
                    <> · <span data-testid="parque-com-valor">{apiResumo.substituicao.todos.preenchidos.toLocaleString("pt-BR")} de {apiResumo.nTotal.toLocaleString("pt-BR")} com valor</span></>
                  ) : null}
                </p>
                {ind.valorParque != null && frescor.desatualizado ? (
                  <p role="status" data-testid="parque-alerta" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                    <AlertTriangle className="mr-1 inline size-4" aria-hidden />
                    O valor do parque tem mais de {PARQUE_ALERTA_DIAS} dias{frescor.dias != null ? ` (${frescor.dias} dias)` : ""}.{" "}
                    <Link href="/cadastros/parque" className="underline">Atualizar o valor do parque</Link>
                  </p>
                ) : null}
                {semValor.length > 0 ? (
                  <details data-testid="parque-sem-valor" className="rounded-lg border border-aion-line bg-aion-mist px-3 py-2 text-aion-ink">
                    <summary className="cursor-pointer">{semValor.length.toLocaleString("pt-BR")} equipamentos ativos sem valor de substituição (fora da soma)</summary>
                    <div className="mt-2 max-h-72 overflow-auto">
                      <table className="w-full text-xs" aria-label="Equipamentos ativos sem valor de substituição">
                        <thead className="text-left"><tr><th className="py-1 pr-2">Tag</th><th className="py-1 pr-2">Equipamento</th><th className="py-1 pr-2">Modelo</th><th className="py-1">Setor</th></tr></thead>
                        <tbody>
                          {semValor.map((e) => (
                            <tr key={`${e.Id}-${e.Tag}`} className="border-t border-aion-line"><td className="py-1 pr-2 tabular-nums">{e.Tag}</td><td className="py-1 pr-2">{e.Equipamento}</td><td className="py-1 pr-2">{e.Modelo}</td><td className="py-1">{e.Setor}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : null}
              </div>
              <GlobalThingsFreshness results={[osResult, medical.result, eqQ.data]} />
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
            <CustoParqueChart months={ind.months} indisponivel={semDados ? `Não foi possível calcular: ${faltando.join("; ")}.` : null} onMonthClick={setDrill} />
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
                          <td className="px-3 py-2 text-right tabular-nums">{semDados ? "—" : formatBRL(m.contratos)}</td>
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
                {drill.suspensosNoMes?.length ? (
                  <p className="text-sm text-aion-muted" data-testid="linha-suspensos">
                    {drill.suspensosNoMes.length === 1 ? "1 contrato suspenso" : `${drill.suspensosNoMes.length} contratos suspensos`} – {formatBRL(drill.suspensosValor)} fora do custo
                  </p>
                ) : null}
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
        <CustoParqueChart months={ind.months} indisponivel={semDados ? `Não foi possível calcular: ${faltando.join("; ")}.` : null} className="h-[70vh]" onMonthClick={setDrill} />
      </ChartFullscreenDialog>
    </>
  );
}
