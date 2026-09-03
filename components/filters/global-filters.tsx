"use client";

import { Eraser } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import { useMedicalIndex } from "@/hooks/use-medical-index";
import { useLookups } from "@/hooks/use-pbi";
import { PERIOD_PRESETS } from "@/lib/pbi/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";

export function GlobalFilters() {
  const { filters, setFilters, clearFilters } = useFilters();
  const lookups = useLookups();
  const medical = useMedicalIndex();
  const data = lookups.data?.ok ? lookups.data.data : undefined;

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Início
          </label>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ from: e.target.value })}
            className="w-[150px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fim
          </label>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ to: e.target.value })}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-wrap gap-1 pb-0.5">
          {PERIOD_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="secondary"
              onClick={() => setFilters(preset.range())}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Tipo de manutenção
          </label>
          <select
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            value={filters.tipoManutencao}
            onChange={(e) =>
              setFilters({ tipoManutencao: e.target.value as typeof filters.tipoManutencao })
            }
          >
            <option value="Todos">Todos</option>
            <option value="ApenasPreventiva">Preventiva</option>
            <option value="ApenasCorretiva">Corretiva</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            IDs empresa (disp.)
          </label>
          <Input
            placeholder="ex: 12"
            value={filters.empresaIds.join(",")}
            onChange={(e) =>
              setFilters({
                empresaIds: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
              })
            }
            className="w-[120px]"
          />
        </div>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 text-sm font-medium text-teal-900">
          <input
            type="checkbox"
            checked={filters.somenteMedicos}
            onChange={(e) => setFilters({ somenteMedicos: e.target.checked })}
          />
          Somente eq. médicos
          {medical.ready ? (
            <span className="font-normal text-teal-800/70">
              ({medical.medicos}/{medical.total})
            </span>
          ) : null}
        </label>
        <Button variant="outline" onClick={clearFilters} className="ml-auto">
          <Eraser className="h-4 w-4" />
          Limpar filtros
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <MultiSelect
          label="Empresa"
          options={data?.empresas ?? []}
          value={filters.empresas}
          onChange={(empresas) => setFilters({ empresas })}
        />
        <MultiSelect
          label="Setor"
          options={data?.setores ?? []}
          value={filters.setores}
          onChange={(setores) => setFilters({ setores })}
        />
        <MultiSelect
          label="Oficina"
          options={data?.oficinas ?? []}
          value={filters.oficinas}
          onChange={(oficinas) => setFilters({ oficinas })}
        />
        <MultiSelect
          label="Criticidade"
          options={data?.criticidades ?? []}
          value={filters.criticidades}
          onChange={(criticidades) => setFilters({ criticidades })}
        />
        <MultiSelect
          label="Fabricante"
          options={data?.fabricantes ?? []}
          value={filters.fabricantes}
          onChange={(fabricantes) => setFilters({ fabricantes })}
        />
        <MultiSelect
          label="Modelo"
          options={data?.modelos ?? []}
          value={filters.modelos}
          onChange={(modelos) => setFilters({ modelos })}
        />
      </div>
    </div>
  );
}
