"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { CsvButton } from "@/components/export/csv-button";
import { KpiCard } from "@/components/kpi/kpi-card";
import { PendingBanner, SectionError } from "@/components/pending/pending-banner";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { Sheet } from "@/components/ui/sheet";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useScopedFilters } from "@/hooks/use-scoped-filters";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { filterCronograma, filterEquipamentos, filterOs } from "@/lib/pbi/apply-filters";
import {
  MESES_ABREV,
  buildCronogramaAnual,
  buildOsMonthIndex,
  cronogramaMatrixCsvRows,
  filtersCrossYears,
  osForEquip,
  osPeriodoForYear,
  osRealizacaoDate,
  toOsRealizacao,
  yearFromGlobalFilters,
  type CronogramaEquipRow,
  type CronogramaMesCell,
  type CronogramaPlanRow,
  type MesCellStatus,
} from "@/lib/pbi/cronograma-anual";
import { formatDateBR, nowInSaoPaulo, toApiDateTime } from "@/lib/pbi/dates";
import { cronogramaStatus } from "@/lib/pbi/indicators";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem, OsResumidaItem } from "@/lib/pbi/types";
import { cn, uniqueSorted } from "@/lib/utils";

type Drill = {
  equip: CronogramaEquipRow;
  plan?: CronogramaPlanRow;
  month?: number;
};

const CSV_COLUMNS = [
  "Setor",
  "Tag",
  "Equipamento",
  "Tipo",
  ...MESES_ABREV,
  "Previstas",
  "Realizadas",
  "Periodicidade",
  "ProximaRealizacao",
  "DataDaUltima",
  "Observacao",
];

const cellClass: Record<MesCellStatus, string> = {
  realizada: "bg-emerald-600 text-white hover:bg-emerald-700",
  pendente: "bg-amber-400 text-amber-950 hover:bg-amber-500",
  atrasada: "bg-rose-600 text-white hover:bg-rose-700",
  vazia: "",
};

const cellLabel: Record<MesCellStatus, string> = {
  realizada: "realizada",
  pendente: "prevista, ainda não realizada",
  atrasada: "prevista e não realizada",
  vazia: "sem plano",
};

function yearOptions(selected: number, filterYear: number, todayYear: number) {
  return uniqueSorted([
    String(todayYear - 2),
    String(todayYear - 1),
    String(todayYear),
    String(todayYear + 1),
    String(filterYear),
    String(selected),
  ]).map(Number);
}

export default function CronogramaPage() {
  const { filters } = useScopedFilters();
  const today = useMemo(() => nowInSaoPaulo(), []);
  const todayYear = today.getFullYear();
  const filterYear = yearFromGlobalFilters(filters.from, filters.to, todayYear);
  const crossesYears = filtersCrossYears(filters.from, filters.to);

  const [year, setYear] = useState(filterYear);
  const [localSetores, setLocalSetores] = useState<string[]>([]);
  const [localTipos, setLocalTipos] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<Drill | null>(null);

  useEffect(() => {
    setYear(filterYear);
  }, [filterYear]);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const yearFilters = useMemo(
    () => ({ ...filters, from: yearStart, to: yearEnd }),
    [filters, yearStart, yearEnd],
  );

  const cronogramaQ = usePbiQuery<CronogramaItem[]>("cronograma", yearFilters, {
    dataInicio: toApiDateTime(yearStart),
    dataFim: toApiDateTime(yearEnd, true),
  });
  const osQ = usePbiQuery<OsAnaliticoItem[]>("os-analitico", yearFilters, {
    periodo: osPeriodoForYear(year, today),
    qtdPorPagina: "100000",
  });
  const osResumoQ = usePbiQuery<OsResumidaItem[]>("os-resumida", yearFilters, {
    periodo: osPeriodoForYear(year, today),
    qtdPorPagina: "100000",
  });
  const eqQ = usePbiQuery<EquipamentoItem[]>("equipamentos", filters, {
    apenasAtivos: "true",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "false",
  });

  const cronograma = useMemo(
    () => filterCronograma(dataOf(cronogramaQ.data) ?? [], filters),
    [cronogramaQ.data, filters],
  );
  const equipamentos = useMemo(
    () => filterEquipamentos(dataOf(eqQ.data) ?? [], filters),
    [eqQ.data, filters],
  );
  const os = useMemo(() => {
    const analitico = filterOs(dataOf(osQ.data) ?? [], filters).map(toOsRealizacao);
    const resumida = filterOs(dataOf(osResumoQ.data) ?? [], filters).map(toOsRealizacao);
    const seen = new Set(analitico.map((item) => item.CodigoSerialOS));
    return [...analitico, ...resumida.filter((item) => !seen.has(item.CodigoSerialOS))];
  }, [osQ.data, osResumoQ.data, filters]);

  const setorOptions = useMemo(
    () => uniqueSorted([...cronograma.map((i) => i.Setor), ...equipamentos.map((i) => i.Setor)]),
    [cronograma, equipamentos],
  );
  const tipoOptions = useMemo(
    () => uniqueSorted([...cronograma.map((i) => i.Equipamento), ...equipamentos.map((i) => i.Equipamento)]),
    [cronograma, equipamentos],
  );

  const { groups, kpis, semData } = useMemo(
    () =>
      buildCronogramaAnual({
        cronograma,
        os,
        equipamentos,
        year,
        somenteMedicos: filters.somenteMedicos,
        setores: localSetores,
        tiposEquipamento: localTipos,
        today,
      }),
    [cronograma, os, equipamentos, year, filters.somenteMedicos, localSetores, localTipos, today],
  );

  const osIndex = useMemo(
    () => buildOsMonthIndex(os, year, filters.somenteMedicos),
    [os, year, filters.somenteMedicos],
  );

  const csvRows = useMemo(() => cronogramaMatrixCsvRows(groups), [groups]);
  const allKpi = kpis[0];
  const loading = cronogramaQ.isLoading || osQ.isLoading;
  const cronoError = errorOf(cronogramaQ.data);
  const osError = errorOf(osQ.data) ?? errorOf(osResumoQ.data);
  const eqError = errorOf(eqQ.data);

  const toggleSetor = (setor: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(setor)) next.delete(setor);
      else next.add(setor);
      return next;
    });
  };

  const drillOs = drill
    ? osForEquip(osIndex, drill.equip.tag, drill.equip.equipamento, drill.equip.setor, drill.plan?.tipo).filter(
        (item) => {
          if (drill.month == null) return true;
          return osRealizacaoDate(item)?.getMonth() === drill.month;
        },
      )
    : [];

  return (
    <div>
      <PageHeader
        title="Cronograma anual"
        description="Matriz do ano por setor e equipamento: X marca preventiva, calibração ou TSE previstos no mês. Verde = realizada (OS no mês); âmbar = ainda no prazo; vermelho = mês já passou sem OS."
        actions={<CsvButton filename={`cronograma-anual-${year}.csv`} rows={csvRows} columns={[...CSV_COLUMNS]} />}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ano</label>
          <select
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions(year, filterYear, todayYear).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <MultiSelect label="Setor" options={setorOptions} value={localSetores} onChange={setLocalSetores} />
        <MultiSelect
          label="Tipo de equipamento"
          options={tipoOptions}
          value={localTipos}
          onChange={setLocalTipos}
          className="min-w-[220px]"
        />
        <div className="flex gap-2 pb-0.5">
          <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
            <ChevronsDownUp className="h-3.5 w-3.5" />
            Expandir todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCollapsed(new Set(groups.map((g) => g.setor)))}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Recolher todos
          </Button>
        </div>
      </div>

      {crossesYears ? (
        <p className="mb-4 text-xs text-slate-500">
          O período global cobre mais de um ano. A matriz usa {year} (ano de Início). Você pode trocar no seletor.
        </p>
      ) : null}

      {cronoError ? <SectionError message={cronoError.message} /> : null}
      {osError ? (
        <div className="mb-4">
          <SectionError message={`OS (realizadas): ${osError.message}`} />
        </div>
      ) : null}
      {eqError ? (
        <div className="mb-4">
          <SectionError message={`Cadastro de equipamentos: ${eqError.message}`} />
        </div>
      ) : null}

      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Contagens abaixo usam OS no mês previsto (Fechamento/DataDaSolucao) — proxy operacional da matriz,{" "}
        <strong>não</strong> KPI oficial de cumprimento por laudo. Para cobertura do plano, use o gap em QMentum.
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Previstas no ano"
          value={String(allKpi.previstas)}
          hint={`${groups.reduce((n, g) => n + g.equipamentos.length, 0)} equipamento(s) · ${semData} plano(s) sem data`}
          loading={loading}
        />
        <KpiCard
          label="Com OS no mês"
          value={String(allKpi.realizadas)}
          hint="Proxy: preventiva, calibração ou TSE com OS no mês previsto — não é emissão de laudo"
          loading={loading}
        />
        <KpiCard
          label="Sem OS no mês"
          value={String(allKpi.naoRealizadas)}
          hint="Previstas no ano ainda sem OS no mês (matriz âmbar/vermelho)"
          loading={loading}
        />
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        {kpis.slice(1).map((kpi) => (
          <Card key={kpi.tipo} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.tipo}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {loading ? "…" : `${kpi.realizadas}/${kpi.previstas}`}
            </p>
            <p className="text-xs text-slate-500">
              Com OS no mês / previstas · {kpi.naoRealizadas} sem OS
              {kpi.semData ? ` · ${kpi.semData} sem data` : ""}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mb-3">
        <CardContent className="flex flex-wrap items-center gap-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Legenda</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-[11px] font-bold text-white">
              X
            </span>
            Realizada no mês
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-400 text-[11px] font-bold text-amber-950">
              X
            </span>
            Prevista (mês atual ou futuro)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-rose-600 text-[11px] font-bold text-white">
              X
            </span>
            Não realizada (mês já passou)
          </span>
        </CardContent>
      </Card>

      {cronogramaQ.isLoading ? (
        <TableSkeleton rows={10} />
      ) : groups.length === 0 ? (
        <PendingBanner
          title="Nenhum plano de preventiva, calibração ou TSE no ano."
          detail="Confira o recorte médico, o setor e o tipo de equipamento. Datas de cronograma inválidas não geram X."
        />
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1080px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-aion-blue text-white">
              <tr>
                <th className="sticky left-0 z-30 bg-aion-blue px-3 py-2.5 text-left font-semibold">Equipamento</th>
                <th className="sticky left-[220px] z-30 bg-aion-blue px-2 py-2.5 text-left font-semibold">Plano</th>
                {MESES_ABREV.map((mes) => (
                  <th key={mes} className="px-1 py-2.5 text-center font-semibold">
                    {mes}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold">Ano</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const isCollapsed = collapsed.has(group.setor);
                return (
                  <SetorBlock
                    key={group.setor}
                    group={group}
                    collapsed={isCollapsed}
                    onToggle={() => toggleSetor(group.setor)}
                    onOpen={setDrill}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={!!drill}
        title={drill ? `${drill.equip.equipamento}${drill.equip.tag ? ` · ${drill.equip.tag}` : ""}` : ""}
        subtitle={
          drill
            ? `${drill.equip.setor}${drill.plan ? ` · ${drill.plan.tipo}` : ""}${
                drill.month != null ? ` · ${MESES_ABREV[drill.month]}/${year}` : ` · ${year}`
              }`
            : ""
        }
        onClose={() => setDrill(null)}
      >
        {drill ? (
          <div className="space-y-5">
            {(drill.plan ? [drill.plan] : drill.equip.plans).map((plan) => (
              <div key={plan.tipo} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={plan.tipo === "Calibração" ? "info" : plan.tipo === "TSE" ? "warn" : "ok"}>
                    {plan.tipo}
                  </Badge>
                  <span className="text-sm text-slate-500">
                    {plan.realizadas}/{plan.previstas} no ano
                    {plan.semData ? " · sem data válida" : ""}
                  </span>
                </div>
                {plan.items.map((item, idx) => {
                  const status = cronogramaStatus(item);
                  return (
                    <div key={`${item.PlanoDeManutencao}-${idx}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-800">{item.PlanoDeManutencao || item.TipoDeManutencao}</p>
                      <p className="mt-1 text-slate-500">
                        Periodicidade: {item.Perioridicade || "—"} · Próxima: {formatDateBR(item.ProximaRealizacao)} ·
                        Última: {formatDateBR(item.DataDaUltima)}
                      </p>
                      <div className="mt-2">
                        <Badge
                          tone={
                            status.statusCalculado === "atrasado"
                              ? "danger"
                              : status.statusCalculado === "vence_em"
                                ? "warn"
                                : status.statusCalculado === "em_dia"
                                  ? "ok"
                                  : "default"
                          }
                        >
                          {status.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">
                        <strong>Observação:</strong> {item.Observacao || "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">
                OS da tag {drill.equip.tag || "(sem tag)"} em {year}
              </p>
              {drillOs.length === 0 ? (
                <PendingBanner
                  title="Nenhuma OS de preventiva, calibração ou TSE encontrada."
                  detail="A API de OS usa período (AnoAtual / AnoAnterior), não um intervalo livre. O cruzamento é por Tag + tipo e data de Fechamento, solução ou abertura."
                />
              ) : (
                <ul className="space-y-2 text-sm">
                  {drillOs.slice(0, 16).map((o) => (
                    <li key={o.CodigoSerialOS} className="rounded-lg border border-slate-200 p-3">
                      <div className="font-medium">
                        OS {o.OS} · {o.SituacaoDaOS || "—"}
                      </div>
                      <div className="text-slate-500">
                        {formatDateBR(osRealizacaoDate(o))} · {o.TipoDeManutencao} · {o.Ocorrencia || "sem ocorrência"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function SetorBlock({
  group,
  collapsed,
  onToggle,
  onOpen,
}: {
  group: { setor: string; equipamentos: CronogramaEquipRow[]; previstas: number; realizadas: number };
  collapsed: boolean;
  onToggle: () => void;
  onOpen: (drill: Drill) => void;
}) {
  return (
    <>
      <tr className="border-y border-aion-line bg-aion-mist">
        <td colSpan={15} className="sticky left-0 bg-aion-mist p-0">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-semibold text-aion-ink hover:bg-aion-line/50"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>{group.setor}</span>
            <span className="text-xs font-medium text-aion-blue">
              {group.equipamentos.length} eq. · {group.realizadas}/{group.previstas} no ano
            </span>
          </button>
        </td>
      </tr>
      {collapsed
        ? null
        : group.equipamentos.map((equip) => (
            <EquipBlock key={equip.key} equip={equip} onOpen={onOpen} />
          ))}
    </>
  );
}

function EquipBlock({
  equip,
  onOpen,
}: {
  equip: CronogramaEquipRow;
  onOpen: (drill: Drill) => void;
}) {
  return (
    <>
      {equip.plans.map((plan, planIdx) => (
        <tr key={`${equip.key}-${plan.tipo}`} className="border-b border-slate-100 hover:bg-slate-50/80">
          {planIdx === 0 ? (
            <td
              rowSpan={equip.plans.length}
              className="sticky left-0 z-10 w-[220px] max-w-[220px] border-r border-slate-100 bg-white px-3 py-2 align-top"
            >
              <button type="button" className="text-left" onClick={() => onOpen({ equip })}>
                <span className="block font-medium text-slate-900">{equip.equipamento}</span>
                <span className="block font-mono text-xs text-slate-500">{equip.tag || "sem tag"}</span>
              </button>
            </td>
          ) : null}
          <td className="sticky left-[220px] z-10 w-[108px] border-r border-slate-100 bg-white px-2 py-1.5">
            <button type="button" className="text-left text-xs font-semibold text-aion-blue" onClick={() => onOpen({ equip, plan })}>
              {plan.tipo}
            </button>
          </td>
          {plan.months.map((cell) => (
            <td key={cell.month} className="px-1 py-1.5 text-center">
              <MonthCell cell={cell} onClick={() => onOpen({ equip, plan, month: cell.month })} />
            </td>
          ))}
          <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
            {plan.semData && plan.previstas === 0 ? (
              <span className="text-xs text-slate-400">sem data</span>
            ) : (
              <span>
                {plan.realizadas}/{plan.previstas}
              </span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

function MonthCell({ cell, onClick }: { cell: CronogramaMesCell; onClick: () => void }) {
  if (!cell.planned) return <span className="block h-7" />;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${MESES_ABREV[cell.month]}: ${cellLabel[cell.status]}`}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold",
        cellClass[cell.status],
      )}
    >
      X
    </button>
  );
}
