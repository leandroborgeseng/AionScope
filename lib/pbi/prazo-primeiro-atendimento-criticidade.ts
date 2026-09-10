/**
 * Prazo operacional de 1º atendimento por criticidade do equipamento (parque).
 * Alinhado ao indicador SLA criticidade — só UI de fila/detalhe OS.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BUSINESS_HOURS_LABEL, addBusinessHours, diffBusinessHours, diffBusinessMs } from "./business-hours";
import { formatDateTimeBR, parsePbiDate } from "./dates";
import { extractPrazoHoras, findEquipamento, type EquipamentoIndex } from "./indicadores-os";
import {
  META_HORAS_UTEIS_POR_FAIXA,
  faixaCriticidadeQmentum,
  regraMetasCriticidade,
  type FaixaCriticidadeQmentum,
} from "./sla-criticidade";
import type { OsAnaliticoItem } from "./types";

export type PrazoOrigemMeta = "criticidade" | "prioridade" | "sem-meta";

export type CountdownTone = "ok" | "atencao" | "atrasado" | "neutro";

export type PrazoPrimeiroAtendimentoCriticidade = {
  abertura: Date | null;
  atendimento: Date | null;
  limite: Date | null;
  metaHorasUteis: number | null;
  faixa: FaixaCriticidadeQmentum;
  criticidadeRaw: string;
  prioridadeRaw: string;
  origem: PrazoOrigemMeta;
  origemLabel: string;
  /** restanteMs > 0: ainda no prazo; < 0: atrasado (horas úteis). null se sem meta/abertura. */
  restanteMs: number | null;
  /** Se já houve 1º atendimento: true/false vs meta; null se sem atendimento ou sem meta. */
  atendidoNoPrazo: boolean | null;
  jaAtendido: boolean;
  tone: CountdownTone;
  /** Ex.: "restam 2h 15m" / "atrasado 1h 20m" / "Atendido em …" / "sem meta". */
  labelCurto: string;
  labelDetalhe: string;
  aberturaHoraLabel: string;
  limiteLabel: string;
  regraTooltip: string;
};

export const REGRA_PRAZO_1AT_CRITICIDADE =
  `Prazo 1º atendimento = Abertura + meta por criticidade do equipamento (Tag→parque): ${regraMetasCriticidade()}. Sem criticidade: fallback Prioridade da OS (horas úteis) ou sem meta. Evento = DataDoAtendimento.`;

/** Formata duração em horas úteis totais (ms de expediente). */
export function formatDuracaoHorasUteis(ms: number): string {
  const safe = Math.max(0, ms);
  const totalMin = Math.floor(safe / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours >= 48) {
    const d = Math.floor(hours / 9); // ~9h úteis/dia (8h–17h)
    const h = hours % 9;
    if (d > 0 && h > 0) return `${d}d ${h}h`;
    if (d > 0) return `${d}d`;
  }
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

function toneRestante(restanteMs: number, metaMs: number): CountdownTone {
  if (restanteMs < 0) return "atrasado";
  if (metaMs > 0 && restanteMs <= metaMs * 0.25) return "atencao";
  return "ok";
}

export function resolveMetaCriticidadeOuPrioridade(
  os: Pick<OsAnaliticoItem, "Tag" | "Equipamento" | "Setor" | "Prioridade">,
  index: EquipamentoIndex | null | undefined,
): {
  metaHorasUteis: number | null;
  faixa: FaixaCriticidadeQmentum;
  criticidadeRaw: string;
  prioridadeRaw: string;
  origem: PrazoOrigemMeta;
  origemLabel: string;
} {
  const prioridadeRaw = (os.Prioridade ?? "").trim();
  const eq = index ? findEquipamento(index, os.Tag, os.Equipamento, os.Setor) : undefined;
  const criticidadeRaw = eq?.Criticidade?.trim() || "";
  const faixa = faixaCriticidadeQmentum(criticidadeRaw);

  if (faixa !== "Sem faixa") {
    const meta = META_HORAS_UTEIS_POR_FAIXA[faixa];
    return {
      metaHorasUteis: meta,
      faixa,
      criticidadeRaw: criticidadeRaw || faixa,
      prioridadeRaw,
      origem: "criticidade",
      origemLabel: `Criticidade ${faixa} (${meta}h úteis)`,
    };
  }

  const prazoPrioridade = extractPrazoHoras(prioridadeRaw);
  if (prazoPrioridade != null) {
    return {
      metaHorasUteis: prazoPrioridade,
      faixa: "Sem faixa",
      criticidadeRaw: criticidadeRaw || "—",
      prioridadeRaw,
      origem: "prioridade",
      origemLabel: `Prioridade OS (${prazoPrioridade}h úteis · sem criticidade no parque)`,
    };
  }

  return {
    metaHorasUteis: null,
    faixa: "Sem faixa",
    criticidadeRaw: criticidadeRaw || "—",
    prioridadeRaw,
    origem: "sem-meta",
    origemLabel: "Sem meta (sem criticidade no parque e sem Prioridade com horas)",
  };
}

/**
 * Calcula prazo / countdown de 1º atendimento para uma OS.
 * `now` = instante de referência (client clock).
 */
export function buildPrazoPrimeiroAtendimentoCriticidade(
  os: OsAnaliticoItem,
  now: Date,
  index: EquipamentoIndex | null | undefined,
): PrazoPrimeiroAtendimentoCriticidade {
  const abertura = parsePbiDate(os.Abertura);
  const atendimento = parsePbiDate(os.DataDoAtendimento);
  const meta = resolveMetaCriticidadeOuPrioridade(os, index);
  const limite =
    abertura && meta.metaHorasUteis != null ? addBusinessHours(abertura, meta.metaHorasUteis) : null;
  const metaMs = meta.metaHorasUteis != null ? meta.metaHorasUteis * 3_600_000 : null;
  const aberturaHoraLabel = abertura ? format(abertura, "dd/MM HH:mm", { locale: ptBR }) : "—";
  const limiteLabel = limite ? formatDateTimeBR(limite) : "—";
  const regraTooltip = REGRA_PRAZO_1AT_CRITICIDADE;

  if (!abertura) {
    return {
      abertura: null,
      atendimento,
      limite: null,
      ...meta,
      restanteMs: null,
      atendidoNoPrazo: null,
      jaAtendido: Boolean(atendimento),
      tone: "neutro",
      labelCurto: "sem abertura",
      labelDetalhe: "Abertura ausente — não dá para calcular o prazo.",
      aberturaHoraLabel: "—",
      limiteLabel: "—",
      regraTooltip,
    };
  }

  if (atendimento) {
    const horas = diffBusinessHours(abertura, atendimento);
    const noPrazo = meta.metaHorasUteis != null ? horas <= meta.metaHorasUteis : null;
    const tone: CountdownTone =
      noPrazo == null ? "neutro" : noPrazo ? "ok" : "atrasado";
    const quando = formatDateTimeBR(atendimento);
    return {
      abertura,
      atendimento,
      limite,
      ...meta,
      restanteMs: null,
      atendidoNoPrazo: noPrazo,
      jaAtendido: true,
      tone,
      labelCurto:
        noPrazo == null
          ? `Atendido em ${quando}`
          : noPrazo
            ? `Atendido no prazo · ${quando}`
            : `Atendido fora · ${quando}`,
      labelDetalhe:
        noPrazo == null
          ? `1º atendimento em ${quando} (${formatDuracaoHorasUteis(diffBusinessMs(abertura, atendimento))} úteis) — sem meta.`
          : noPrazo
            ? `1º atendimento em ${quando} — no prazo (${formatDuracaoHorasUteis(diffBusinessMs(abertura, atendimento))} ≤ ${meta.metaHorasUteis}h úteis).`
            : `1º atendimento em ${quando} — fora do prazo (${formatDuracaoHorasUteis(diffBusinessMs(abertura, atendimento))} > ${meta.metaHorasUteis}h úteis).`,
      aberturaHoraLabel,
      limiteLabel,
      regraTooltip,
    };
  }

  if (meta.metaHorasUteis == null || limite == null || metaMs == null) {
    return {
      abertura,
      atendimento: null,
      limite: null,
      ...meta,
      restanteMs: null,
      atendidoNoPrazo: null,
      jaAtendido: false,
      tone: "neutro",
      labelCurto: "sem meta",
      labelDetalhe: meta.origemLabel,
      aberturaHoraLabel,
      limiteLabel: "—",
      regraTooltip,
    };
  }

  const decorrido = diffBusinessMs(abertura, now);
  const restanteMs = metaMs - decorrido;
  const tone = toneRestante(restanteMs, metaMs);

  if (restanteMs >= 0) {
    return {
      abertura,
      atendimento: null,
      limite,
      ...meta,
      restanteMs,
      atendidoNoPrazo: null,
      jaAtendido: false,
      tone,
      labelCurto: `restam ${formatDuracaoHorasUteis(restanteMs)}`,
      labelDetalhe: `Limite ${limiteLabel} · ${meta.origemLabel} · ${BUSINESS_HOURS_LABEL}`,
      aberturaHoraLabel,
      limiteLabel,
      regraTooltip,
    };
  }

  return {
    abertura,
    atendimento: null,
    limite,
    ...meta,
    restanteMs,
    atendidoNoPrazo: null,
    jaAtendido: false,
    tone: "atrasado",
    labelCurto: `atrasado ${formatDuracaoHorasUteis(-restanteMs)}`,
    labelDetalhe: `Limite ${limiteLabel} · ${meta.origemLabel} · ${BUSINESS_HOURS_LABEL}`,
    aberturaHoraLabel,
    limiteLabel,
    regraTooltip,
  };
}
