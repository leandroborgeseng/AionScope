"use client";

import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { Props as RechartsLabelProps } from "recharts/types/component/Label";
import { formatBRL } from "@/lib/pbi/indicators";
import { formatGastoBarra, formatGastoEixo } from "@/lib/pbi/gasto-reparo";
import { fraseSaldo } from "@/lib/pbi/volume-ec";

const COLORS = ["#0f766e", "#0369a1", "#d97706", "#be123c", "#334155", "#7c3aed", "#15803d"];

export function SimpleBarChart({
  data,
  xKey,
  yKey,
  color = "#0f766e",
  bars,
  onRowClick,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey?: string;
  color?: string;
  bars?: Array<{ key: string; color: string; name: string }>;
  onRowClick?: (row: Record<string, string | number>) => void;
}) {
  const series = bars ?? (yKey ? [{ key: yKey, color, name: yKey }] : []);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          onClick={(state) => {
            const index = typeof state.activeIndex === "number" ? state.activeIndex : Number(state.activeIndex);
            const row = Number.isFinite(index) ? data[index] : data.find((item) => item[xKey] === state.activeLabel);
            if (row) onRowClick?.(row);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {series.length > 1 ? <Legend /> : null}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function chartClickIndex(activeIndex: number | string | null | undefined): number {
  if (typeof activeIndex === "number") return activeIndex;
  if (typeof activeIndex === "string" && activeIndex !== "") {
    const n = Number(activeIndex);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

const SALDO_STACK = "saldo";
const INNER_LABEL_FONT = 10;
const MIN_INNER_LABEL_H = 18;

type SaldoChartRow = {
  name: string;
  abertas: number;
  fechadas: number;
  coberto: number;
  deficit: number;
  superavit: number;
  saldo: number;
  saldoLabel: string;
} & Record<string, string | number>;

export type SaldoStackLabels = {
  entrada: string;
  execucao: string;
};

const DEFAULT_SALDO_LABELS: SaldoStackLabels = {
  entrada: "Entrou (abertas)",
  execucao: "Executou (fechadas)",
};

function labelBox(viewBox: RechartsLabelProps["viewBox"]) {
  if (!viewBox || !("x" in viewBox) || !("width" in viewBox) || !("height" in viewBox)) return null;
  const x = Number(viewBox.x);
  const y = Number(viewBox.y);
  const width = Number(viewBox.width);
  const height = Number(viewBox.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function SegmentInnerLabel({ value, viewBox }: RechartsLabelProps): ReactElement {
  const n = Number(value);
  const box = labelBox(viewBox);
  const textW = String(n).length * 6.4;
  if (!box || !Number.isFinite(n) || n <= 0) return <g />;
  if (box.height < MIN_INNER_LABEL_H || box.width < textW + 4) return <g />;
  return (
    <text
      x={box.x + box.width / 2}
      y={box.y + box.height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={INNER_LABEL_FONT}
      fontWeight={700}
      className="tabular-nums"
    >
      {n}
    </text>
  );
}

function SaldoTooltip({
  active,
  payload,
  label,
  labels,
}: TooltipContentProps & { labels: SaldoStackLabels }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as SaldoChartRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-800">{String(label)}</p>
      <p className="mt-1 text-slate-700">
        {labels.entrada}: <span className="font-semibold tabular-nums">{row.abertas}</span>
      </p>
      <p className="text-slate-700">
        {labels.execucao}: <span className="font-semibold tabular-nums">{row.fechadas}</span>
      </p>
      <p className="mt-1 text-slate-800">
        Saldo: <span className="font-semibold tabular-nums">{fraseSaldo(row.saldo)}</span>
      </p>
    </div>
  );
}

export function SaldoStackBarChart({
  data,
  xKey,
  className,
  maxBarSize = 42,
  onRowClick,
  labels = DEFAULT_SALDO_LABELS,
}: {
  data: SaldoChartRow[];
  xKey: string;
  className?: string;
  maxBarSize?: number;
  onRowClick?: (row: SaldoChartRow) => void;
  labels?: SaldoStackLabels;
}) {
  const resolveRow = (state: { activeIndex?: number | string | null; activeLabel?: string | number }) => {
    const index = chartClickIndex(state.activeIndex);
    return Number.isFinite(index) ? data[index] : data.find((item) => item[xKey] === state.activeLabel);
  };

  return (
    <div className={cn("h-72 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={1}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="22%"
          onClick={(state) => {
            const row = resolveRow(state);
            if (row) onRowClick?.(row);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={(props) => <SaldoTooltip {...props} labels={labels} />} />
          <Legend />
          <Bar dataKey="coberto" name="Coberto" fill="#0f766e" stackId={SALDO_STACK} maxBarSize={maxBarSize}>
            <LabelList position="center" content={SegmentInnerLabel} />
          </Bar>
          <Bar dataKey="deficit" name="Déficit (faltou)" fill="#d97706" stackId={SALDO_STACK} maxBarSize={maxBarSize} radius={[3, 3, 0, 0]}>
            <LabelList position="center" content={SegmentInnerLabel} />
          </Bar>
          <Bar dataKey="superavit" name="Superávit" fill="#15803d" stackId={SALDO_STACK} maxBarSize={maxBarSize} radius={[3, 3, 0, 0]}>
            <LabelList position="center" content={SegmentInnerLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type GastoChartRow = {
  name: string;
  gasto: number;
  gastoCorretiva: number;
  gastoOutro: number;
  osCount: number;
  osComCusto: number;
} & Record<string, string | number>;

function GastoInnerLabel({ value, viewBox }: RechartsLabelProps): ReactElement {
  const n = Number(value);
  const box = labelBox(viewBox);
  if (!box || !Number.isFinite(n) || n <= 0) return <g />;
  if (box.height < MIN_INNER_LABEL_H) return <g />;
  const text = formatGastoBarra(n, box.width);
  if (!text) return <g />;
  return (
    <text
      x={box.x + box.width / 2}
      y={box.y + box.height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={INNER_LABEL_FONT}
      fontWeight={700}
      className="tabular-nums"
    >
      {text}
    </text>
  );
}

function GastoTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as GastoChartRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-800">{String(label)}</p>
      <p className="mt-1 text-slate-700">
        Gasto: <span className="font-semibold tabular-nums">{formatBRL(row.gasto)}</span>
      </p>
      {row.gastoCorretiva > 0 && row.gastoOutro > 0 ? (
        <>
          <p className="text-slate-600">
            Corretiva: <span className="tabular-nums">{formatBRL(row.gastoCorretiva)}</span>
          </p>
          <p className="text-slate-600">
            Man. externa / instrumental: <span className="tabular-nums">{formatBRL(row.gastoOutro)}</span>
          </p>
        </>
      ) : null}
      <p className="mt-1 text-slate-600">
        {row.osCount} OS · {row.osComCusto} com custo &gt; 0
      </p>
    </div>
  );
}

export type GastoChartClickMeta = {
  /** Série clicada: gasto | gastoCorretiva | gastoOutro */
  dataKey?: string;
};

export function GastoBarChart({
  data,
  xKey,
  stacked = false,
  className,
  maxBarSize = 42,
  onRowClick,
}: {
  data: GastoChartRow[];
  xKey: string;
  stacked?: boolean;
  className?: string;
  maxBarSize?: number;
  onRowClick?: (row: GastoChartRow, meta?: GastoChartClickMeta) => void;
}) {
  const resolveRow = (state: { activeIndex?: number | string | null; activeLabel?: string | number }) => {
    const index = chartClickIndex(state.activeIndex);
    return Number.isFinite(index) ? data[index] : data.find((item) => item[xKey] === state.activeLabel);
  };

  return (
    <div className={cn("h-72 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={1}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          barCategoryGap="22%"
          onClick={(state) => {
            const row = resolveRow(state);
            if (!row) return;
            const key = state.activeDataKey;
            onRowClick?.(row, { dataKey: typeof key === "string" ? key : undefined });
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatGastoEixo} width={68} />
          <Tooltip content={GastoTooltip} />
          {stacked ? <Legend /> : null}
          {stacked ? (
            <>
              <Bar dataKey="gastoCorretiva" name="Corretiva" fill="#0f766e" stackId="gasto" maxBarSize={maxBarSize} cursor="pointer">
                <LabelList position="center" content={GastoInnerLabel} />
              </Bar>
              <Bar
                dataKey="gastoOutro"
                name="Man. externa / instrumental"
                fill="#334155"
                stackId="gasto"
                maxBarSize={maxBarSize}
                radius={[3, 3, 0, 0]}
                cursor="pointer"
              >
                <LabelList position="center" content={GastoInnerLabel} />
              </Bar>
            </>
          ) : (
            <Bar dataKey="gasto" name="Gasto" fill="#0f766e" maxBarSize={maxBarSize} radius={[3, 3, 0, 0]} cursor="pointer">
              <LabelList position="center" content={GastoInnerLabel} />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type DespesaParqueChartRow = {
  name: string;
  contratos: number;
  avulsos: number;
  despesa: number;
  pctParque: number | null;
} & Record<string, string | number | null>;

function DespesaParqueTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as DespesaParqueChartRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-800">{String(label)}</p>
      <p className="mt-1 text-slate-700">
        Despesa: <span className="font-semibold tabular-nums">{formatBRL(row.despesa)}</span>
      </p>
      <p className="text-slate-600">
        Contratos: <span className="tabular-nums">{formatBRL(row.contratos)}</span>
      </p>
      <p className="text-slate-600">
        Avulsos (OS): <span className="tabular-nums">{formatBRL(row.avulsos)}</span>
      </p>
      {row.pctParque != null ? (
        <p className="mt-1 text-slate-600">
          % do parque:{" "}
          <span className="tabular-nums font-semibold">
            {Number(row.pctParque).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function DespesaParqueBarChart({
  data,
  xKey,
  stacked = true,
  className,
  maxBarSize = 42,
  onRowClick,
}: {
  data: DespesaParqueChartRow[];
  xKey: string;
  stacked?: boolean;
  className?: string;
  maxBarSize?: number;
  onRowClick?: (row: DespesaParqueChartRow) => void;
}) {
  return (
    <div className={cn("h-72 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={1}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          barCategoryGap="22%"
          onClick={(state) => {
            const index = chartClickIndex(state.activeIndex);
            const row = Number.isFinite(index)
              ? data[index]
              : data.find((item) => item[xKey] === state.activeLabel);
            if (row) onRowClick?.(row);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatGastoEixo} width={68} />
          <Tooltip content={DespesaParqueTooltip} />
          {stacked ? <Legend /> : null}
          {stacked ? (
            <>
              <Bar
                dataKey="contratos"
                name="Contratos"
                fill="#0369a1"
                stackId="despesa"
                maxBarSize={maxBarSize}
                cursor="pointer"
              >
                <LabelList position="center" content={GastoInnerLabel} />
              </Bar>
              <Bar
                dataKey="avulsos"
                name="Avulsos (OS reparo)"
                fill="#0f766e"
                stackId="despesa"
                maxBarSize={maxBarSize}
                radius={[3, 3, 0, 0]}
                cursor="pointer"
              >
                <LabelList position="center" content={GastoInnerLabel} />
              </Bar>
            </>
          ) : (
            <Bar
              dataKey="despesa"
              name="Despesa"
              fill="#0f766e"
              maxBarSize={maxBarSize}
              radius={[3, 3, 0, 0]}
              cursor="pointer"
            >
              <LabelList position="center" content={GastoInnerLabel} />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type SlaPrazoChartRow = {
  name: string;
  noPrazo: number;
  foraPrazo: number;
  comPrazo: number;
  pctNoPrazo: number | null;
  pctLabel: string;
} & Record<string, string | number | null>;

function SlaPrazoTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as SlaPrazoChartRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-800">{String(label)}</p>
      <p className="mt-1 text-slate-700">
        % no prazo: <span className="font-semibold tabular-nums">{row.pctLabel}</span>
      </p>
      <p className="text-slate-600">
        No prazo: <span className="tabular-nums font-semibold text-emerald-800">{row.noPrazo}</span>
      </p>
      <p className="text-slate-600">
        Fora do prazo: <span className="tabular-nums font-semibold text-rose-800">{row.foraPrazo}</span>
      </p>
      <p className="mt-1 text-slate-500">{row.comPrazo} OS com prazo calculável</p>
    </div>
  );
}

function SlaPctTopLabel({ value, viewBox }: RechartsLabelProps): ReactElement {
  const text = String(value ?? "");
  const box = labelBox(viewBox);
  if (!box || !text || text === "—" || text === "–") return <g />;
  return (
    <text
      x={box.x + box.width / 2}
      y={box.y - 6}
      textAnchor="middle"
      fill="#0f172a"
      fontSize={10}
      fontWeight={700}
      className="tabular-nums"
    >
      {text}
    </text>
  );
}

export function SlaPrazoBarChart({
  data,
  xKey,
  className,
  maxBarSize = 42,
  onRowClick,
}: {
  data: SlaPrazoChartRow[];
  xKey: string;
  className?: string;
  maxBarSize?: number;
  onRowClick?: (row: SlaPrazoChartRow) => void;
}) {
  const resolveRow = (state: { activeIndex?: number | string | null; activeLabel?: string | number }) => {
    const index = chartClickIndex(state.activeIndex);
    return Number.isFinite(index) ? data[index] : data.find((item) => item[xKey] === state.activeLabel);
  };

  return (
    <div className={cn("h-72 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%" minHeight={240} debounce={1}>
        <BarChart
          data={data}
          margin={{ top: 22, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="22%"
          onClick={(state) => {
            const row = resolveRow(state);
            if (row) onRowClick?.(row);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={SlaPrazoTooltip} />
          <Legend />
          <Bar dataKey="noPrazo" name="No prazo" fill="#0f766e" stackId="sla" maxBarSize={maxBarSize} cursor="pointer">
            <LabelList position="center" content={SegmentInnerLabel} />
          </Bar>
          <Bar
            dataKey="foraPrazo"
            name="Fora do prazo"
            fill="#be123c"
            stackId="sla"
            maxBarSize={maxBarSize}
            radius={[3, 3, 0, 0]}
            cursor="pointer"
          >
            <LabelList position="center" content={SegmentInnerLabel} />
            <LabelList dataKey="pctLabel" content={SlaPctTopLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleLineChart({
  data,
  xKey,
  series,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: Array<{ key: string; color: string; name: string }>;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimplePieChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
