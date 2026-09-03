"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useFilters } from "@/hooks/use-filters";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { REGRAS_EXCLUSAO_MEDICO, type NomeQuantidade } from "@/lib/pbi/medical";

function NameTable({ rows }: { rows: NomeQuantidade[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Nome no cadastro</th>
            <th className="px-3 py-2 text-right">Qtd.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.nome} className="border-t border-slate-100">
              <td className="px-3 py-1.5">{row.nome}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{row.quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MedicalScopeBar() {
  const { filters } = useFilters();
  const medical = useMedicalIndex();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"medicos" | "excluidos">("medicos");

  const mostrando = filters.somenteMedicos
    ? `${medical.medicos} equipamentos médicos`
    : `todo o cadastro (${medical.total} itens)`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-t border-aion-line bg-aion-paper px-4 py-2 text-sm">
        <ListFilter className="h-4 w-4 text-aion-blue" />
        <span className="text-slate-700">
          <strong>O que está na tela:</strong> {medical.ready ? mostrando : "carregando classificação…"}
        </span>
        {medical.ready && filters.somenteMedicos ? (
          <Badge tone="info">
            {medical.nomesMedicos.length} nomes · {medical.outros} itens prediais ocultos
          </Badge>
        ) : null}
        {medical.ready && !filters.somenteMedicos ? (
          <Badge>
            {medical.medicos} médicos + {medical.outros} não médicos
          </Badge>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!medical.ready}>
          Ver nomes classificados
        </Button>
      </div>

      <Sheet
        open={open}
        title="Classificação de equipamentos médicos"
        subtitle="A API PBI não envia o tipo do GlobalThings. A regra atual exclui predial/hotelaria pelo nome do cadastro."
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {filters.somenteMedicos
              ? `Filtro ligado: as telas usam ${medical.medicos} de ${medical.total} equipamentos.`
              : `Filtro desligado: as telas mostram os ${medical.total} equipamentos do cadastro.`}
          </p>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Nomes excluídos</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-600">
              {REGRAS_EXCLUSAO_MEDICO.map((regra) => (
                <li key={regra}>{regra}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("medicos")}
              className={`rounded-lg px-3 py-1.5 text-sm ${tab === "medicos" ? "bg-aion-blue text-white" : "border border-aion-line bg-white"}`}
            >
              Médicos ({medical.nomesMedicos.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("excluidos")}
              className={`rounded-lg px-3 py-1.5 text-sm ${tab === "excluidos" ? "bg-aion-blue text-white" : "border border-aion-line bg-white"}`}
            >
              Não médicos ({medical.nomesExcluidos.length})
            </button>
          </div>
          {tab === "medicos" ? (
            <NameTable rows={medical.nomesMedicos ?? []} />
          ) : (
            <NameTable rows={medical.nomesExcluidos ?? []} />
          )}
        </div>
      </Sheet>
    </>
  );
}
