"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/kpi/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { FilterChip } from "@/components/indicadores/indicador-section";
import { OrigemCampo } from "@/components/indicadores/chart-fullscreen";
import { FichaIndicadorView } from "@/components/indicadores/ficha-indicador";
import { useGapPreventiva } from "@/hooks/use-gap-preventiva";
import { FICHAS } from "@/lib/pbi/fichas";
import {
  filterGapRows,
  isAltaCriticidade,
  type GapPreventivaRow,
} from "@/lib/pbi/gap-preventiva";

const FICHA = FICHAS["gap-preventiva"];

function SimNao({ ok }: { ok: boolean }) {
  return <Badge tone={ok ? "ok" : "default"}>{ok ? "Sim" : "Não"}</Badge>;
}

export function GapPreventivaView() {
  const { janela, dados, brutaEquipamentos, brutaCronograma, loading, error } = useGapPreventiva();
  const [criticidade, setCriticidade] = useState("Todas");
  const [setor, setSetor] = useState("Todos");
  const [situacao, setSituacao] = useState("Todas");

  const filtradas = useMemo(
    () => filterGapRows(dados.semPreventiva, { criticidade, setor, situacao }),
    [dados.semPreventiva, criticidade, setor, situacao],
  );

  const altaFiltradas = filtradas.filter((r) => isAltaCriticidade(r.criticidade)).length;

  const cols: ColumnDef<GapPreventivaRow, unknown>[] = [
    { accessorKey: "tag", header: "Tag" },
    { accessorKey: "equipamento", header: "Descrição" },
    { accessorKey: "setor", header: "Setor" },
    { accessorKey: "criticidade", header: "Criticidade" },
    { accessorKey: "situacao", header: "Situação" },
    {
      id: "calib",
      header: "Tem calib?",
      cell: ({ row }) => <SimNao ok={row.original.temCalibracao} />,
    },
    {
      id: "tse",
      header: "Tem TSE?",
      cell: ({ row }) => <SimNao ok={row.original.temTse} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sem preventiva no plano"
        description={`Parque médico ativo × cronograma (${janela.from} → ${janela.to}). Preventiva é obrigatória; calibração e TSE são informativos.`}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : (
        <>
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Sem preventiva"
              value={String(filtradas.length)}
              hint={
                criticidade !== "Todas" || setor !== "Todos" || situacao !== "Todas"
                  ? "Com filtros ativos"
                  : `de ${dados.parqueMedicoComTag} médicos com Tag`
              }
              tone={filtradas.length > 0 ? "danger" : "ok"}
            />
            <KpiCard
              label="ALTA sem preventiva"
              value={String(
                criticidade !== "Todas" || setor !== "Todos" || situacao !== "Todas"
                  ? altaFiltradas
                  : dados.altaSemPreventiva,
              )}
              hint="Criticidade Alta / Crítico"
              tone={
                (criticidade !== "Todas" || setor !== "Todos" || situacao !== "Todas"
                  ? altaFiltradas
                  : dados.altaSemPreventiva) > 0
                  ? "warn"
                  : "ok"
              }
            />
            <KpiCard
              label="Com preventiva"
              value={String(dados.comPreventiva)}
              hint="Já classificados no plano (loose)"
              tone="ok"
            />
            <KpiCard
              label="Parque médico (Tag)"
              value={String(dados.parqueMedicoComTag)}
              hint="Ativos · recorte médico"
              tone="neutral"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip active={criticidade === "Todas"} onClick={() => setCriticidade("Todas")}>
              Criticidade: Todas
            </FilterChip>
            {dados.criticidades.map((c) => (
              <FilterChip key={c} active={criticidade === c} onClick={() => setCriticidade(c)}>
                {c}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={setor === "Todos"} onClick={() => setSetor("Todos")}>
              Setor: Todos
            </FilterChip>
            {dados.setores.slice(0, 24).map((s) => (
              <FilterChip key={s} active={setor === s} onClick={() => setSetor(s)}>
                {s}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={situacao === "Todas"} onClick={() => setSituacao("Todas")}>
              Situação: Todas
            </FilterChip>
            {dados.situacoes.map((s) => (
              <FilterChip key={s} active={situacao === s} onClick={() => setSituacao(s)}>
                {s}
              </FilterChip>
            ))}
          </div>

          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            Lista = equipamentos <strong>sem Preventiva</strong> no cronograma. Colunas “Tem calib?” / “Tem TSE?”
            são informativas (não obrigatórias para todos).
          </p>

          <DataTable data={filtradas} columns={cols} pageSize={20} />

          <FichaIndicadorView ficha={FICHA} hideNome />

          <Accordion
            items={[
              {
                id: "origem",
                title: "De onde vêm os dados",
                children: (
                  <div className="space-y-4 text-slate-700">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <OrigemCampo label="Endpoint equipamentos">
                        <span className="font-mono text-xs">GET /api/pbi/v1/…equipamentos</span>
                        <p className="mt-1 text-xs text-slate-500">via /api/pbi/equipamentos · apenasAtivos=true</p>
                      </OrigemCampo>
                      <OrigemCampo label="Endpoint cronograma">
                        <span className="font-mono text-xs">GET /api/pbi/v1/cronograma</span>
                        <p className="mt-1 text-xs text-slate-500">
                          dataInicio={janela.from} · dataFim={janela.to}
                        </p>
                      </OrigemCampo>
                      <OrigemCampo label="Classificação do plano">
                        Loose: classifyPlanoEc(TipoDeManutencao) || classifyPlanoEc(PlanoDeManutencao). Tipo vazio
                        não zera cobertura.
                      </OrigemCampo>
                      <OrigemCampo label="Recorte">
                        Equipamentos ativos com Tag + isEquipamentoMedico. Gap = sem Preventiva.
                      </OrigemCampo>
                      <OrigemCampo label="Quantidade bruta (API)" valueClassName="mt-1 text-sm font-semibold tabular-nums">
                        {brutaEquipamentos} equipamentos · {brutaCronograma} linhas cronograma
                      </OrigemCampo>
                      <OrigemCampo label="Após filtro" valueClassName="mt-1 text-sm font-semibold tabular-nums">
                        {dados.parqueMedicoComTag} médicos · {dados.semPreventiva.length} sem preventiva ·{" "}
                        {dados.tagsComPlanoLoose} tags com algum plano EC ·{" "}
                        {dados.linhasTipoVazioMasPlanoClassifica} linhas só pelo nome do Plano
                      </OrigemCampo>
                    </dl>
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
