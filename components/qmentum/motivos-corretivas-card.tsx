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
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { formatDateBR, parsePbiDate, startOfMonthISO, todayISO } from "@/lib/pbi/dates";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/pbi/filters";
import { FICHAS } from "@/lib/pbi/fichas";
import {
  MOTIVOS_CORRETIVAS_CAMPOS,
  buildMotivosCorretivas,
  filterOsPorCausa,
  filterOsPorOcorrencia,
  filterOsPorTag,
} from "@/lib/pbi/motivos-corretivas";
import {
  MAU_USO_KEYWORDS,
  buildMauUso,
  type MauUsoOsRow,
} from "@/lib/pbi/mau-uso";
import type { AnexoOsItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { VOLUME_EC_PERIODO_API, VOLUME_EC_TIPO_API, type RollingYearRange } from "@/lib/pbi/volume-ec";

type Aba = "causa" | "ocorrencia" | "mau-uso";

type Drill =
  | { kind: "causa"; title: string; rows: OsAnaliticoItem[] }
  | { kind: "ocorrencia"; title: string; rows: OsAnaliticoItem[] }
  | { kind: "tag"; title: string; rows: OsAnaliticoItem[] }
  | { kind: "mau-uso"; title: string; rows: OsAnaliticoItem[] }
  | null;

const FICHA = FICHAS["motivos-corretivas"];

const ANEXOS_FILTERS: DashboardFilters = {
  ...EMPTY_FILTERS,
  from: startOfMonthISO(),
  to: todayISO(),
  tipoManutencao: "Todos",
  somenteMedicos: false,
};

function Dl({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-aion-muted">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-aion-ink">{value || "—"}</dd>
    </div>
  );
}

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
  const axOsQ = usePbiQuery<AnexoOsItem[]>("anexos-os", ANEXOS_FILTERS);
  const anexos = dataOf(axOsQ.data) ?? [];
  const anexosError = errorOf(axOsQ.data)?.message ?? null;

  const [drill, setDrill] = useState<Drill>(null);
  const [aba, setAba] = useState<Aba>("causa");
  const [selectedMauUso, setSelectedMauUso] = useState<MauUsoOsRow | null>(null);

  const dados = useMemo(
    () => buildMotivosCorretivas(raw, range, medical.tags, medical.ids),
    [raw, range, medical.tags, medical.ids],
  );

  const mauUso = useMemo(() => buildMauUso(dados.noIntervalo, anexos), [dados.noIntervalo, anexos]);

  const clearSelection = useCallback(() => {
    setDrill(null);
    setSelectedMauUso(null);
  }, []);

  const openCausa = useCallback(
    (name: string) => {
      setSelectedMauUso(null);
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
      setSelectedMauUso(null);
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
      setSelectedMauUso(null);
      setDrill({
        kind: "tag",
        title: `Tag · ${tag}`,
        rows: filterOsPorTag(dados.noIntervalo, tag),
      });
    },
    [dados.noIntervalo],
  );

  const openMauUsoLista = useCallback(() => {
    setSelectedMauUso(null);
    setAba("mau-uso");
    setDrill({
      kind: "mau-uso",
      title: "Corretivas · Mau uso",
      rows: mauUso.rows.map((r) => r.os),
    });
  }, [mauUso.rows]);

  const setAbaAndClear = useCallback((next: Aba) => {
    setAba(next);
    setDrill(null);
    setSelectedMauUso(null);
  }, []);

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

  const mauUsoByOs = useMemo(() => {
    const map = new Map<string, MauUsoOsRow>();
    for (const row of mauUso.rows) {
      map.set(`${row.os.CodigoSerialOS}-${row.os.OS}`, row);
    }
    return map;
  }, [mauUso.rows]);

  const cols: ColumnDef<OsAnaliticoItem, unknown>[] = useMemo(
    () => [
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
      ...(aba === "mau-uso" || drill?.kind === "mau-uso"
        ? [
            {
              id: "foto",
              header: "Evidência",
              cell: ({ row }: { row: { original: OsAnaliticoItem } }) => {
                const key = `${row.original.CodigoSerialOS}-${row.original.OS}`;
                const hit = mauUsoByOs.get(key);
                return hit?.comFoto ? <Badge tone="info">Com foto</Badge> : <span className="text-aion-muted">—</span>;
              },
            } satisfies ColumnDef<OsAnaliticoItem, unknown>,
          ]
        : []),
    ],
    [aba, drill?.kind, mauUsoByOs],
  );

  const mauUsoTableCols: ColumnDef<MauUsoOsRow, unknown>[] = [
    {
      id: "os",
      header: "OS",
      accessorFn: (r) => r.os.OS,
    },
    {
      id: "tag",
      header: "Tag",
      accessorFn: (r) => r.os.Tag || "—",
    },
    {
      id: "setor",
      header: "Setor",
      accessorFn: (r) => r.os.Setor || "—",
    },
    {
      id: "causa",
      header: "Causa",
      accessorFn: (r) => r.os.Causa || "—",
    },
    {
      id: "ocorrencia",
      header: "Ocorrência",
      accessorFn: (r) => r.os.Ocorrencia || "—",
    },
    {
      id: "abertura",
      header: "Abertura",
      cell: ({ row }) => formatDateBR(parsePbiDate(row.original.os.Abertura)),
    },
    {
      id: "foto",
      header: "Evidência",
      cell: ({ row }) =>
        row.original.comFoto ? <Badge tone="info">Com foto</Badge> : <span className="text-aion-muted">—</span>,
    },
  ];

  const waiting = loading || medical.loading || axOsQ.isLoading;
  const medicalError =
    medical.error ?? (!medical.loading && !medical.ready ? "Índice de equipamentos médicos indisponível." : null);
  const Heading = headingAs === "page" ? PageHeader : IndicadorHeading;

  const detalhesItems: Array<{ id: string; title: string; children: ReactNode }> = [
    {
      id: "melhorias",
      title: "Melhorias / PDCA (próximo)",
      children: (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Placeholder honesto: esta tela cobre o <strong>monitoramento</strong> (Pareto + recorrência + mau uso). O plano
          de ação / PDCA (ação, responsável, prazo) ainda não está no app — fica para a próxima entrega.
        </p>
      ),
    },
    {
      id: "mau-uso-regra",
      title: "Regra · Mau uso",
      children: (
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Corretiva médica no intervalo de 12 meses cujo texto em{" "}
            <span className="font-mono text-xs">Causa / Ocorrencia / ObservacaoDaOS / Servico / Pendencia / JustificativaEncerramento</span>{" "}
            contém alguma keyword (substring, sem acento). Foto = anexo da OS com extensão de imagem ou prefixo{" "}
            <span className="font-mono text-xs">IMG_</span>, cruzado por <span className="font-mono text-xs">CodigoOS</span>{" "}
            / <span className="font-mono text-xs">OSId</span>.
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {MAU_USO_KEYWORDS.map((k) => (
              <Badge key={k} tone="default" className="normal-case tracking-normal">
                {k}
              </Badge>
            ))}
          </div>
          {anexosError ? (
            <p className="text-amber-800">Anexos indisponíveis: {anexosError}. A lista de mau uso segue sem badge de foto.</p>
          ) : null}
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
              <span className="font-mono text-xs">GET /api/pbi/os-analitico</span>
              <p className="mt-1 text-xs text-slate-500">
                periodo={VOLUME_EC_PERIODO_API} · tipoManutencao={VOLUME_EC_TIPO_API}
              </p>
            </OrigemCampo>
            <OrigemCampo label="Anexos">
              <span className="font-mono text-xs">GET /api/pbi/anexos-os</span>
            </OrigemCampo>
            <OrigemCampo label="Filtro local">
              Tag médica + isCorretiva + Abertura no intervalo rolante de 12 meses.
            </OrigemCampo>
            <OrigemCampo label="Campos">
              <span className="font-mono text-xs">{MOTIVOS_CORRETIVAS_CAMPOS.join(", ")}</span>
            </OrigemCampo>
            <OrigemCampo label="Funil" valueClassName="mt-1 text-sm font-semibold tabular-nums">
              {bruta} brutas · {dados.aposMedico} tag médica · {dados.total} corretivas no intervalo · {mauUso.total} mau
              uso · {mauUso.comFoto} com foto · {dados.semCausa} sem Causa · {dados.semOcorrencia} sem Ocorrência
            </OrigemCampo>
          </dl>
          <p className="text-sm">
            Qualidade do Pareto e do recorte de mau uso depende do preenchimento de Causa/Ocorrência no CMMS e dos anexos
            enviados na OS.
          </p>
        </div>
      ),
    },
  ];

  return (
    <>
      <IndicadorPageLayout
        loading={waiting}
        error={error || medicalError}
        ficha={FICHA}
        detalhesItems={detalhesItems}
        heading={
          <Heading
            title="Motivos das corretivas"
            description={`Pareto Causa/Ocorrência, recorrência por Tag e mau uso · corretivas médicas · ${range.label}. Melhorias (PDCA) = próximo.`}
          />
        }
        kpis={
          aba === "mau-uso" ? (
            <>
              <KpiCard
                label="Mau uso (12m)"
                value={String(mauUso.total)}
                hint="Keywords em Causa/Ocorrência/textos"
                tone={mauUso.total > 0 ? "warn" : "ok"}
                onClick={mauUso.total ? openMauUsoLista : undefined}
              />
              <KpiCard
                label="% das corretivas"
                value={mauUso.pctLabel}
                hint={`${mauUso.total} de ${dados.total}`}
              />
              <KpiCard
                label="Com foto"
                value={String(mauUso.comFoto)}
                hint="Anexo imagem (jpg/png/IMG_)"
                tone={mauUso.comFoto > 0 ? "ok" : "neutral"}
              />
              <KpiCard
                label="Corretivas (12m)"
                value={String(dados.total)}
                hint="Denominador do %"
              />
            </>
          ) : (
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
                label="Mau uso"
                value={String(mauUso.total)}
                hint={`${mauUso.pctLabel} das corretivas · ${mauUso.comFoto} com foto`}
                tone={mauUso.total > 0 ? "warn" : "ok"}
                onClick={mauUso.total ? openMauUsoLista : undefined}
              />
            </>
          )
        }
        chart={
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={aba === "causa"} onClick={() => setAbaAndClear("causa")}>
                Pareto Causa
              </FilterChip>
              <FilterChip active={aba === "ocorrencia"} onClick={() => setAbaAndClear("ocorrencia")}>
                Pareto Ocorrência
              </FilterChip>
              <FilterChip active={aba === "mau-uso"} onClick={() => setAbaAndClear("mau-uso")}>
                Mau uso ({mauUso.total})
              </FilterChip>
            </div>

            {aba === "mau-uso" ? (
              <ChartCard
                title="Corretivas por mau uso"
                hint="Keywords documentadas abaixo. Clique na linha para ver detalhe e anexos."
              >
                <div className="mb-3 space-y-2">
                  <p className="text-xs text-aion-muted">
                    Match em Causa, Ocorrência, Observação, Serviço, Pendência e Justificativa (substring, sem acento).
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MAU_USO_KEYWORDS.map((k) => (
                      <Badge key={k} tone="default" className="normal-case tracking-normal">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
                {mauUso.rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-aion-line bg-aion-mist/40 px-4 py-8 text-center text-sm text-aion-muted">
                    Nenhuma corretiva médica no período bateu as keywords de mau uso.
                  </p>
                ) : (
                  <DataTable
                    data={mauUso.rows}
                    columns={mauUsoTableCols}
                    pageSize={15}
                    onRowClick={(row) => {
                      setSelectedMauUso(row);
                      setDrill({
                        kind: "mau-uso",
                        title: `OS ${row.os.OS}`,
                        rows: [row.os],
                      });
                    }}
                  />
                )}
              </ChartCard>
            ) : (
              <>
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
              </>
            )}
          </div>
        }
        selectionList={
          <SelecaoOsLista
            hasSelection={!!drill}
            title={drill?.title}
            subtitle={drill ? `${drill.rows.length} OS` : undefined}
            emptyHint={
              aba === "mau-uso"
                ? "Clique em uma OS da lista de mau uso para ver o detalhe."
                : "Clique em uma barra do Pareto ou em uma Tag para listar as OS."
            }
            onClear={clearSelection}
          >
            {drill ? (
              <DataTable
                data={drill.rows}
                columns={cols}
                pageSize={15}
                onRowClick={
                  drill.kind === "mau-uso"
                    ? (os) => {
                        const hit = mauUsoByOs.get(`${os.CodigoSerialOS}-${os.OS}`);
                        if (hit) setSelectedMauUso(hit);
                      }
                    : undefined
                }
              />
            ) : null}
          </SelecaoOsLista>
        }
      />

      <Sheet
        open={!!selectedMauUso}
        title={selectedMauUso ? `OS ${selectedMauUso.os.OS}` : ""}
        subtitle={selectedMauUso ? `${selectedMauUso.os.Tag || "sem Tag"} · mau uso` : undefined}
        onClose={() => setSelectedMauUso(null)}
      >
        {selectedMauUso ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Dl label="Tag" value={selectedMauUso.os.Tag} />
              <Dl label="Equipamento" value={selectedMauUso.os.Equipamento} />
              <Dl label="Setor" value={selectedMauUso.os.Setor} />
              <Dl label="Abertura" value={formatDateBR(parsePbiDate(selectedMauUso.os.Abertura))} />
              <Dl label="Causa" value={selectedMauUso.os.Causa} />
              <Dl label="Ocorrência" value={selectedMauUso.os.Ocorrencia} />
              <Dl label="Situação" value={selectedMauUso.os.SituacaoDaOS} />
              <Dl
                label="Keywords"
                value={
                  <span className="flex flex-wrap gap-1">
                    {selectedMauUso.keywords.map((k) => (
                      <Badge key={k} tone="warn" className="normal-case tracking-normal">
                        {k}
                      </Badge>
                    ))}
                  </span>
                }
              />
            </dl>
            {(selectedMauUso.os.ObservacaoDaOS || selectedMauUso.os.Servico) && (
              <div className="space-y-2 text-sm">
                {selectedMauUso.os.ObservacaoDaOS ? (
                  <p>
                    <span className="font-semibold text-aion-muted">Observação: </span>
                    {selectedMauUso.os.ObservacaoDaOS}
                  </p>
                ) : null}
                {selectedMauUso.os.Servico ? (
                  <p>
                    <span className="font-semibold text-aion-muted">Serviço: </span>
                    {selectedMauUso.os.Servico}
                  </p>
                ) : null}
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-aion-muted">Anexos</p>
              {selectedMauUso.anexos.length === 0 ? (
                <p className="text-sm text-aion-muted">Nenhum anexo vinculado a esta OS.</p>
              ) : (
                <ul className="divide-y divide-aion-line rounded-lg border border-aion-line">
                  {selectedMauUso.anexos.map((a, i) => {
                    const foto = selectedMauUso.imagens.some(
                      (img) => img.Anexo === a.Anexo && img.LinkAnexo === a.LinkAnexo,
                    );
                    return (
                      <li key={`${a.Anexo}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          {a.LinkAnexo ? (
                            <a
                              href={a.LinkAnexo}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-aion-blue hover:underline"
                            >
                              {a.Anexo || "Anexo"}
                            </a>
                          ) : (
                            <span className="text-sm font-medium">{a.Anexo || "Anexo"}</span>
                          )}
                          <p className="text-xs text-aion-muted">{a.DataHoraInclusao || "—"}</p>
                        </div>
                        {foto ? <Badge tone="info">Foto</Badge> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
