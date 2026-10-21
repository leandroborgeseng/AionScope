"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useState } from "react";
import type { CustoParqueMes } from "@/lib/pbi/custo-manutencao-parque";
import { META_ANUAL_PCT, formatPctParque, rotuloStatus, serieGraficoParque } from "@/lib/pbi/custo-manutencao-parque";
import { formatGastoEixo } from "@/lib/pbi/gasto-reparo";
import { formatBRL } from "@/lib/pbi/indicators";
import { cn } from "@/lib/utils";

export type CustoParqueChartRow = {
  name: string;
  mes: CustoParqueMes;
  contratos: number | null;
  avulsos: number | null;
  pct: number | null;
  meta: number;
};

const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Mesmo texto do tooltip e da tabela (UX critério 4). */
export function textoTooltipMes(m: CustoParqueMes) {
  return [
    MESES_LONGOS[m.month],
    `Contratos ${formatBRL(m.contratos)}`,
    `Avulsos ${formatBRL(m.avulsos)}`,
    `Mês ${formatBRL(m.despesa)}`,
    `Acumulado ${formatBRL(m.acumulado)} (${formatPctParque(m.pctAcumulado)})`,
    `Meta ${formatPctParque(m.metaPct)}`,
    m.status ? rotuloStatus(m.status).replace(" da meta", "") : "Sem dados",
  ].join(" · ");
}

function Dica({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as CustoParqueChartRow | undefined;
  if (!row) return null;
  const m = row.mes;
  if (m.futuro) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
        <p className="font-semibold">{MESES_LONGOS[m.month]} · a realizar</p>
        <p>Meta {formatPctParque(m.metaPct)}</p>
      </div>
    );
  }
  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-md">
      {textoTooltipMes(m)}
    </div>
  );
}

function PontoAcumulado(props: { cx?: number; cy?: number; payload?: CustoParqueChartRow }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload || payload.pct == null) return null;
  const acima = payload.mes.status === "Acima";
  return acima ? (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#b91c1c" stroke="#fff" strokeWidth={1.5} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">!</text>
    </g>
  ) : (
    <circle cx={cx} cy={cy} r={4} fill="#0f172a" stroke="#fff" strokeWidth={1.5} />
  );
}

export function CustoParqueChart({
  months,
  className,
  onMonthClick,
  indisponivel,
}: {
  months: CustoParqueMes[];
  className?: string;
  /** Mensagem de erro: quando presente, o gráfico fica vazio (só meta e teto). */
  indisponivel?: string | null;
  onMonthClick?: (m: CustoParqueMes) => void;
}) {
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const semDados = Boolean(indisponivel);
  const data: CustoParqueChartRow[] = serieGraficoParque(months, semDados);
  const maxPct = Math.max(META_ANUAL_PCT, ...data.map((d) => d.pct ?? 0)) * 1.1;
  const toggle = (k: string) =>
    setOcultas((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="w-full overflow-x-auto">
      <div className={cn("relative h-80 min-w-[640px]", className)}>
        {semDados ? (
          <p
            role="status"
            data-testid="custo-parque-chart-vazio"
            className="pointer-events-none absolute inset-x-0 top-1/3 z-10 mx-auto w-fit max-w-[80%] rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-center text-sm text-amber-900"
          >
            {indisponivel}
          </p>
        ) : null}
        <ResponsiveContainer width="100%" height="100%" minHeight={260} debounce={1}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
            onClick={(state) => {
              const i = Number(state?.activeIndex);
              const row = Number.isFinite(i) ? data[i] : undefined;
              if (row && !row.mes.futuro && !semDados) onMonthClick?.(row.mes);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis yAxisId="rs" tick={{ fontSize: 11 }} tickFormatter={formatGastoEixo} width={68} />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 11 }}
              domain={[0, Number(maxPct.toFixed(2))]}
              tickFormatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              width={48}
            />
            {semDados ? null : <Tooltip content={Dica} />}
            <Legend
              onClick={(e) => toggle(String((e as { dataKey?: unknown }).dataKey))}
              wrapperStyle={{ cursor: "pointer", fontSize: 12 }}
              formatter={(value) => <span style={{ color: "#334155" }}>{value}</span>}
            />
            {semDados ? null : <Bar yAxisId="rs" dataKey="contratos" name="Contratos" stackId="d" fill="#1e3a8a" stroke="#ffffff" strokeWidth={1} hide={ocultas.has("contratos")} cursor="pointer" />}
            {semDados ? null : <Bar yAxisId="rs" dataKey="avulsos" name="Avulsos" stackId="d" fill="#0284c7" stroke="#ffffff" strokeWidth={1} radius={[3, 3, 0, 0]} hide={ocultas.has("avulsos")} cursor="pointer" />}
            <Line yAxisId="pct" type="stepAfter" dataKey="meta" name="Meta proporcional" stroke="#475569" strokeDasharray="6 4" dot={false} hide={ocultas.has("meta")} />
            {semDados ? null : <Line yAxisId="pct" type="monotone" dataKey="pct" name="Acumulado (% do parque)" stroke="#0f172a" strokeWidth={2} dot={PontoAcumulado} connectNulls={false} hide={ocultas.has("pct")} />}
            <ReferenceLine yAxisId="pct" y={META_ANUAL_PCT} stroke="#b45309" strokeDasharray="2 3" label={{ value: "Teto anual 4%", position: "insideTopLeft", fontSize: 11, fill: "#92400e" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
