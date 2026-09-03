import { addDays, format } from "date-fns";
import { nowInSaoPaulo, parsePbiDate } from "./dates";
import { isCorretiva } from "./filters";
import { classifyPlanoEc } from "./indicadores-os";
import { linkedToMedicalPark } from "./medical";
import type { OsAnaliticoItem } from "./types";
import { osFechamentoDate } from "./volume-ec";

export const SALA_MAX_LINHAS = 13;
export const SALA_TOP_ANTIGAS = 5;
export const SALA_TOP_SETORES = 10;
export const SALA_REFRESH_MS = 2 * 60_000;
/** Janela inclusiva: hoje + (N − 1) dias anteriores (America/Sao_Paulo), por Abertura. */
export const SALA_JANELA_DIAS = 30;
export const SALA_FLUXO_15_DIAS = 15;

export const META_OK_MS = 4 * 60 * 60 * 1000;
export const META_ATENCAO_MS = 24 * 60 * 60 * 1000;
export const META_ATRASADA_MS = 72 * 60 * 60 * 1000;

export const SALA_RECORTE_LINHA =
  "eq. médicos · sem instrumental · sem sem-tag · fila 30d (Abertura) · semana seg–hoje SP · prev/TSE/calib devem fechar no mês";

export const SALA_TIPOS_ORDEM = ["corretiva", "preventiva", "tse", "calibracao", "outros"] as const;

export const SALA_TIPO_LABEL: Record<(typeof SALA_TIPOS_ORDEM)[number], string> = {
  corretiva: "Corretiva",
  preventiva: "Preventiva",
  tse: "TSE",
  calibracao: "Calibração",
  outros: "Outros",
};
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

export type SalaFluxoId = "hoje" | "semana" | "dias15";

export type SalaFluxoJanela = {
  id: SalaFluxoId;
  label: string;
  hint: string;
  abertas: number;
  fechadas: number;
  saldo: number;
};

export type SalaSetorCount = {
  setor: string;
  quantidade: number;
};

export type SalaTipoManutencao = (typeof SALA_TIPOS_ORDEM)[number];

export type SalaTipoCount = {
  id: SalaTipoManutencao;
  label: string;
  quantidade: number;
  /** Prev/TSE/Calib abertas com Abertura antes do início da janela (anomalia vs fecha-no-mês). */
  anomaliaMesAnterior: number;
  idadeMediaMs: number | null;
  idadeMediaLabel: string | null;
  idadeMaxMs: number | null;
  idadeMaxLabel: string | null;
};

export type SalaEstratificacao = {
  id: "dias15" | "mes";
  label: string;
  hint: string;
  totalAbertas: number;
  tipos: SalaTipoCount[];
  corretiva: SalaTipoCount;
};

export type SalaSnapshot = {
  now: Date;
  fila: SalaOs[];
  visiveis: SalaOs[];
  ocultas: number;
  novasHoje: SalaOs[];
  topAntigas: SalaOs[];
  fluxos: SalaFluxoJanela[];
  estratificacoes: SalaEstratificacao[];
  setoresAbertos: SalaSetorCount[];
  setoresExtras: number;
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

/** Setor da OS para ranking; vazio → “Sem setor”. */
export function rotuloSetor(os: Pick<OsAnaliticoItem, "Setor">) {
  return texto(os.Setor) || "Sem setor";
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

/** Início do dia (SP) do primeiro dia da janela inclusiva de `dias`. */
export function inicioJanelaSala(now = nowInSaoPaulo(), dias = SALA_JANELA_DIAS) {
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return addDays(hoje, -(Math.max(1, dias) - 1));
}

/** Segunda-feira 00:00 (America/Sao_Paulo) da semana calendário corrente. */
export function inicioSemanaCalendario(now = nowInSaoPaulo()) {
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = hoje.getDay(); // 0=dom … 6=sáb
  const diasDesdeSegunda = dow === 0 ? 6 : dow - 1;
  return addDays(hoje, -diasDesdeSegunda);
}

/** Dia 1 do mês calendário corrente (America/Sao_Paulo), 00:00. */
export function inicioMesCalendario(now = nowInSaoPaulo()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Abertura nos últimos N dias (calendário America/Sao_Paulo), inclusive. Sem Abertura válida = fora. */
export function isAberturaNaJanelaSala(abertura: Date | null, now = nowInSaoPaulo(), dias = SALA_JANELA_DIAS) {
  if (!abertura) return false;
  return abertura.getTime() >= inicioJanelaSala(now, dias).getTime();
}

export function isDataNaJanelaDesde(date: Date | null, inicio: Date) {
  if (!date) return false;
  return date.getTime() >= inicio.getTime();
}

/**
 * Classifica TipoDeManutencao para a sala.
 * Reusa classifyPlanoEc (TSE / Calibração / Preventiva) e isCorretiva.
 */
export function classifySalaTipo(tipo: string | null | undefined): SalaTipoManutencao {
  const plano = classifyPlanoEc(tipo);
  if (plano === "TSE") return "tse";
  if (plano === "Calibração") return "calibracao";
  if (plano === "Preventiva") return "preventiva";
  if (isCorretiva(tipo)) return "corretiva";
  return "outros";
}

export function isTipoPlanoFechaNoMes(tipo: SalaTipoManutencao) {
  return tipo === "preventiva" || tipo === "tse" || tipo === "calibracao";
}

/** Recorte médico da sala: tipo operacional + tag no parque médico. */
export function isOsSalaMedica(
  item: OsAnaliticoItem,
  medicalTags: Set<string>,
  medicalIds: Set<number> = new Set(),
) {
  if (!isTipoSalaOperacional(item.TipoDeManutencao)) return false;
  const tag = (item.Tag ?? "").trim();
  if (!tag) return false;
  return linkedToMedicalPark(tag, undefined, medicalTags, medicalIds);
}

export function collectOsEcAbertas(
  os: OsAnaliticoItem[],
  medicalTags: Set<string>,
  medicalIds: Set<number> = new Set(),
  now = nowInSaoPaulo(),
) {
  return os.filter((item) => {
    if (!isOsAberta(item)) return false;
    if (!isOsSalaMedica(item, medicalTags, medicalIds)) return false;
    return isAberturaNaJanelaSala(parsePbiDate(item.Abertura), now);
  });
}

function emptyTipoCount(id: SalaTipoManutencao): SalaTipoCount {
  return {
    id,
    label: SALA_TIPO_LABEL[id],
    quantidade: 0,
    anomaliaMesAnterior: 0,
    idadeMediaMs: null,
    idadeMediaLabel: null,
    idadeMaxMs: null,
    idadeMaxLabel: null,
  };
}

function finalizeTipoCount(
  id: SalaTipoManutencao,
  quantidade: number,
  anomaliaMesAnterior: number,
  idadesMs: number[],
): SalaTipoCount {
  const idadeMediaMs = idadesMs.length
    ? Math.round(idadesMs.reduce((acc, n) => acc + n, 0) / idadesMs.length)
    : null;
  const idadeMaxMs = idadesMs.length ? Math.max(...idadesMs) : null;
  return {
    id,
    label: SALA_TIPO_LABEL[id],
    quantidade,
    anomaliaMesAnterior,
    idadeMediaMs,
    idadeMediaLabel: idadeMediaMs != null ? formatIdade(idadeMediaMs) : null,
    idadeMaxMs,
    idadeMaxLabel: idadeMaxMs != null ? formatIdade(idadeMaxMs) : null,
  };
}

/**
 * OS ainda abertas com Abertura na janela, quebradas por tipo.
 * Anomalia (só relevante no bloco mês): prev/TSE/calib ainda abertas com
 * Abertura antes do mês calendário corrente (devem fechar no próprio mês).
 */
export function buildEstratificacaoAbertas(
  osMedicas: OsAnaliticoItem[],
  inicioJanela: Date,
  now: Date,
  meta: { id: SalaEstratificacao["id"]; label: string; hint: string },
): SalaEstratificacao {
  const inicioMes = inicioMesCalendario(now);
  const contarAnomaliaMes = meta.id === "mes";
  const buckets: Record<SalaTipoManutencao, { naJanela: number[]; anomalia: number }> = {
    corretiva: { naJanela: [], anomalia: 0 },
    preventiva: { naJanela: [], anomalia: 0 },
    tse: { naJanela: [], anomalia: 0 },
    calibracao: { naJanela: [], anomalia: 0 },
    outros: { naJanela: [], anomalia: 0 },
  };

  for (const item of osMedicas) {
    if (!isOsAberta(item)) continue;
    const abertura = parsePbiDate(item.Abertura);
    if (!abertura) continue;
    const tipo = classifySalaTipo(item.TipoDeManutencao);
    const idadeMs = Math.max(0, now.getTime() - abertura.getTime());
    if (abertura.getTime() >= inicioJanela.getTime()) {
      buckets[tipo].naJanela.push(idadeMs);
    } else if (contarAnomaliaMes && isTipoPlanoFechaNoMes(tipo) && abertura.getTime() < inicioMes.getTime()) {
      buckets[tipo].anomalia += 1;
    }
  }

  const tipos = SALA_TIPOS_ORDEM.map((id) =>
    finalizeTipoCount(id, buckets[id].naJanela.length, buckets[id].anomalia, buckets[id].naJanela),
  ).filter((row) => row.id !== "outros" || row.quantidade > 0 || row.anomaliaMesAnterior > 0);

  const corretiva = tipos.find((row) => row.id === "corretiva") ?? emptyTipoCount("corretiva");
  const totalAbertas = tipos.reduce((acc, row) => acc + row.quantidade, 0);

  return {
    id: meta.id,
    label: meta.label,
    hint: meta.hint,
    totalAbertas,
    tipos,
    corretiva,
  };
}

export function buildEstratificacoesSala(osMedicas: OsAnaliticoItem[], now = nowInSaoPaulo()): SalaEstratificacao[] {
  return [
    buildEstratificacaoAbertas(osMedicas, inicioJanelaSala(now, SALA_FLUXO_15_DIAS), now, {
      id: "dias15",
      label: "15 dias",
      hint: "Ainda abertas · Abertura nos últimos 15 dias",
    }),
    buildEstratificacaoAbertas(osMedicas, inicioMesCalendario(now), now, {
      id: "mes",
      label: "Mês",
      hint: "Ainda abertas · Abertura no mês calendário (SP)",
    }),
  ];
}

export function buildFluxosSala(osMedicas: OsAnaliticoItem[], now = nowInSaoPaulo()): SalaFluxoJanela[] {
  const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inicioSemana = inicioSemanaCalendario(now);
  const inicio15 = inicioJanelaSala(now, SALA_FLUXO_15_DIAS);

  const defs: Array<{ id: SalaFluxoId; label: string; hint: string; inicio: Date; soHoje?: boolean }> = [
    {
      id: "hoje",
      label: "Hoje",
      hint: "Abertura / fechamento no dia (SP)",
      inicio: inicioHoje,
      soHoje: true,
    },
    {
      id: "semana",
      label: "Esta semana",
      hint: "Seg–hoje (calendário SP)",
      inicio: inicioSemana,
    },
    {
      id: "dias15",
      label: "15 dias",
      hint: "Últimos 15 dias (inclusivo)",
      inicio: inicio15,
    },
  ];

  return defs.map((def) => {
    let abertas = 0;
    let fechadas = 0;
    for (const item of osMedicas) {
      const abertura = parsePbiDate(item.Abertura);
      const fechamento = osFechamentoDate(item);
      const abriu = def.soHoje
        ? Boolean(abertura && sameCalendarDay(abertura, now))
        : isDataNaJanelaDesde(abertura, def.inicio);
      const fechou = def.soHoje
        ? Boolean(fechamento && sameCalendarDay(fechamento, now))
        : isDataNaJanelaDesde(fechamento, def.inicio);
      if (abriu) abertas += 1;
      if (fechou) fechadas += 1;
    }
    return {
      id: def.id,
      label: def.label,
      hint: def.hint,
      abertas,
      fechadas,
      saldo: abertas - fechadas,
    };
  });
}

export function buildSetoresAbertos(fila: SalaOs[], top = SALA_TOP_SETORES) {
  const map = new Map<string, number>();
  for (const row of fila) {
    const setor = rotuloSetor(row.item);
    map.set(setor, (map.get(setor) ?? 0) + 1);
  }
  const ranking = [...map.entries()]
    .map(([setor, quantidade]) => ({ setor, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.setor.localeCompare(b.setor, "pt-BR"));
  return {
    setoresAbertos: ranking.slice(0, top),
    setoresExtras: Math.max(0, ranking.length - top),
  };
}

export function buildSalaSnapshot(
  os: OsAnaliticoItem[],
  medicalTags: Set<string>,
  now = nowInSaoPaulo(),
  medicalIds: Set<number> = new Set(),
): SalaSnapshot {
  const osMedicas = os.filter((item) => isOsSalaMedica(item, medicalTags, medicalIds));
  const fila = collectOsEcAbertas(os, medicalTags, medicalIds, now).map((item) => toSalaOs(item, now)).sort(compareUrgencia);

  const novasHoje = fila.filter((row) => row.novaHoje).sort((a, b) => {
    const ta = a.abertura?.getTime() ?? 0;
    const tb = b.abertura?.getTime() ?? 0;
    return tb - ta;
  });

  const visiveis = fila.slice(0, SALA_MAX_LINHAS);
  const { setoresAbertos, setoresExtras } = buildSetoresAbertos(fila);

  return {
    now,
    fila,
    visiveis,
    ocultas: Math.max(0, fila.length - visiveis.length),
    novasHoje,
    topAntigas: fila.slice(0, SALA_TOP_ANTIGAS),
    fluxos: buildFluxosSala(osMedicas, now),
    estratificacoes: buildEstratificacoesSala(osMedicas, now),
    setoresAbertos,
    setoresExtras,
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
