"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { AionLogo } from "@/components/brand/aion-logo";
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
  ok: "bg-emerald-500",
  atencao: "bg-amber-400",
  atrasada: "bg-orange-400",
  critica: "bg-rose-500",
};

const FAIXA_ROW: Record<FaixaIdade, string> = {
  ok: "border-l-emerald-500 bg-emerald-50/70",
  atencao: "border-l-amber-400 bg-amber-50/80",
  atrasada: "border-l-orange-400 bg-orange-50",
  critica: "border-l-rose-500 bg-rose-50",
};

const KPI_TONE = {
  novas: "border-aion-cyan/35 bg-white text-aion-ink",
  fila: "border-aion-line bg-white text-aion-ink",
  velhas: "border-amber-300/80 bg-white text-aion-ink",
  graves: "border-rose-300 bg-white text-aion-ink",
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="aion-bar shrink-0" />
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-aion-line bg-white px-6 py-3">
        <div className="flex items-center gap-5">
          <AionLogo imgClassName="h-12" />
          <div className="border-l border-aion-line pl-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-aion-blue">
              SJH · Engenharia Clínica
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-aion-ink">Sala operacional</h1>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <p className="font-mono text-3xl font-semibold tabular-nums text-aion-blue">{formatRelogioSala(clock)}</p>
          <Link
            href="/indicadores"
            aria-label="Voltar aos indicadores"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-aion-line text-aion-muted hover:bg-aion-mist hover:text-aion-blue"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <section className="grid shrink-0 grid-cols-4 gap-3 px-6 py-3">
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
        <p className="mx-6 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
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

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-aion-line bg-white px-6 py-2 text-[12px] text-aion-muted">
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
    <div className={cn("rounded-xl border px-5 py-3 shadow-[var(--aion-shadow)]", KPI_TONE[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-muted">{label}</p>
      <p className="mt-1 text-6xl font-semibold leading-none tabular-nums text-aion-ink">{value}</p>
      <p className="mt-2 text-sm text-aion-muted">{hint}</p>
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
      <div className="flex items-center justify-center rounded-xl border border-aion-line bg-white text-lg text-aion-muted shadow-[var(--aion-shadow)]">
        Carregando fila…
      </div>
    );
  }

  if (snapshot.fila.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-center">
        <p className="text-3xl font-semibold text-emerald-800">Fila zerada</p>
        <p className="mt-1 text-sm text-emerald-700/80">Nenhuma OS de eq. médico aberta neste recorte</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-aion-line bg-white shadow-[var(--aion-shadow)]">
      <div className="grid grid-cols-[6.5rem_minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(10rem,1.3fr)_7.5rem_6rem_3.5rem] gap-3 border-b border-aion-line px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-aion-muted">
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
              <span className="font-mono font-semibold tabular-nums text-aion-ink">{row.item.OS || "—"}</span>
              <span className="truncate">{row.tipoResumo}</span>
              <span className="truncate text-aion-ink/80">{row.local}</span>
              <span className="truncate text-aion-muted">{row.equipamento}</span>
              <span className="text-right font-semibold tabular-nums">{row.idadeLabel}</span>
              <span className="truncate text-sm uppercase text-aion-muted">{row.prioridade || "—"}</span>
              <span>
                {row.novaHoje ? (
                  <span className="rounded-full bg-aion-mist px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-aion-blue">
                    hoje
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {snapshot.ocultas > 0 ? (
        <p className="border-t border-aion-line px-4 py-2 text-sm font-medium text-aion-ink">
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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-aion-line bg-white px-4 py-3 shadow-[var(--aion-shadow)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-muted">{titulo}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-aion-muted">{vazio}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((row) => (
            <li key={`${titulo}-${row.item.CodigoSerialOS}-${row.item.OS}`}>
              <button
                type="button"
                onClick={() => onSelect(row)}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-1 py-1 text-left hover:bg-aion-mist"
              >
                <span className="min-w-0">
                  <span className="font-mono font-semibold tabular-nums text-aion-ink">{row.item.OS || "—"}</span>
                  <span className="mt-0.5 block truncate text-sm text-aion-muted">{row.local}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{row.idadeLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {extra > 0 ? <p className="mt-auto pt-2 text-sm text-aion-muted">+{extra} novas</p> : null}
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
      <dt className="text-aion-muted">Idade</dt>
      <dd className="font-semibold tabular-nums">{item.idadeLabel}</dd>
      {rows.map((row) => (
        <div key={row.campo} className="contents">
          <dt className="text-aion-muted">{row.campo}</dt>
          <dd className="break-words text-aion-ink">{row.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
