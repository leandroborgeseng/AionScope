"use client";

import { formatDateTimeBR } from "@/lib/pbi/dates";
import {
  REGRA_PRAZO_1AT_CRITICIDADE,
  type CountdownTone,
  type PrazoPrimeiroAtendimentoCriticidade,
} from "@/lib/pbi/prazo-primeiro-atendimento-criticidade";
import { cn } from "@/lib/utils";

const TONE_TEXT: Record<CountdownTone, string> = {
  ok: "text-emerald-700",
  atencao: "text-amber-700",
  atrasado: "text-rose-700",
  neutro: "text-aion-muted",
};

const TONE_BG: Record<CountdownTone, string> = {
  ok: "border-emerald-200 bg-emerald-50/80",
  atencao: "border-amber-200 bg-amber-50/80",
  atrasado: "border-rose-200 bg-rose-50/80",
  neutro: "border-aion-line bg-aion-mist/40",
};

/** Countdown compacto para linhas de lista. */
export function OsCountdownBadge({
  prazo,
  className,
}: {
  prazo: PrazoPrimeiroAtendimentoCriticidade;
  className?: string;
}) {
  return (
    <span
      className={cn("font-semibold tabular-nums", TONE_TEXT[prazo.tone], className)}
      title={prazo.labelDetalhe}
    >
      {prazo.labelCurto}
    </span>
  );
}

/**
 * Bloco de detalhe: Abertura · Prazo 1º atendimento · Criticidade · Countdown.
 * Atualize `prazo` no client a cada 30–60s (ou com o clock da Sala).
 */
export function OsPrazoPrimeiroAtendimentoBloco({
  prazo,
  className,
}: {
  prazo: PrazoPrimeiroAtendimentoCriticidade;
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-2 rounded-lg border p-4", TONE_BG[prazo.tone], className)}
      title={prazo.regraTooltip}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-aion-muted">
        Prazo 1º atendimento
      </p>
      <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-aion-muted">Abertura</dt>
        <dd className="font-medium tabular-nums text-aion-ink">
          {prazo.abertura ? formatDateTimeBR(prazo.abertura) : "—"}
        </dd>
        <dt className="text-aion-muted">Prazo limite</dt>
        <dd className="tabular-nums text-aion-ink">{prazo.limiteLabel}</dd>
        <dt className="text-aion-muted">Criticidade</dt>
        <dd className="text-aion-ink">{prazo.origemLabel}</dd>
        <dt className="text-aion-muted">Countdown</dt>
        <dd className={cn("font-semibold tabular-nums", TONE_TEXT[prazo.tone])}>{prazo.labelCurto}</dd>
      </dl>
      <p className="text-[11px] leading-snug text-aion-muted">{REGRA_PRAZO_1AT_CRITICIDADE}</p>
    </div>
  );
}
