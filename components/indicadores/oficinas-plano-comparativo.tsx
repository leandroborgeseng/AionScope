"use client";

import { useMemo } from "react";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import {
  buildOficinasPlanoComparativo,
  type OficinaPlanoComparativo,
} from "@/lib/pbi/oficinas-plano-comparativo";
import type { RollingYearRange } from "@/lib/pbi/volume-ec";

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

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  }

  return <ComparativoView data={data} year={range.start.getFullYear()} />;
}

function ComparativoView({ data, year }: { data: OficinaPlanoComparativo; year: number }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Comparativo por oficina · ano vigente ({year})
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          OS <strong>abertas × fechadas</strong> mês a mês em Preventiva, Calibração e TSE (Segurança
          elétrica). Proxy de cumprimento do cronograma de manutenção planejada — não inclui Oficina
          Geral.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {data.totais.map((t) => (
          <div key={t.filterKey} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {t.chipLabel}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{t.pctLabel}</div>
            <div className="text-xs text-slate-600">
              {t.fechadas} fechadas ÷ {t.abertas} abertas no ano
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2 sticky left-0 bg-slate-50">Mês</th>
              {data.totais.map((t) => (
                <th key={t.filterKey} className="px-3 py-2 text-center" colSpan={3}>
                  {t.chipLabel}
                </th>
              ))}
            </tr>
            <tr className="border-t border-slate-200">
              <th className="px-3 py-1 sticky left-0 bg-slate-50" />
              {data.totais.map((t) => (
                <th key={`${t.filterKey}-sub`} className="px-1 py-1 text-center font-normal" colSpan={3}>
                  <span className="inline-grid grid-cols-3 gap-2 text-[10px]">
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
                <td className="px-3 py-2 font-medium sticky left-0 bg-white">{mes.label}</td>
                {mes.porOficina.map((cell) => (
                  <td key={`${mes.key}-${cell.filterKey}`} className="px-1 py-2 text-center" colSpan={3}>
                    <span className="inline-grid grid-cols-3 gap-2 tabular-nums">
                      <span className="text-slate-700">{cell.abertas}</span>
                      <span className="text-slate-700">{cell.fechadas}</span>
                      <span
                        className={
                          cell.abertas <= 0
                            ? "text-slate-400"
                            : cell.pctExecutada >= 100
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-amber-700"
                        }
                      >
                        {cell.pctLabel}
                      </span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
