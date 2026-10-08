"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { SelecaoOsLista } from "@/components/indicadores/selecao-os-lista";
import { FilterChip } from "@/components/indicadores/indicador-section";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import {
  buildOficinasPlanoComparativo,
  type OficinaPlanoCelula,
  type OficinaPlanoComparativo,
} from "@/lib/pbi/oficinas-plano-comparativo";
import {
  OFICINAS_VOLUME_PLANO,
  filterOsOficinaEquals,
  filterOsOficinaEqualsIn,
  volumeEcDoMes,
  volumeEcDoPeriodo,
  type OficinaPlanoFilterKey,
  type RollingYearRange,
  type VolumeEcMovimento,
  type VolumeEcRow,
} from "@/lib/pbi/volume-ec";

type DrillEscopo = OficinaPlanoFilterKey | "consolidado";

type DrillState = {
  title: string;
  subtitle: string;
  mesLabel?: string;
  year?: number;
  month?: number;
  escopo: DrillEscopo;
  rows: VolumeEcRow[];
} | null;

function toneMovimento(value: VolumeEcMovimento) {
  if (value === "Fechada") return "ok" as const;
  if (value === "Ambas") return "info" as const;
  return "warn" as const;
}

function filtroOsEscopo(raw: OsAnaliticoItem[], escopo: DrillEscopo): OsAnaliticoItem[] {
  if (escopo === "consolidado" || escopo === "todas") {
    return filterOsOficinaEqualsIn(
      raw,
      OFICINAS_VOLUME_PLANO.map((o) => o.oficinaEquals),
    );
  }
  const cfg = OFICINAS_VOLUME_PLANO.find((o) => o.filterKey === escopo);
  if (!cfg) return [];
  return filterOsOficinaEquals(raw, cfg.oficinaEquals);
}

function rotuloEscopo(escopo: DrillEscopo) {
  if (escopo === "consolidado" || escopo === "todas") return "Consolidado (3 oficinas)";
  return OFICINAS_VOLUME_PLANO.find((o) => o.filterKey === escopo)?.chipLabel ?? escopo;
}

function CelulaMetricas({
  cell,
  onDrill,
}: {
  cell: OficinaPlanoCelula;
  onDrill: (modo: "abertas" | "fechadas" | "todas") => void;
}) {
  const pctClass =
    cell.abertas <= 0
      ? "text-slate-400"
      : cell.pctExecutada >= 100
        ? "font-semibold text-emerald-700"
        : "font-semibold text-amber-700";

  return (
    <div className="inline-grid grid-cols-3 gap-1 tabular-nums text-sm">
      <button
        type="button"
        className="rounded px-1 py-0.5 text-slate-800 hover:bg-sky-50 hover:text-sky-900"
        title="Drill: OS abertas neste mês"
        onClick={() => onDrill("abertas")}
      >
        {cell.abertas}
      </button>
      <button
        type="button"
        className="rounded px-1 py-0.5 text-slate-800 hover:bg-sky-50 hover:text-sky-900"
        title="Drill: OS fechadas neste mês"
        onClick={() => onDrill("fechadas")}
      >
        {cell.fechadas}
      </button>
      <button
        type="button"
        className={`rounded px-1 py-0.5 hover:bg-sky-50 ${pctClass}`}
        title={`${cell.fechadas} fechadas ÷ ${cell.abertas} abertas — clique para listar`}
        onClick={() => onDrill("todas")}
      >
        {cell.pctLabel}
      </button>
    </div>
  );
}

export function OficinasPlanoComparativoTabela({
  raw,
  range,
  loading,
}: {
  raw: OsAnaliticoItem[];
  range: RollingYearRange;
  loading?: boolean;
}) {
  const data = useMemo(() => buildOficinasPlanoComparativo(raw, range), [raw, range]);
  const [drill, setDrill] = useState<DrillState>(null);
  const [mesFiltro, setMesFiltro] = useState<VolumeEcMovimento | "Todas">("Todas");

  const abrirDrillMes = useCallback(
    (
      mes: { year: number; month: number; label: string },
      escopo: DrillEscopo,
      modo: "abertas" | "fechadas" | "todas",
      cell: OficinaPlanoCelula,
    ) => {
      const filtradas = filtroOsEscopo(raw, escopo);
      const rows = volumeEcDoMes(filtradas, mes.year, mes.month);
      const filtradasModo =
        modo === "abertas"
          ? rows.filter((r) => r.movimento === "Aberta" || r.movimento === "Ambas")
          : modo === "fechadas"
            ? rows.filter((r) => r.movimento === "Fechada" || r.movimento === "Ambas")
            : rows;
      const modoLabel =
        modo === "abertas" ? "abertas" : modo === "fechadas" ? "fechadas" : "abertas e fechadas";
      setMesFiltro(modo === "abertas" ? "Aberta" : modo === "fechadas" ? "Fechada" : "Todas");
      setDrill({
        title: `${rotuloEscopo(escopo)} · ${mes.label}`,
        subtitle: `${cell.abertas} abertas · ${cell.fechadas} fechadas · ${cell.pctLabel} · listando ${modoLabel}`,
        mesLabel: mes.label,
        year: mes.year,
        month: mes.month,
        escopo,
        rows: filtradasModo,
      });
    },
    [raw],
  );

  const abrirDrillAno = useCallback(
    (escopo: DrillEscopo, cell: OficinaPlanoCelula, modo: "abertas" | "fechadas" | "todas") => {
      const filtradas = filtroOsEscopo(raw, escopo);
      const tipo = modo === "abertas" ? "aberta" : modo === "fechadas" ? "fechada" : "todas";
      const rows = volumeEcDoPeriodo(filtradas, range, tipo);
      setMesFiltro(modo === "abertas" ? "Aberta" : modo === "fechadas" ? "Fechada" : "Todas");
      setDrill({
        title: `${rotuloEscopo(escopo)} · ano ${range.start.getFullYear()}`,
        subtitle: `${cell.abertas} abertas · ${cell.fechadas} fechadas · ${cell.pctLabel} no ano`,
        escopo,
        rows,
      });
    },
    [raw, range],
  );

  const limpar = useCallback(() => {
    setDrill(null);
    setMesFiltro("Todas");
  }, []);

  const drillVisible = useMemo(() => {
    if (!drill) return [];
    if (mesFiltro === "Todas") return drill.rows;
    if (mesFiltro === "Ambas") return drill.rows.filter((r) => r.movimento === "Ambas");
    return drill.rows.filter((r) => r.movimento === mesFiltro || r.movimento === "Ambas");
  }, [drill, mesFiltro]);

  const cols = useMemo<ColumnDef<VolumeEcRow, unknown>[]>(
    () => [
      { accessorKey: "OS", header: "OS" },
      {
        accessorKey: "movimento",
        header: "Movimento",
        cell: ({ row }) => (
          <Badge tone={toneMovimento(row.original.movimento)}>{row.original.movimento}</Badge>
        ),
      },
      { accessorKey: "Oficina", header: "Oficina" },
      { accessorKey: "TipoDeManutencao", header: "Tipo" },
      { accessorKey: "Tag", header: "Tag" },
      { accessorKey: "Equipamento", header: "Equipamento" },
      { accessorKey: "Abertura", header: "Abertura" },
      { accessorKey: "Fechamento", header: "Fechamento" },
      { accessorKey: "SituacaoDaOS", header: "Situação" },
    ],
    [],
  );

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="space-y-4">
      <ComparativoView
        data={data}
        year={range.start.getFullYear()}
        onDrillMes={abrirDrillMes}
        onDrillAno={abrirDrillAno}
      />

      <SelecaoOsLista
        hasSelection={Boolean(drill)}
        title={drill?.title}
        subtitle={drill?.subtitle}
        emptyHint="Clique em Abert. / Fech. / % na tabela (ou nos cards) para listar as OS daquele mês e oficina."
        onClear={limpar}
        filters={
          drill ? (
            <>
              <FilterChip active={mesFiltro === "Todas"} onClick={() => setMesFiltro("Todas")}>
                Todas ({drill.rows.length})
              </FilterChip>
              <FilterChip active={mesFiltro === "Aberta"} onClick={() => setMesFiltro("Aberta")}>
                Abertas
              </FilterChip>
              <FilterChip active={mesFiltro === "Fechada"} onClick={() => setMesFiltro("Fechada")}>
                Fechadas
              </FilterChip>
            </>
          ) : null
        }
      >
        {drill ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Exibindo {drillVisible.length} OS · {rotuloEscopo(drill.escopo)}
              {drill.mesLabel ? ` · ${drill.mesLabel}` : ""}
            </p>
            <DataTable data={drillVisible} columns={cols} pageSize={15} />
          </div>
        ) : null}
      </SelecaoOsLista>
    </div>
  );
}

function ComparativoView({
  data,
  year,
  onDrillMes,
  onDrillAno,
}: {
  data: OficinaPlanoComparativo;
  year: number;
  onDrillMes: (
    mes: { year: number; month: number; label: string },
    escopo: DrillEscopo,
    modo: "abertas" | "fechadas" | "todas",
    cell: OficinaPlanoCelula,
  ) => void;
  onDrillAno: (escopo: DrillEscopo, cell: OficinaPlanoCelula, modo: "abertas" | "fechadas" | "todas") => void;
}) {
  const cards: Array<{ escopo: DrillEscopo; cell: OficinaPlanoCelula; oficinaLabel: string }> = [
    ...data.totais.map((t) => ({
      escopo: t.filterKey as DrillEscopo,
      cell: t,
      oficinaLabel: t.oficinaLabel,
    })),
    {
      escopo: "consolidado" as const,
      cell: data.consolidado,
      oficinaLabel: data.consolidado.oficinaLabel,
    },
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Preventivas por oficina · abertas × fechadas ({year})
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Em cada mês (ex.: janeiro): quantas OS <strong>abriram</strong> vs quantas{" "}
            <strong>fecharam</strong> naquela oficina. O % sozinho engana (pode ficar 100%) — por isso
            mostramos sempre as <strong>quantidades</strong>. Clique no número para o drill-down das OS.
            Oficinas: Preventiva, Calibração e Segurança elétrica (TSE) + consolidado. Sem Oficina Geral.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ escopo, cell, oficinaLabel }) => (
          <div
            key={escopo}
            className={`rounded-xl border px-3 py-3 ${
              escopo === "consolidado"
                ? "border-sky-200 bg-sky-50/70"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {cell.chipLabel}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-500" title={oficinaLabel}>
              {oficinaLabel}
            </p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <button
                type="button"
                className="text-left"
                onClick={() => onDrillAno(escopo, cell, "todas")}
                title="Listar OS do ano"
              >
                <div className="text-3xl font-semibold tabular-nums text-slate-900">{cell.pctLabel}</div>
                <div className="text-xs text-slate-600">% fechadas ÷ abertas no ano</div>
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-sky-300"
                onClick={() => onDrillAno(escopo, cell, "abertas")}
              >
                <div className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  Abertas
                </div>
                <div className="text-xl font-semibold tabular-nums text-slate-900">{cell.abertas}</div>
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-sky-300"
                onClick={() => onDrillAno(escopo, cell, "fechadas")}
              >
                <div className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  Fechadas
                </div>
                <div className="text-xl font-semibold tabular-nums text-slate-900">{cell.fechadas}</div>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2">Mês</th>
              {data.totais.map((t) => (
                <th key={t.filterKey} className="px-3 py-2 text-center" colSpan={1}>
                  {t.chipLabel}
                </th>
              ))}
              <th className="bg-sky-50 px-3 py-2 text-center text-sky-900">Consolidado</th>
            </tr>
            <tr className="border-t border-slate-200">
              <th className="sticky left-0 bg-slate-50 px-3 py-1" />
              {[...data.totais, data.consolidado].map((t) => (
                <th key={`${t.filterKey}-sub`} className="px-1 py-1 text-center font-normal">
                  <span className="inline-grid grid-cols-3 gap-1 text-[10px]">
                    <span>Abert.</span>
                    <span>Fech.</span>
                    <span>%</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.months.map((mes) => (
              <tr key={mes.key} className="border-t border-slate-100">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium">{mes.label}</td>
                {mes.porOficina.map((cell) => (
                  <td key={`${mes.key}-${cell.filterKey}`} className="px-1 py-2 text-center">
                    <CelulaMetricas
                      cell={cell}
                      onDrill={(modo) =>
                        onDrillMes(
                          { year: mes.year, month: mes.month, label: mes.label },
                          cell.filterKey as DrillEscopo,
                          modo,
                          cell,
                        )
                      }
                    />
                  </td>
                ))}
                <td className="bg-sky-50/50 px-1 py-2 text-center">
                  <CelulaMetricas
                    cell={mes.consolidado}
                    onDrill={(modo) =>
                      onDrillMes(
                        { year: mes.year, month: mes.month, label: mes.label },
                        "consolidado",
                        modo,
                        mes.consolidado,
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Exemplo de leitura: em janeiro, Preventiva com 40 abertas e 40 fechadas = 100% — o volume (40)
        é o que importa. Clique em 40 ou 100% para ver as OS.
      </p>
    </section>
  );
}
