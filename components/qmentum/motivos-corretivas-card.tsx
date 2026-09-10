"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SimpleBarChart } from "@/components/charts/charts";
import {
  ChartCard,
  IndicadorHeading,
  OrigemCampo,
} from "@/components/indicadores/chart-fullscreen";
import { IndicadorPageLayout } from "@/components/indicadores/indicador-page-layout";
import { SelecaoOsLista } from "@/components/indicadores/selecao-os-lista";
import { FilterChip } from "@/components/indicadores/indicador-section";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/kpi/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { formatDateBR, parsePbiDate } from "@/lib/pbi/dates";
import { FICHAS } from "@/lib/pbi/fichas";
import {
  MOTIVOS_CORRETIVAS_CAMPOS,
  buildMotivosCorretivas,
  filterOsPorCausa,
  filterOsPorOcorrencia,
  filterOsPorTag,
} from "@/lib/pbi/motivos-corretivas";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type Drill =
  | { kind: "causa"; title: string; rows: OsAnaliticoItem[] }
  | { kind: "ocorrencia"; title: string; rows: OsAnaliticoItem[] }
  | { kind: "tag"; title: string; rows: OsAnaliticoItem[] }
  | null;

const FICHA = FICHAS["motivos-corretivas"];

export function MotivosCorretivasCard({
  range,
  raw,
  bruta,
  loading,
  error,
  headingAs = "page",
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
  const [aba, setAba] = useState<"causa" | "ocorrencia">("causa");

  const dados = useMemo(
    () => buildMotivosCorretivas(raw, range, medical.tags, medical.ids),
    [raw, range, medical.tags, medical.ids],
  );

  const clearSelection = useCallback(() => setDrill(null), []);

  const openCausa = useCallback(
    (name: string) => {
      setDrill({
        kind: "causa",
        title: `Causa · ${name}`,
        rows: filterOsPorCausa(dados.noIntervalo, name),
      });
    },
    [dados.noIntervalo],
  );

  const openOcorrencia = useCallback(
    (name: string) => {
      setDrill({
        kind: "ocorrencia",
        title: `Ocorrência · ${name}`,
        rows: filterOsPorOcorrencia(dados.noIntervalo, name),
      });
    },
    [dados.noIntervalo],
  );

  const openTag = useCallback(
    (tag: string) => {
      setDrill({
        kind: "tag",
        title: `Tag · ${tag}`,
        rows: filterOsPorTag(dados.noIntervalo, tag),
      });
    },
    [dados.noIntervalo],
  );

  const pareto = aba === "causa" ? dados.causas : dados.ocorrencias;

  const chartData = useMemo(
    () =>
      pareto.map((r) => ({
        name: r.name.length > 28 ? `${r.name.slice(0, 26)}…` : r.name,
        fullName: r.name,
        count: r.count,
      })),
    [pareto],
  );

  const cols: ColumnDef<OsAnaliticoItem, unknown>[] = [
    { accessorKey: "OS", header: "OS" },
    { accessorKey: "Tag", header: "Tag" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    { accessorKey: "Setor", header: "Setor" },
    { accessorKey: "Causa", header: "Causa" },
    { accessorKey: "Ocorrencia", header: "Ocorrência" },
    {
      accessorKey: "Abertura",
      header: "Abertura",
      cell: ({ row }) => formatDateBR(parsePbiDate(row.original.Abertura)),
    },
    { accessorKey: "SituacaoDaOS", header: "Situação" },
  ];

  const waiting = loading || medical.loading;
  const medicalError =
    medical.error ?? (!medical.loading && !medical.ready ? "Índice de equipamentos médicos indisponível." : null);
  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "melhorias",
      title: "Melhorias / PDCA (próximo)",
      children: (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Placeholder honesto: esta tela cobre o <strong>monitoramento</strong> (Pareto + recorrência). O plano de
          ação / PDCA (ação, responsável, prazo) ainda não está no app — fica para a próxima entrega.
        </p>
      ),
    },
    {
      id: "origem",
      title: "De onde vêm os dados",
      children: (
        <div className="space-y-4 text-slate-700">
          <dl className="grid gap-3 sm:grid-cols-2">
            <OrigemCampo label="Endpoint">
              <span className="font-mono text-xs">GET /api/pbi/os-analitico</span>
              <p className="mt-1 text-xs text-slate-500">
                periodo={VOLUME_EC_PERIODO_API} · tipoManutencao={VOLUME_EC_TIPO_API}
              </p>
            </OrigemCampo>
            <OrigemCampo label="Filtro local">
              Tag médica + isCorretiva + Abertura no intervalo rolante de 12 meses.
            </OrigemCampo>
            <OrigemCampo label="Campos">
              <span className="font-mono text-xs">{MOTIVOS_CORRETIVAS_CAMPOS.join(", ")}</span>
            </OrigemCampo>
            <OrigemCampo label="Funil" valueClassName="mt-1 text-sm font-semibold tabular-nums">
              {bruta} brutas · {dados.aposMedico} tag médica · {dados.total} corretivas no intervalo ·{" "}
              {dados.semCausa} sem Causa · {dados.semOcorrencia} sem Ocorrência
            </OrigemCampo>
          </dl>
          <p className="text-sm">
            Qualidade do Pareto depende do preenchimento de Causa/Ocorrência no CMMS.
          </p>
        </div>
      ),
    },
  ];

  return (
    <IndicadorPageLayout
      loading={waiting}
      error={error || medicalError}
      ficha={FICHA}
      detalhesItems={detalhesItems}
      heading={
        <Heading
          title="Motivos das corretivas"
          description={`Pareto Causa/Ocorrência e recorrência por Tag · corretivas médicas · ${range.label}. Melhorias (PDCA) = próximo.`}
        />
      }
      kpis={
        <>
          <KpiCard label="Corretivas (12m)" value={String(dados.total)} hint="Tag médica + isCorretiva" />
          <KpiCard
            label="Sem Causa"
            value={String(dados.semCausa)}
            hint="Campo vazio no CMMS"
            tone={dados.semCausa > 0 ? "warn" : "ok"}
          />
          <KpiCard
            label="Sem Ocorrência"
            value={String(dados.semOcorrencia)}
            hint="Campo vazio no CMMS"
            tone={dados.semOcorrencia > 0 ? "warn" : "ok"}
          />
          <KpiCard
            label="Top Tag"
            value={dados.recorrenciaTags[0] ? String(dados.recorrenciaTags[0].count) : "—"}
            hint={dados.recorrenciaTags[0]?.tag ?? "Sem recorrência"}
            onClick={
              dados.recorrenciaTags[0]
                ? () => openTag(dados.recorrenciaTags[0].tag)
                : undefined
            }
          />
        </>
      }
      chart={
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={aba === "causa"} onClick={() => setAba("causa")}>
              Pareto Causa
            </FilterChip>
            <FilterChip active={aba === "ocorrencia"} onClick={() => setAba("ocorrencia")}>
              Pareto Ocorrência
            </FilterChip>
          </div>
          <ChartCard
            title={aba === "causa" ? "Pareto · Causa" : "Pareto · Ocorrência"}
            hint="Clique na barra para listar as OS."
          >
            <SimpleBarChart
              data={chartData}
              xKey="name"
              yKey="count"
              color="#0168b0"
              onRowClick={(row) => {
                const full = String(row.fullName ?? row.name);
                if (aba === "causa") openCausa(full);
                else openOcorrencia(full);
              }}
            />
          </ChartCard>

          <ChartCard title="Recorrência por Tag (top 20)" hint="Equipamentos que mais abrem corretiva.">
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tag</th>
                    <th className="px-3 py-2">Equipamento</th>
                    <th className="px-3 py-2">Setor</th>
                    <th className="px-3 py-2">OS</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.recorrenciaTags.map((r) => (
                    <tr
                      key={r.tag}
                      className="cursor-pointer border-t border-slate-100 hover:bg-aion-mist/60"
                      onClick={() => openTag(r.tag)}
                    >
                      <td className="px-3 py-2 font-medium text-aion-blue">{r.tag}</td>
                      <td className="px-3 py-2">{r.equipamento}</td>
                      <td className="px-3 py-2">{r.setor}</td>
                      <td className="px-3 py-2 tabular-nums">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      }
      selectionList={
        <SelecaoOsLista
          hasSelection={!!drill}
          title={drill?.title}
          subtitle={drill ? `${drill.rows.length} OS` : undefined}
          emptyHint="Clique em uma barra do Pareto ou em uma Tag para listar as OS."
          onClear={clearSelection}
        >
          {drill ? <DataTable data={drill.rows} columns={cols} pageSize={15} /> : null}
        </SelecaoOsLista>
      }
    />
  );
}
