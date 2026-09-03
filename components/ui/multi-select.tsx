"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Todos",
  className,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return q ? options.filter((o) => o.toLocaleLowerCase("pt-BR").includes(q)) : options;
  }, [options, query]);

  const summary = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} selecionados`;

  return (
    <div className={cn("relative min-w-[160px]", className)}>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-2.5 text-left text-sm text-slate-800"
      >
        <span className="truncate">{summary}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar..."
            className="mb-2 h-8 w-full rounded-md border border-slate-200 px-2 text-sm"
          />
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500">Nenhuma opção</p>
            ) : (
              filtered.map((option) => {
                const checked = value.includes(option);
                return (
                  <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange(checked ? value.filter((v) => v !== option) : [...value, option])
                      }
                    />
                    <span className="truncate">{option}</span>
                  </label>
                );
              })
            )}
          </div>
          {value.length > 0 ? (
            <button
              type="button"
              className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => onChange([])}
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
