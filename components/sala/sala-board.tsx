"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { formatDateTimeBR } from "@/lib/pbi/dates";
import {
  FAIXAS_LEGENDA,
  SALA_RECORTE_LINHA,
  formatAtualizadoHa,
  formatRelogioSala,
  type FaixaIdade,
  type SalaOs,
  type SalaSnapshot,
} from "@/lib/pbi/sala";
import { cn } from "@/lib/utils";

const FAIXA_DOT: Record<FaixaIdade, string> = {
  ok: "bg-emerald-400",
  atencao: "bg-amber-400",
  atrasada: "bg-orange-400",
  critica: "bg-rose-500",
};

const FAIXA_ROW: Record<FaixaIdade, string> = {
  ok: "border-l-emerald-400 bg-emerald-500/5",
  atencao: "border-l-amber-400 bg-amber-500/8",
  atrasada: "border-l-orange-400 bg-orange-500/10",
  critica: "border-l-rose-500 bg-rose-500/15",
};

const KPI_TONE = {
  novas: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
  fila: "border-white/15 bg-white/5 text-white",
  velhas: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  graves: "border-rose-500/40 bg-rose-500/15 text-rose-100",
} as const;

const DETALHE_CAMPOS = [
  "OS",
  "TipoDeManutencao",
  "SituacaoDaOS",
  "Status",
  "Prioridade",
  "Setor",
  "CentroDeCusto",
  "Equipamento",
  "Tag",
  "Abertura",
  "Fechamento",
  "DataDaSolucao",
  "DataDoAtendimento",
  "Ocorrencia",
  "Causa",
  "Oficina",
  "Responsavel",
  "Pendencia",
  "PendenciaAberta",
] as const;

export function SalaBoard({
  snapshot,
  loading,
  error,
  dataUpdatedAt,
  nowMs,
  clock,
}: {
  snapshot: SalaSnapshot;
  loading: boolean;
  error: string | null;
  dataUpdatedAt?: number;
  nowMs: number;
  clock: Date;
}) {
  const [selecionada, setSelecionada] = useState<SalaOs | null>(null);
  const { kpis } = snapshot;
  const valor = (n: number) => (loading && snapshot.fila.length === 0 ? "—" : String(n));

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-50">
      <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-4 pb-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">
            SJH · Engenharia Clínica
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sala operacional</h1>
        </div>
        <div className="flex items-center gap-5">
          <p className="font-mono text-3xl tabular-nums text-zinc-200">{formatRelogioSala(clock)}</p>
          <Link
            href="/"
            aria-label="Voltar à visão geral"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-zinc-400"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <section className="grid shrink-0 grid-cols-4 gap-3 px-6 pb-3">
        <Kpi
          tone="novas"
          label="Novas hoje"
          value={valor(kpis.novasHoje)}
          hint="Abertas hoje e ainda abertas"
        />
        <Kpi tone="fila" label="Fila aberta" value={valor(kpis.filaAberta)} hint="Eq. médicos sem fechamento nem solução" />
        <Kpi
          tone="velhas"
          label="Envelhecidas"
          value={valor(kpis.envelhecidas)}
          hint="Acima da meta de 4h"
        />
        <Kpi
          tone="graves"
          label="Estouradas graves"
          value={valor(kpis.estouradasGraves)}
          hint="Abertas há mais de 72h"
        />
      </section>

      {error ? (
        <p className="mx-6 mb-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] gap-3 px-6 pb-2">
        <FilaLista snapshot={snapshot} loading={loading} onSelect={setSelecionada} />
        <aside className="flex min-h-0 flex-col gap-3">
          <PainelLateral
            titulo="Top 5 mais antigas"
            vazio="Nenhuma OS aberta"
            items={snapshot.topAntigas}
            onSelect={setSelecionada}
          />
          <PainelLateral
            titulo="Novas do dia"
            vazio="Nenhuma nova hoje"
            items={snapshot.novasHoje.slice(0, 6)}
            extra={snapshot.novasHoje.length > 6 ? snapshot.novasHoje.length - 6 : 0}
            onSelect={setSelecionada}
          />
        </aside>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-white/10 px-6 py-2 text-[12px] text-zinc-400">
        <p className="tabular-nums">
          {formatAtualizadoHa(dataUpdatedAt, nowMs)}
          {dataUpdatedAt ? ` · ${formatDateTimeBR(new Date(dataUpdatedAt))}` : ""}
        </p>
        <p className="max-w-[42rem] truncate" title={SALA_RECORTE_LINHA}>
          {SALA_RECORTE_LINHA}
        </p>
        <p>Fonte: listagem analítica das OS</p>
        <ul className="flex flex-wrap items-center gap-3">
          {FAIXAS_LEGENDA.map((faixa) => (
            <li key={faixa.id} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", FAIXA_DOT[faixa.id])} />
              <span>
                {faixa.detalhe} {faixa.label}
              </span>
            </li>
          ))}
        </ul>
      </footer>

      <Sheet
        open={!!selecionada}
        title={selecionada ? `OS ${selecionada.item.OS || "—"}` : ""}
        subtitle={selecionada ? `${selecionada.tipoResumo} · ${selecionada.idadeLabel} · aberta` : undefined}
        onClose={() => setSelecionada(null)}
      >
        {selecionada ? <OsCrua item={selecionada} /> : null}
      </Sheet>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof KPI_TONE;
}) {
  return (
    <div className={cn("rounded-2xl border px-5 py-3", KPI_TONE[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 text-6xl font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-2 text-sm opacity-70">{hint}</p>
    </div>
  );
}

function FilaLista({
  snapshot,
  loading,
  onSelect,
}: {
  snapshot: SalaSnapshot;
  loading: boolean;
  onSelect: (row: SalaOs) => void;
}) {
  if (loading && snapshot.fila.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg text-zinc-400">
        Carregando fila…
      </div>
    );
  }

  if (snapshot.fila.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-center">
        <p className="text-3xl font-semibold text-emerald-200">Fila zerada</p>
        <p className="mt-1 text-sm text-emerald-100/70">Nenhuma OS de eq. médico aberta neste recorte</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80">
      <div className="grid grid-cols-[6.5rem_minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.3fr)_7.5rem_6rem_3.5rem] gap-3 border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        <span>OS</span>
        <span>Tipo</span>
        <span>Setor</span>
        <span>Equipamento</span>
        <span className="text-right">Idade</span>
        <span>Prioridade</span>
        <span />
      </div>
      <ul className="min-h-0 flex-1">
        {snapshot.visiveis.map((row) => (
          <li key={`${row.item.CodigoSerialOS}-${row.item.OS}`}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              className={cn(
                "grid w-full grid-cols-[6.5rem_minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.3fr)_7.5rem_6rem_3.5rem] items-center gap-3 border-l-4 px-4 py-2 text-left text-lg",
                FAIXA_ROW[row.faixa],
              )}
            >
              <span className="font-mono font-semibold tabular-nums">{row.item.OS || "—"}</span>
              <span className="truncate">{row.tipoResumo}</span>
              <span className="truncate text-zinc-200">{row.local}</span>
              <span className="truncate text-zinc-300">{row.equipamento}</span>
              <span className="text-right font-semibold tabular-nums">{row.idadeLabel}</span>
              <span className="truncate text-sm uppercase text-zinc-400">{row.prioridade || "—"}</span>
              <span>
                {row.novaHoje ? (
                  <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
                    hoje
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {snapshot.ocultas > 0 ? (
        <p className="border-t border-white/10 px-4 py-2 text-sm font-medium text-zinc-300">
          +{snapshot.ocultas} na fila
        </p>
      ) : null}
    </div>
  );
}

function PainelLateral({
  titulo,
  vazio,
  items,
  extra = 0,
  onSelect,
}: {
  titulo: string;
  vazio: string;
  items: SalaOs[];
  extra?: number;
  onSelect: (row: SalaOs) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{titulo}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{vazio}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((row) => (
            <li key={`${titulo}-${row.item.CodigoSerialOS}-${row.item.OS}`}>
              <button
                type="button"
                onClick={() => onSelect(row)}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-1 py-1 text-left"
              >
                <span className="min-w-0">
                  <span className="font-mono font-semibold tabular-nums">{row.item.OS || "—"}</span>
                  <span className="mt-0.5 block truncate text-sm text-zinc-400">{row.local}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{row.idadeLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {extra > 0 ? <p className="mt-auto pt-2 text-sm text-zinc-500">+{extra} novas</p> : null}
    </section>
  );
}

function OsCrua({ item }: { item: SalaOs }) {
  const rows = useMemo(
    () =>
      DETALHE_CAMPOS.map((campo) => ({
        campo,
        valor: String(item.item[campo] ?? "").trim() || "—",
      })),
    [item],
  );

  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-slate-500">Idade</dt>
      <dd className="font-semibold tabular-nums">{item.idadeLabel}</dd>
      {rows.map((row) => (
        <div key={row.campo} className="contents">
          <dt className="text-slate-500">{row.campo}</dt>
          <dd className="break-words text-slate-900">{row.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
