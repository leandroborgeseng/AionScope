"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FICHA_CAMPOS, type FichaIndicador } from "@/lib/pbi/fichas";

export function FichaButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"
    >
      <FileText className="h-3.5 w-3.5" />
      Ficha do indicador
    </Button>
  );
}

export function FichaIndicadorView({ ficha }: { ficha: FichaIndicador }) {
  const valueOf = (key: (typeof FICHA_CAMPOS)[number]["key"]) => {
    const value = ficha[key];
    return value === "" ? "—" : String(value);
  };

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-teal-900/10 bg-teal-900 px-4 py-3 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200">Ficha do Indicador</p>
        <h3 className="mt-1 text-base font-semibold">{ficha.nomeDoIndicador}</h3>
      </header>
      <dl className="divide-y divide-slate-100">
        {FICHA_CAMPOS.map((campo) => (
          <div key={campo.key}>
            {campo.section ? (
              <p className="bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {campo.section}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[200px_1fr] sm:items-start">
              <dt className="text-xs font-semibold text-teal-900">{campo.label}</dt>
              <dd className="text-sm whitespace-pre-wrap text-slate-800">{valueOf(campo.key)}</dd>
            </div>
          </div>
        ))}
      </dl>
    </article>
  );
}
