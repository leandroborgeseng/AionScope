"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CsvButton } from "@/components/export/csv-button";
import { KpiCard, toneFromPct } from "@/components/kpi/kpi-card";
import { PendingBanner, SectionError } from "@/components/pending/pending-banner";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useScopedFilters } from "@/hooks/use-scoped-filters";
import { dataOf, errorOf, usePbiQuery } from "@/hooks/use-pbi";
import { filterAnexosEquip, filterEquipamentos, filterOs } from "@/lib/pbi/apply-filters";
import { anexoObrigatorioKeywords, equipamentosComAnexo, formatPct, isAnexoObrigatorio, osComEvidencia } from "@/lib/pbi/indicators";
import type { AnexoEquipamentoItem, AnexoOsItem, EquipamentoItem, OsResumidaItem } from "@/lib/pbi/types";

type DocRow = {
  origem: "Equipamento" | "OS";
  ref: string;
  anexo: string;
  tipo: string;
  data: string;
  link: string;
  obrigatorio: boolean;
};

export default function DocumentacaoPage() {
  const { filters } = useScopedFilters();
  const [origem, setOrigem] = useState<"todos" | "equipamento" | "os">("todos");
  const eqQ = usePbiQuery<EquipamentoItem[]>("equipamentos", filters);
  const osQ = usePbiQuery<OsResumidaItem[]>("os-resumida", filters, { qtdPorPagina: "100000" });
  const axEqQ = usePbiQuery<AnexoEquipamentoItem[]>("anexos-equipamento", filters);
  const axOsQ = usePbiQuery<AnexoOsItem[]>("anexos-os", filters);
  const oficinaQ = usePbiQuery<unknown[]>("oficina", filters);

  const equipamentos = useMemo(() => filterEquipamentos(dataOf(eqQ.data) ?? [], filters), [eqQ.data, filters]);
  const os = useMemo(() => filterOs(dataOf(osQ.data) ?? [], filters), [osQ.data, filters]);
  const axEq = useMemo(
    () => filterAnexosEquip(dataOf(axEqQ.data) ?? [], filters),
    [axEqQ.data, filters],
  );
  const axOs = useMemo(() => {
    const all = dataOf(axOsQ.data) ?? [];
    if (!filters.somenteMedicos) return all;
    const codes = new Set(os.map((item) => item.OS));
    return all.filter((item) => codes.has(item.CodigoOS));
  }, [axOsQ.data, filters.somenteMedicos, os]);

  const eqAnexo = equipamentosComAnexo(equipamentos, axEq);
  const osEvid = osComEvidencia(os, axOs);
  const keywords = anexoObrigatorioKeywords();

  const rows = useMemo(() => {
    const eqRows: DocRow[] = axEq.map((a) => ({
      origem: "Equipamento",
      ref: a.Tag || String(a.EquipamentoId),
      anexo: a.Anexo,
      tipo: a.TipoAnexo || "—",
      data: a.DataHoraInclusao,
      link: a.LinkAnexo,
      obrigatorio: isAnexoObrigatorio(a),
    }));
    const osRows: DocRow[] = axOs.map((a) => ({
      origem: "OS",
      ref: a.CodigoOS || String(a.OSId),
      anexo: a.Anexo,
      tipo: a.TipoAnexo || "—",
      data: a.DataHoraInclusao,
      link: a.LinkAnexo,
      obrigatorio: isAnexoObrigatorio(a),
    }));
    const all = [...eqRows, ...osRows];
    if (origem === "equipamento") return eqRows;
    if (origem === "os") return osRows;
    return all;
  }, [axEq, axOs, origem]);

  const columns: ColumnDef<DocRow, unknown>[] = [
    { accessorKey: "origem", header: "Origem" },
    { accessorKey: "ref", header: "Tag / OS" },
    {
      accessorKey: "anexo",
      header: "Anexo",
      cell: ({ row }) => (
        <a href={row.original.link} target="_blank" rel="noreferrer" className="text-aion-blue hover:underline">
          {row.original.anexo}
        </a>
      ),
    },
    { accessorKey: "tipo", header: "Tipo" },
    { accessorKey: "data", header: "Inclusão" },
    {
      accessorKey: "obrigatorio",
      header: "Obrigatório",
      cell: ({ getValue }) =>
        getValue() ? <Badge tone="ok">Sim</Badge> : <Badge>Não</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documentação e rastreabilidade"
        description={`Anexos obrigatórios (configurável em NEXT_PUBLIC_ANEXOS_OBRIGATORIOS): ${keywords.join(", ")}. A API atual quase não devolve TipoAnexo — a classificação usa o nome do arquivo.`}
        actions={<CsvButton filename="documentos-ec.csv" rows={rows as unknown as Array<Record<string, unknown>>} />}
      />

      {oficinaQ.data && !oficinaQ.data.ok && oficinaQ.data.disabled ? (
        <div className="mb-4">
          <PendingBanner title="API_PBI_OFICINA bloqueada" detail="A lista de oficinas do filtro é derivada da listagem de OS até o suporte liberar o endpoint." />
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Equip. com anexo"
          value={formatPct(eqAnexo.comAnexo)}
          hint={`${eqAnexo.withAny.length} de ${eqAnexo.total}`}
          tone={toneFromPct(eqAnexo.comAnexo)}
          loading={eqQ.isLoading || axEqQ.isLoading}
        />
        <KpiCard
          label="Com anexo obrigatório"
          value={formatPct(eqAnexo.comObrigatorio)}
          hint="Laudo, calibração, certificado, TSE…"
          tone={toneFromPct(eqAnexo.comObrigatorio)}
        />
        <KpiCard
          label="OS com evidência"
          value={formatPct(osEvid.value)}
          hint={`${osEvid.withAnexo.length} de ${osEvid.total} OS do período`}
          tone={toneFromPct(osEvid.value)}
          loading={osQ.isLoading || axOsQ.isLoading}
        />
        <KpiCard label="Documentos listados" value={String(rows.length)} />
      </div>

      <div className="mb-3 flex gap-2">
        {(["todos", "equipamento", "os"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setOrigem(id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${origem === id ? "bg-aion-blue text-white" : "bg-white border border-aion-line"}`}
          >
            {id === "todos" ? "Todos" : id === "equipamento" ? "Equipamentos" : "OS"}
          </button>
        ))}
      </div>

      {errorOf(axEqQ.data) ? <SectionError message={errorOf(axEqQ.data)!.message} /> : null}
      {errorOf(axOsQ.data) ? <div className="mt-2"><SectionError message={errorOf(axOsQ.data)!.message} /></div> : null}

      {axEqQ.isLoading || axOsQ.isLoading ? <TableSkeleton /> : <DataTable data={rows} columns={columns} />}
    </div>
  );
}
