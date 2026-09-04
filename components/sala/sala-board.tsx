"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { AionLogo } from "@/components/brand/aion-logo";
import { Sheet } from "@/components/ui/sheet";
import { formatDateTimeBR } from "@/lib/pbi/dates";
import { BUSINESS_HOURS_LABEL } from "@/lib/pbi/business-hours";
import {
  FAIXAS_LEGENDA,
  SALA_RECORTE_LINHA,
  formatAtualizadoHa,
  formatRelogioSala,
  type FaixaIdade,
  type SalaEstratificacao,
  type SalaFluxoJanela,
  type SalaOs,
  type SalaSetorCount,
  type SalaSnapshot,
  type SalaTipoCount,
} from "@/lib/pbi/sala";
import { OFICINA_EC_REGRA_RESUMO, OFICINAS_EC_LABELS } from "@/lib/pbi/oficina-ec";
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
  const { kpis, fluxos, estratificacoes } = snapshot;
  const empty = loading && snapshot.fila.length === 0;
  const valor = (n: number) => (empty ? "—" : String(n));
  const fluxoHojeSemana = fluxos.filter((f) => f.id === "hoje" || f.id === "semana");
  const fluxo15 = fluxos.find((f) => f.id === "dias15");
  const estrat15 = estratificacoes.find((e) => e.id === "dias15");
  const estratMes = estratificacoes.find((e) => e.id === "mes");

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
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-muted">Fila · &gt;4h úteis · &gt;72h úteis</p>
            <p className="font-mono text-lg font-semibold tabular-nums text-aion-ink">
              {valor(kpis.filaAberta)} · {valor(kpis.envelhecidas)} · {valor(kpis.estouradasGraves)}
            </p>
          </div>
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

      {error ? (
        <p className="mx-6 mt-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="grid shrink-0 grid-cols-2 gap-3 px-6 pt-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <FluxoBloco fluxos={fluxoHojeSemana} empty={empty} />
        {estrat15 ? <EstratBloco estrat={estrat15} fluxo={fluxo15} empty={empty} /> : null}
        {estratMes ? <EstratBloco estrat={estratMes} empty={empty} destaqueMes /> : null}
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-3 px-6 py-3">
        <SetoresPainel
          setores={snapshot.setoresAbertos}
          extras={snapshot.setoresExtras}
          empty={empty}
          totalFila={kpis.filaAberta}
        />
        <FilaLista snapshot={snapshot} loading={loading} onSelect={setSelecionada} />
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-aion-line bg-white px-6 py-2 text-[12px] text-aion-muted">
        <p className="tabular-nums">
          {formatAtualizadoHa(dataUpdatedAt, nowMs)}
          {dataUpdatedAt ? ` · ${formatDateTimeBR(new Date(dataUpdatedAt))}` : ""}
        </p>
        <p className="max-w-[52rem] truncate" title={SALA_RECORTE_LINHA}>
          {SALA_RECORTE_LINHA}
        </p>
        <p title={`${OFICINA_EC_REGRA_RESUMO}. Aceitas: ${OFICINAS_EC_LABELS.join(", ")}`}>
          Somente oficinas de Engenharia Clínica (equals)
          {!empty && snapshot.foraPorOficina > 0
            ? ` · ${snapshot.foraPorOficina} OS fora por oficina`
            : ""}
        </p>
        <p title={BUSINESS_HOURS_LABEL}>
          Idade em horas úteis 8h–17h seg–sex · sem preventiva/TSE/calibração · sem feriados nacionais nesta versão
        </p>
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

function FluxoBloco({ fluxos, empty }: { fluxos: SalaFluxoJanela[]; empty: boolean }) {
  return (
    <section className="rounded-xl border border-aion-line bg-white px-4 py-3 shadow-[var(--aion-shadow)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-muted">
          Entrada × saída
        </h2>
        <p className="text-[11px] text-aion-muted">Abertura vs fechamento/solução</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {fluxos.map((fluxo) => (
          <div key={fluxo.id} className="rounded-lg border border-aion-line/80 bg-aion-mist/40 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-aion-blue">{fluxo.label}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-aion-muted">Abertas</p>
                <p className="text-4xl font-semibold leading-none tabular-nums text-aion-ink">
                  {empty ? "—" : fluxo.abertas}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-aion-muted">Fechadas</p>
                <p className="text-4xl font-semibold leading-none tabular-nums text-aion-ink">
                  {empty ? "—" : fluxo.fechadas}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-aion-muted">
              {fluxo.hint}
              {!empty ? ` · saldo ${fluxo.saldo > 0 ? "+" : ""}${fluxo.saldo}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EstratBloco({
  estrat,
  fluxo,
  empty,
  destaqueMes = false,
}: {
  estrat: SalaEstratificacao;
  fluxo?: SalaFluxoJanela;
  empty: boolean;
  destaqueMes?: boolean;
}) {
  const tiposVisiveis = estrat.tipos.filter((t) => t.id !== "outros" || t.quantidade > 0);

  return (
    <section
      className={cn(
        "rounded-xl border bg-white px-4 py-3 shadow-[var(--aion-shadow)]",
        destaqueMes ? "border-aion-cyan/40" : "border-aion-line",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-muted">
            Abertas · {estrat.label}
          </h2>
          <p className="text-[11px] text-aion-muted">{estrat.hint}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums text-aion-ink">
            {empty ? "—" : estrat.totalAbertas}
          </p>
          {fluxo && !empty ? (
            <p className="text-[11px] text-aion-muted">
              fluxo {fluxo.abertas}↑ {fluxo.fechadas}↓
            </p>
          ) : null}
        </div>
      </div>

      <ul className="mt-2 grid grid-cols-2 gap-2">
        {tiposVisiveis.map((tipo) => (
          <TipoLinha key={tipo.id} tipo={tipo} empty={empty} />
        ))}
      </ul>

      {!empty && estrat.corretiva.quantidade > 0 ? (
        <p className="mt-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-sm text-rose-900">
          Corretivas (h úteis): média {estrat.corretiva.idadeMediaLabel ?? "—"} · mais antiga{" "}
          {estrat.corretiva.idadeMaxLabel ?? "—"}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-aion-muted">
          Tempo de atendimento das corretivas em horas úteis (8h–17h seg–sex).
        </p>
      )}
    </section>
  );
}

function TipoLinha({ tipo, empty }: { tipo: SalaTipoCount; empty: boolean }) {
  const isCorretiva = tipo.id === "corretiva";

  return (
    <li
      className={cn(
        "rounded-lg border px-2.5 py-2",
        isCorretiva ? "border-rose-200 bg-rose-50/60" : "border-aion-line/80 bg-aion-mist/30",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aion-muted">{tipo.label}</p>
        <p className={cn("text-3xl font-semibold leading-none tabular-nums", isCorretiva ? "text-rose-800" : "text-aion-ink")}>
          {empty ? "—" : tipo.quantidade}
        </p>
      </div>
      {isCorretiva && !empty && tipo.quantidade > 0 ? (
        <p className="mt-1 text-[11px] text-rose-800/90">
          méd. {tipo.idadeMediaLabel} · máx. {tipo.idadeMaxLabel}
        </p>
      ) : null}
    </li>
  );
}

function SetoresPainel({
  setores,
  extras,
  empty,
  totalFila,
}: {
  setores: SalaSetorCount[];
  extras: number;
  empty: boolean;
  totalFila: number;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-aion-line bg-white px-4 py-3 shadow-[var(--aion-shadow)]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-aion-muted">
          Abertas por setor
        </h2>
        <p className="font-mono text-sm tabular-nums text-aion-ink">{empty ? "—" : totalFila}</p>
      </div>
      <p className="mt-0.5 text-[11px] text-aion-muted">Demanda · 30d · sem prev/TSE/calib</p>
      {empty ? (
        <p className="mt-4 text-sm text-aion-muted">Carregando…</p>
      ) : setores.length === 0 ? (
        <p className="mt-4 text-sm text-aion-muted">Nenhuma OS aberta</p>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-hidden">
          {setores.map((row) => (
            <li key={row.setor} className="flex items-baseline justify-between gap-2 border-b border-aion-line/60 py-1.5 last:border-0">
              <span className="truncate text-base text-aion-ink">{row.setor}</span>
              <span className="shrink-0 text-2xl font-semibold tabular-nums text-aion-ink">{row.quantidade}</span>
            </li>
          ))}
        </ul>
      )}
      {extras > 0 ? <p className="mt-auto pt-2 text-sm text-aion-muted">+{extras} setores</p> : null}
    </section>
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
        <p className="mt-1 text-sm text-emerald-700/80">
          Nenhuma OS de demanda (eq. médico) aberta nos últimos 30 dias — sem preventiva/TSE/calibração
        </p>
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
        <span className="text-right">Idade (h úteis)</span>
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
      <dt className="text-aion-muted">Idade (h úteis)</dt>
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
