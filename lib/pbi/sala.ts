import { format } from "date-fns";
import { nowInSaoPaulo, parsePbiDate } from "./dates";
import { linkedToMedicalPark } from "./medical";
import type { OsAnaliticoItem } from "./types";
import { osFechamentoDate } from "./volume-ec";

export const SALA_MAX_LINHAS = 13;
export const SALA_TOP_ANTIGAS = 5;
export const SALA_REFRESH_MS = 2 * 60_000;

export const META_OK_MS = 4 * 60 * 60 * 1000;
export const META_ATENCAO_MS = 24 * 60 * 60 * 1000;
export const META_ATRASADA_MS = 72 * 60 * 60 * 1000;

export const SALA_RECORTE_LINHA =
  "somente eq. médicos · sem instrumental · sem OS sem tag";

export type FaixaIdade = "ok" | "atencao" | "atrasada" | "critica";

export const FAIXAS_LEGENDA: Array<{ id: FaixaIdade; label: string; detalhe: string }> = [
  { id: "ok", label: "ok", detalhe: "≤ 4h" },
  { id: "atencao", label: "atenção", detalhe: "> 4h e ≤ 24h" },
  { id: "atrasada", label: "atrasada", detalhe: "> 24h e ≤ 72h" },
  { id: "critica", label: "crítica", detalhe: "> 72h" },
];

export type SalaOs = {
  item: OsAnaliticoItem;
  abertura: Date | null;
  idadeMs: number;
  idadeLabel: string;
  faixa: FaixaIdade;
  acimaDaMeta: boolean;
  novaHoje: boolean;
  tipoResumo: string;
  local: string;
  equipamento: string;
  prioridade: string;
};

export type SalaSnapshot = {
  now: Date;
  fila: SalaOs[];
  visiveis: SalaOs[];
  ocultas: number;
  novasHoje: SalaOs[];
  topAntigas: SalaOs[];
  kpis: {
    novasHoje: number;
    filaAberta: number;
    envelhecidas: number;
    estouradasGraves: number;
  };
};

/** OS aberta = sem Fechamento e sem DataDaSolucao parseáveis. Não usa “em atendimento”. */
export function isOsAberta(os: Pick<OsAnaliticoItem, "Fechamento" | "DataDaSolucao">) {
  return osFechamentoDate(os) == null;
}

export function sameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function faixaPorIdade(idadeMs: number): FaixaIdade {
  if (idadeMs <= META_OK_MS) return "ok";
  if (idadeMs <= META_ATENCAO_MS) return "atencao";
  if (idadeMs <= META_ATRASADA_MS) return "atrasada";
  return "critica";
}

export function formatIdade(ms: number): string {
  const safe = Math.max(0, ms);
  const totalMin = Math.floor(safe / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  return `${mins}min`;
}

export function resumoTipo(tipo: string | null | undefined): string {
  const raw = (tipo ?? "").trim();
  if (!raw) return "—";
  let t = raw.replace(/^A\s*-\s*/i, "");
  t = t.replace(/\s*ENGENHARIA\s+CL[IÍ]NICA\s*/gi, " ").replace(/\s+/g, " ").trim();
  if (!t) t = raw;
  return t.length > 32 ? `${t.slice(0, 30)}…` : t;
}

function texto(value: string | null | undefined) {
  const v = (value ?? "").trim();
  return v || "";
}

export function rotuloLocal(os: OsAnaliticoItem) {
  return texto(os.Setor) || texto(os.CentroDeCusto) || "—";
}

export function rotuloEquipamento(os: OsAnaliticoItem) {
  const nome = texto(os.Equipamento);
  const tag = texto(os.Tag);
  if (nome && tag && !nome.includes(tag)) return `${nome} · ${tag}`;
  return nome || tag || "—";
}

export function toSalaOs(item: OsAnaliticoItem, now: Date): SalaOs {
  const abertura = parsePbiDate(item.Abertura);
  const idadeMs = abertura ? Math.max(0, now.getTime() - abertura.getTime()) : 0;
  const faixa = abertura ? faixaPorIdade(idadeMs) : "ok";
  return {
    item,
    abertura,
    idadeMs,
    idadeLabel: abertura ? formatIdade(idadeMs) : "—",
    faixa,
    acimaDaMeta: Boolean(abertura && idadeMs > META_OK_MS),
    novaHoje: Boolean(abertura && sameCalendarDay(abertura, now)),
    tipoResumo: resumoTipo(item.TipoDeManutencao),
    local: rotuloLocal(item),
    equipamento: rotuloEquipamento(item),
    prioridade: texto(item.Prioridade),
  };
}

export function compareUrgencia(a: SalaOs, b: SalaOs) {
  if (a.acimaDaMeta !== b.acimaDaMeta) return a.acimaDaMeta ? -1 : 1;
  if (b.idadeMs !== a.idadeMs) return b.idadeMs - a.idadeMs;
  return (a.item.OS || "").localeCompare(b.item.OS || "", "pt-BR");
}

function normalizeTipo(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

/** Instrumental, predial (M -) e obras (O -) ficam de fora da sala. */
export function isTipoSalaOperacional(tipo: string | null | undefined) {
  const v = normalizeTipo(tipo);
  if (v.includes("INSTRUMENTAL")) return false;
  if (v.startsWith("M -") || v.startsWith("M-") || v.startsWith("O -") || v.startsWith("O-")) return false;
  return true;
}

export function collectOsEcAbertas(
  os: OsAnaliticoItem[],
  medicalTags: Set<string>,
  medicalIds: Set<number> = new Set(),
) {
  return os.filter((item) => {
    if (!isOsAberta(item)) return false;
    if (!isTipoSalaOperacional(item.TipoDeManutencao)) return false;
    const tag = (item.Tag ?? "").trim();
    if (!tag) return false;
    return linkedToMedicalPark(tag, undefined, medicalTags, medicalIds);
  });
}

export function buildSalaSnapshot(
  os: OsAnaliticoItem[],
  medicalTags: Set<string>,
  now = nowInSaoPaulo(),
  medicalIds: Set<number> = new Set(),
): SalaSnapshot {
  const fila = collectOsEcAbertas(os, medicalTags, medicalIds).map((item) => toSalaOs(item, now)).sort(compareUrgencia);

  const novasHoje = fila.filter((row) => row.novaHoje).sort((a, b) => {
    const ta = a.abertura?.getTime() ?? 0;
    const tb = b.abertura?.getTime() ?? 0;
    return tb - ta;
  });

  const visiveis = fila.slice(0, SALA_MAX_LINHAS);
  return {
    now,
    fila,
    visiveis,
    ocultas: Math.max(0, fila.length - visiveis.length),
    novasHoje,
    topAntigas: fila.slice(0, SALA_TOP_ANTIGAS),
    kpis: {
      novasHoje: novasHoje.length,
      filaAberta: fila.length,
      envelhecidas: fila.filter((row) => row.acimaDaMeta).length,
      estouradasGraves: fila.filter((row) => row.faixa === "critica").length,
    },
  };
}

export function formatRelogioSala(date: Date) {
  return format(date, "HH:mm:ss");
}

export function formatAtualizadoHa(dataUpdatedAt: number | undefined, nowMs: number) {
  if (!dataUpdatedAt) return "Aguardando dados";
  const sec = Math.max(0, Math.round((nowMs - dataUpdatedAt) / 1000));
  if (sec < 60) return `Atualizado há ${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest ? `Atualizado há ${min}min ${rest}s` : `Atualizado há ${min}min`;
}
