import type { ReactNode } from "react";
import { Accordion } from "@/components/ui/accordion";
import { FichaIndicadorView } from "@/components/indicadores/ficha-indicador";
import type { FichaIndicador } from "@/lib/pbi/fichas";

export function IndicadorPageLayout({
  heading,
  kpis,
  chart,
  selectionList,
  ficha,
  detalhesItems,
  loading,
  error,
}: {
  heading: ReactNode;
  kpis?: ReactNode;
  chart: ReactNode;
  selectionList: ReactNode;
  ficha: FichaIndicador;
  detalhesItems: Array<{ id: string; title: string; children: ReactNode }>;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <section className="space-y-4">
      {heading}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : (
        <>
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
          ) : null}

          {kpis ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis}</div>
          ) : null}

          {chart}

          {selectionList}

          <FichaIndicadorView ficha={ficha} hideNome />

          <Accordion items={detalhesItems} />
        </>
      )}
    </section>
  );
}
