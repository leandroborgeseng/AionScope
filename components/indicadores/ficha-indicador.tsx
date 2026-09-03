"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FICHA_CAMPOS, type FichaIndicador } from "@/lib/pbi/fichas";

export function FichaButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <FileText className="h-3.5 w-3.5" />
      Ficha do indicador
    </Button>
  );
}

export function FichaIndicadorView({
  ficha,
  /** Quando true, omite o nome (já está no título da página). */
  hideNome = false,
}: {
  ficha: FichaIndicador;
  hideNome?: boolean;
}) {
  const valueOf = (key: (typeof FICHA_CAMPOS)[number]["key"]) => {
    const value = ficha[key];
    return value === "" ? "—" : String(value);
  };

  const campos = hideNome
    ? FICHA_CAMPOS.filter((campo) => campo.key !== "nomeDoIndicador")
    : FICHA_CAMPOS;

  return (
    <article className="overflow-hidden rounded-xl border border-aion-line bg-white">
      <div className="aion-bar" />
      <header className="border-b border-aion-line bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-blue">
          Definição do indicador
        </p>
        <h3 className="mt-1 text-base font-semibold text-aion-ink">{ficha.nomeDoIndicador}</h3>
      </header>
      <dl className="divide-y divide-aion-mist">
        {campos.map((campo) => (
          <div key={campo.key}>
            {campo.section ? (
              <p className="bg-aion-paper px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-aion-muted">
                {campo.section}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[200px_1fr] sm:items-start">
              <dt className="text-xs font-semibold text-aion-blue">{campo.label}</dt>
              <dd className="text-sm whitespace-pre-wrap text-aion-ink">{valueOf(campo.key)}</dd>
            </div>
          </div>
        ))}
      </dl>
    </article>
  );
}
