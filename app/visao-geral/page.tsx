"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SimplePieChart } from "@/components/charts/charts";
import { KpiCard, toneFromPct } from "@/components/kpi/kpi-card";
import { PendingBanner, SectionError } from "@/components/pending/pending-banner";
import { PageHeader } from "@/components/shell/page-header";
import { Sheet } from "@/components/ui/sheet";
import { DataTable } from "@/components/tables/data-table";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { useScopedFilters } from "@/hooks/use-scoped-filters";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { filterCronograma, filterDisponibilidade, filterOs, filterTmef } from "@/lib/pbi/apply-filters";
import { cronogramaStatus, formatNumber, formatPct, mixCorretivaPreventiva, mtbfMedio, mttrMedio, preventivasEmDia, slaAtendimento, slaSolucao, disponibilidadeMedia } from "@/lib/pbi/indicators";
import type { CronogramaItem, CronogramaView, DisponibilidadeItem, OsAnaliticoItem, TmefItem } from "@/lib/pbi/types";

type Drill = {
  title: string;
  subtitle?: string;
  rows: Array<Record<string, unknown>>;
  columns: ColumnDef<Record<string, unknown>, unknown>[];
} | null;

export default function VisaoGeralClassicaPage() {
  const { filters } = useScopedFilters();
  const [drill, setDrill] = useState<Drill>(null);

  const cronogramaQ = usePbiQuery<CronogramaItem[]>("cronograma", filters);
  const osQ = usePbiQuery<OsAnaliticoItem[]>("os-analitico", filters);
  const tmefQ = usePbiQuery<TmefItem[]>("tmef", filters);
  const dispQ = usePbiQuery<DisponibilidadeItem[]>("disp-equipamento-mes", filters, undefined, filters.empresaIds.length > 0);
  const tpmQ = usePbiQuery<unknown[]>("tpm", filters);

  const cronograma = useMemo(
    () => filterCronograma(dataOf(cronogramaQ.data) ?? [], filters).map(cronogramaStatus),
    [cronogramaQ.data, filters],
  );
  const os = useMemo(() => filterOs(dataOf(osQ.data) ?? [], filters), [osQ.data, filters]);
  const tmef = useMemo(() => filterTmef(dataOf(tmefQ.data) ?? [], filters), [tmefQ.data, filters]);
  const disp = useMemo(
    () => filterDisponibilidade(dataOf(dispQ.data) ?? [], filters),
    [dispQ.data, filters],
  );

  const prev = preventivasEmDia(cronograma);
  const mix = mixCorretivaPreventiva(os);
  const slaA = slaAtendimento(os);
  const slaS = slaSolucao(os);
  const dispMedia = disponibilidadeMedia(disp);
  const mtbf = mtbfMedio(disp, tmef);
  const mttr = mttrMedio(disp);

  const cols = (keys: string[]): ColumnDef<Record<string, unknown>, unknown>[] =>
    keys.map((key) => ({ accessorKey: key, header: key }));

  return (
    <div>
      <PageHeader
        title="Visão geral (clássica)"
        description="Painel anterior com vários KPIs. A tela inicial agora é Indicadores — validação."
      />

      {tpmQ.data && !tpmQ.data.ok && tpmQ.data.disabled ? (
        <div className="mb-4">
          <PendingBanner title="Tempo de parada médio (TPM) indisponível" detail={tpmQ.data.pendingReason} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Disponibilidade média"
          value={formatPct(dispMedia)}
          hint={filters.empresaIds.length ? `${disp.length} equipamentos` : "Informe o ID da empresa para carregar"}
          tone={toneFromPct(dispMedia)}
          loading={dispQ.isLoading}
          error={errorOf(dispQ.data)?.message}
          onClick={() =>
            setDrill({
              title: "Disponibilidade do parque",
              rows: disp as unknown as Array<Record<string, unknown>>,
              columns: cols(["Tag", "EquipamentoDescricaoCompleta", "SetorDescricao", "DisponibilidadePercentualPeriodo", "TMEF", "TMPR"]),
            })
          }
        />
        <KpiCard
          label="MTBF médio"
          value={formatNumber(mtbf)}
          hint="TMEF (dias) · fonte 4.6 / 4.7"
          loading={tmefQ.isLoading || dispQ.isLoading}
          error={errorOf(tmefQ.data)?.message}
          onClick={() =>
            setDrill({
              title: "MTBF por equipamento",
              rows: tmef as unknown as Array<Record<string, unknown>>,
              columns: cols(["Tag", "Equipamento", "Setor", "MTBF", "Os"]),
            })
          }
        />
        <KpiCard
          label="MTTR médio"
          value={formatNumber(mttr)}
          hint="TMPR da disponibilidade mensal"
          loading={dispQ.isLoading}
          onClick={() =>
            setDrill({
              title: "TMPR por equipamento",
              rows: disp as unknown as Array<Record<string, unknown>>,
              columns: cols(["Tag", "EquipamentoDescricaoCompleta", "TMPR", "DiasParado"]),
            })
          }
        />
        <KpiCard
          label="% Preventivas em dia"
          value={formatPct(prev.value)}
          hint={`${prev.total} planos com data · ${prev.atrasados.length} atrasados`}
          tone={toneFromPct(prev.value)}
          loading={cronogramaQ.isLoading}
          error={errorOf(cronogramaQ.data)?.message}
          onClick={() =>
            setDrill({
              title: "Planos do cronograma",
              rows: cronograma as unknown as Array<Record<string, unknown>>,
              columns: cols(["Tag", "Equipamento", "PlanoDeManutencao", "ProximaRealizacao", "statusLabel"]),
            })
          }
        />
        <KpiCard
          label="% Corretiva"
          value={formatPct(mix.pctCorretiva)}
          hint={`${mix.corretiva} corretivas · ${mix.preventiva} preventivas`}
          loading={osQ.isLoading}
          error={errorOf(osQ.data)?.message}
          onClick={() =>
            setDrill({
              title: "OS do período",
              rows: os as unknown as Array<Record<string, unknown>>,
              columns: cols(["OS", "TipoDeManutencao", "SituacaoDaOS", "Setor", "Abertura"]),
            })
          }
        />
        <KpiCard
          label="% Preventiva"
          value={formatPct(mix.pctPreventiva)}
          hint="Proporção por TipoDeManutencao"
          loading={osQ.isLoading}
        />
        <KpiCard
          label="SLA atendimento"
          value={formatPct(slaA.value)}
          hint={slaA.total ? `${slaA.total} OS com ambas as datas` : "Poucas OS com limite preenchido"}
          tone={toneFromPct(slaA.value)}
          loading={osQ.isLoading}
          onClick={() =>
            setDrill({
              title: "SLA de atendimento",
              rows: [...slaA.ok, ...slaA.late] as unknown as Array<Record<string, unknown>>,
              columns: cols(["OS", "DataDoAtendimento", "DataLimiteDoAtendimento", "SituacaoDaOS"]),
            })
          }
        />
        <KpiCard
          label="SLA solução"
          value={formatPct(slaS.value)}
          hint={slaS.total ? `${slaS.total} OS com ambas as datas` : "Poucas OS com limite preenchido"}
          tone={toneFromPct(slaS.value)}
          loading={osQ.isLoading}
          onClick={() =>
            setDrill({
              title: "SLA de solução",
              rows: [...slaS.ok, ...slaS.late] as unknown as Array<Record<string, unknown>>,
              columns: cols(["OS", "DataDaSolucao", "DataLimiteDaSolucao", "SituacaoDaOS"]),
            })
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Mix corretiva × preventiva</h2>
          {osQ.isLoading ? (
            <ChartSkeleton />
          ) : errorOf(osQ.data) ? (
            <SectionError message={errorOf(osQ.data)!.message} />
          ) : (
            <SimplePieChart
              data={[
                { name: "Corretiva", value: mix.corretiva },
                { name: "Preventiva", value: mix.preventiva },
                { name: "Outros", value: mix.outros },
              ].filter((d) => d.value > 0)}
            />
          )}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Status do cronograma</h2>
          {cronogramaQ.isLoading ? (
            <ChartSkeleton />
          ) : (
            <SimplePieChart
              data={[
                { name: "Em dia", value: cronograma.filter((c: CronogramaView) => c.statusCalculado === "em_dia").length },
                { name: "Vence em breve", value: cronograma.filter((c) => c.statusCalculado === "vence_em").length },
                { name: "Atrasado", value: cronograma.filter((c) => c.statusCalculado === "atrasado").length },
                { name: "Sem data", value: cronograma.filter((c) => c.statusCalculado === "sem_data").length },
              ].filter((d) => d.value > 0)}
            />
          )}
        </section>
      </div>

      <Sheet open={!!drill} title={drill?.title ?? ""} subtitle={drill?.subtitle} onClose={() => setDrill(null)}>
        {drill ? <DataTable data={drill.rows} columns={drill.columns} pageSize={15} /> : null}
      </Sheet>
    </div>
  );
}
