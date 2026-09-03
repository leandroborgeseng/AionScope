"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SimplePieChart } from "@/components/charts/charts";
import { CsvButton } from "@/components/export/csv-button";
import { KpiCard, toneFromPct } from "@/components/kpi/kpi-card";
import { SectionError } from "@/components/pending/pending-banner";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useScopedFilters } from "@/hooks/use-scoped-filters";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { filterAnexosEquip, filterEquipamentos } from "@/lib/pbi/apply-filters";
import { alemFimDeVida, anvisaValido, formatPct, pareto } from "@/lib/pbi/indicators";
import { formatDateBR } from "@/lib/pbi/dates";
import { isEquipamentoMedico, tipoCadastro } from "@/lib/pbi/medical";
import type { AnexoEquipamentoItem, EquipamentoItem } from "@/lib/pbi/types";

export default function ParquePage() {
  const { filters } = useScopedFilters();
  const [selected, setSelected] = useState<EquipamentoItem | null>(null);
  const [view, setView] = useState<"setor" | "tabela">("setor");
  const [openSetores, setOpenSetores] = useState<Set<string>>(new Set());
  const eqQ = usePbiQuery<EquipamentoItem[]>("equipamentos", filters, {
    apenasAtivos: "false",
    incluirComponentes: "false",
    incluirCustoSubstituicao: "false",
  });
  const anexosQ = usePbiQuery<AnexoEquipamentoItem[]>("anexos-equipamento", filters);

  const rows = useMemo(() => filterEquipamentos(dataOf(eqQ.data) ?? [], filters), [eqQ.data, filters]);
  const porSetor = useMemo(() => {
    const map = new Map<string, EquipamentoItem[]>();
    for (const row of rows) {
      const setor = row.Setor?.trim() || "Sem setor";
      const list = map.get(setor) ?? [];
      list.push(row);
      map.set(setor, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([setor, equipamentos]) => ({
        setor,
        equipamentos: [...equipamentos].sort((a, b) =>
          `${a.Equipamento} ${a.Tag}`.localeCompare(`${b.Equipamento} ${b.Tag}`, "pt-BR"),
        ),
      }));
  }, [rows]);
  const anexos = useMemo(() => {
    const all = dataOf(anexosQ.data) ?? [];
    if (!selected) return filterAnexosEquip(all, filters);
    return all.filter((a) => a.Tag === selected.Tag || a.EquipamentoId === selected.Id);
  }, [anexosQ.data, filters, selected]);

  const anvisa = anvisaValido(rows);
  const eol = alemFimDeVida(rows);
  const criticidade = pareto(rows.map((r) => r.Criticidade || "Não informada"));
  const situacao = pareto(rows.map((r) => r.Situacao || "Não informada"));
  const status = pareto(rows.map((r) => r.Status || "Não informado"));

  const columns: ColumnDef<EquipamentoItem, unknown>[] = [
    { accessorKey: "Tag", header: "Tag" },
    { accessorKey: "Equipamento", header: "Equipamento" },
    {
      id: "tipoMedico",
      header: "Tipo",
      cell: ({ row }) => {
        const medico = isEquipamentoMedico(row.original);
        const tipo = tipoCadastro(row.original);
        return <Badge tone={medico ? "ok" : "default"}>{tipo || (medico ? "Médico" : "Não médico")}</Badge>;
      },
    },
    { accessorKey: "Fabricante", header: "Fabricante" },
    { accessorKey: "Modelo", header: "Modelo" },
    { accessorKey: "Criticidade", header: "Criticidade" },
    { accessorKey: "Situacao", header: "Situação" },
    { accessorKey: "Status", header: "Status" },
    { accessorKey: "RegistroAnvisa", header: "ANVISA" },
    {
      accessorKey: "ValidadeDoRegistroAnvisa",
      header: "Validade ANVISA",
      cell: ({ getValue }) => formatDateBR(String(getValue() ?? "")),
    },
    {
      accessorKey: "EndOfLife",
      header: "Fim de vida",
      cell: ({ row }) =>
        eol.list.some((e) => e.Id === row.original.Id) ? (
          <Badge tone="danger">{formatDateBR(row.original.EndOfLife)}</Badge>
        ) : (
          formatDateBR(row.original.EndOfLife)
        ),
    },
  ];

  const columnsTabela: ColumnDef<EquipamentoItem, unknown>[] = [
    columns[0],
    columns[1],
    columns[2],
    { accessorKey: "Setor", header: "Setor" },
    ...columns.slice(3),
  ];

  function toggleSetor(setor: string) {
    setOpenSetores((current) => {
      const next = new Set(current);
      if (next.has(setor)) next.delete(setor);
      else next.add(setor);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Parque de equipamentos e compliance"
        description="Listagem do cadastro agrupada por setor. ANVISA válido = ValidadeDoRegistroAnvisa ≥ hoje. Fim de vida = EndOfLife < hoje e Status = ATIVO. Desmarque 'Somente eq. médicos' para ver o parque inteiro, inclusive predial. Clique no equipamento para ver anexos."
        actions={<CsvButton filename="parque-ec.csv" rows={rows as unknown as Array<Record<string, unknown>>} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Equipamentos" value={String(rows.length)} loading={eqQ.isLoading} />
        <KpiCard
          label="ANVISA válido"
          value={formatPct(anvisa.value)}
          hint={`${anvisa.valid} com validade futura · ${anvisa.withDate} com data`}
          tone={toneFromPct(anvisa.value)}
        />
        <KpiCard
          label="Além do fim de vida"
          value={String(eol.list.length)}
          hint="Ativos com EndOfLife vencido"
          tone={eol.list.length ? "danger" : "ok"}
        />
        <KpiCard label="Com registro ANVISA" value={String(rows.filter((r) => r.RegistroAnvisa).length)} />
        <KpiCard label="Setores" value={String(porSetor.length)} hint="Listagem agrupada abaixo" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Criticidade</CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart data={criticidade.map((c) => ({ name: c.name, value: c.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Situação</CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart data={situacao.map((c) => ({ name: c.name, value: c.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart data={status.map((c) => ({ name: c.name, value: c.count }))} />
          </CardContent>
        </Card>
      </div>

      {errorOf(eqQ.data) ? <SectionError message={errorOf(eqQ.data)!.message} /> : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setView("setor")}
          className={`rounded-lg px-3 py-1.5 text-sm ${view === "setor" ? "bg-aion-blue text-white" : "border border-aion-line bg-white"}`}
        >
          Por setor
        </button>
        <button
          type="button"
          onClick={() => setView("tabela")}
          className={`rounded-lg px-3 py-1.5 text-sm ${view === "tabela" ? "bg-aion-blue text-white" : "border border-aion-line bg-white"}`}
        >
          Tabela única
        </button>
        {view === "setor" ? (
          <>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              onClick={() => setOpenSetores(new Set(porSetor.map((g) => g.setor)))}
            >
              Expandir todos
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              onClick={() => setOpenSetores(new Set())}
            >
              Recolher todos
            </button>
          </>
        ) : null}
      </div>

      {eqQ.isLoading ? (
        <TableSkeleton />
      ) : view === "tabela" ? (
        <DataTable data={rows} columns={columnsTabela} onRowClick={setSelected} />
      ) : (
        <div className="space-y-2">
          {porSetor.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Nenhum equipamento para os filtros atuais.
            </p>
          ) : (
            porSetor.map((grupo) => {
              const open = openSetores.has(grupo.setor);
              return (
                <section key={grupo.setor} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    onClick={() => toggleSetor(grupo.setor)}
                  >
                    <span className="font-semibold text-slate-900">{grupo.setor}</span>
                    <Badge tone="info">{grupo.equipamentos.length} equipamento(s)</Badge>
                  </button>
                  {open ? (
                    <div className="border-t border-slate-100 p-3">
                      <DataTable
                        data={grupo.equipamentos}
                        columns={columns}
                        onRowClick={setSelected}
                        pageSize={25}
                      />
                    </div>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
      )}

      <Sheet
        open={!!selected}
        title={selected ? `${selected.Equipamento} · ${selected.Tag}` : ""}
        subtitle={selected?.Setor}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{anexos.length} anexo(s)</p>
            {anexos.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhum documento anexado a este equipamento.</p>
            ) : (
              <ul className="space-y-2">
                {anexos.map((a) => (
                  <li key={`${a.EquipamentoId}-${a.Anexo}-${a.DataHoraInclusao}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <a href={a.LinkAnexo} target="_blank" rel="noreferrer" className="font-medium text-aion-blue hover:underline">
                      {a.Anexo}
                    </a>
                    <div className="text-slate-500">{a.TipoAnexo || "Documento"} · {a.DataHoraInclusao}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
