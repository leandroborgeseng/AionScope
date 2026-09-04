import { differenceInCalendarDays } from "date-fns";
import { formatDateBR, formatDateTimeBR, nowInSaoPaulo, parsePbiDate } from "./dates";
import { isOsAberta } from "./sala";
import type { OsAnaliticoItem } from "./types";
import { osFechamentoDate } from "./volume-ec";

/** Tipo canônico na API (amostra DoisAnosAtuais). */
export const TIPO_SOLICITACAO_COMPRA_EC = "A - SOLICITAÇÃO DE COMPRA ENGENHARIA CLÍNICA";

export const COMPRAS_REGRA_UI = [
  "Identificação: TipoDeManutencao contém “SOLICITAÇÃO DE COMPRA” (na amostra: “A - SOLICITAÇÃO DE COMPRA ENGENHARIA CLÍNICA”).",
  "Recorte EC implícito: o tipo é de Engenharia Clínica — não há tipo predial equivalente na API; predial não entra.",
  "Aberta = sem Fechamento e sem DataDaSolucao parseáveis (mesmo critério da Sala).",
  "Dias de espera = dias corridos (calendário) entre Abertura e agora, fuso America/Sao_Paulo.",
  "Não usa Pendencia “AGUARDANDO REALIZAÇÃO DE COMPRA” (sinal distinto: OS de outro tipo aguardando peça/compra).",
] as const;

export const COMPRAS_FECHADAS_DIAS = 90;

export type CompraRow = OsAnaliticoItem & {
  aberturaDate: Date;
  diasEspera: number;
  abertaHaLabel: string;
  fechamentoDate: Date | null;
  diasAteFechar: number | null;
};

export type ComprasKpis = {
  quantidade: number;
  idadeMediaDias: number | null;
  maisAntigaDias: number | null;
};

export type ComprasSnapshot = {
  abertas: CompraRow[];
  fechadas90d: CompraRow[];
  kpisAbertas: ComprasKpis;
  kpisFechadas: ComprasKpis;
  regra: typeof COMPRAS_REGRA_UI;
  tipoCanonico: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

/** Solicitação de compra = TipoDeManutencao contém “SOLICITAÇÃO DE COMPRA”. */
export function isSolicitacaoCompra(item: Pick<OsAnaliticoItem, "TipoDeManutencao">) {
  return normalize(item.TipoDeManutencao).includes("SOLICITACAO DE COMPRA");
}

export function diasCorridosEntre(from: Date, to: Date) {
  return Math.max(0, differenceInCalendarDays(to, from));
}

function abertaHaLabel(dias: number) {
  if (dias <= 0) return "aberta hoje";
  if (dias === 1) return "aberta há 1 dia";
  return `aberta há ${dias} dias`;
}

function toRow(item: OsAnaliticoItem, now: Date, fechamento: Date | null): CompraRow | null {
  const aberturaDate = parsePbiDate(item.Abertura);
  if (!aberturaDate) return null;
  const fim = fechamento ?? now;
  const diasEspera = diasCorridosEntre(aberturaDate, fim);
  return {
    ...item,
    aberturaDate,
    diasEspera,
    abertaHaLabel: fechamento ? `fechada em ${diasEspera} dias` : abertaHaLabel(diasEspera),
    fechamentoDate: fechamento,
    diasAteFechar: fechamento ? diasEspera : null,
  };
}

function sortMaisAntigas(a: CompraRow, b: CompraRow) {
  if (b.diasEspera !== a.diasEspera) return b.diasEspera - a.diasEspera;
  return a.aberturaDate.getTime() - b.aberturaDate.getTime();
}

function buildKpis(rows: CompraRow[]): ComprasKpis {
  if (!rows.length) return { quantidade: 0, idadeMediaDias: null, maisAntigaDias: null };
  const sum = rows.reduce((acc, row) => acc + row.diasEspera, 0);
  return {
    quantidade: rows.length,
    idadeMediaDias: Math.round((sum / rows.length) * 10) / 10,
    maisAntigaDias: rows[0]?.diasEspera ?? null,
  };
}

export function buildComprasSnapshot(os: OsAnaliticoItem[], now = nowInSaoPaulo()): ComprasSnapshot {
  const compras = os.filter(isSolicitacaoCompra);
  const abertas: CompraRow[] = [];
  const fechadas90d: CompraRow[] = [];
  const limiarFechadas = new Date(now);
  limiarFechadas.setDate(limiarFechadas.getDate() - COMPRAS_FECHADAS_DIAS);

  for (const item of compras) {
    if (isOsAberta(item)) {
      const row = toRow(item, now, null);
      if (row) abertas.push(row);
      continue;
    }
    const fechamento = osFechamentoDate(item);
    if (!fechamento || fechamento.getTime() < limiarFechadas.getTime()) continue;
    const row = toRow(item, now, fechamento);
    if (row) fechadas90d.push(row);
  }

  abertas.sort(sortMaisAntigas);
  fechadas90d.sort(sortMaisAntigas);

  return {
    abertas,
    fechadas90d,
    kpisAbertas: buildKpis(abertas),
    kpisFechadas: buildKpis(fechadas90d),
    regra: COMPRAS_REGRA_UI,
    tipoCanonico: TIPO_SOLICITACAO_COMPRA_EC,
  };
}

export function formatCompraAbertura(row: CompraRow) {
  return formatDateTimeBR(row.aberturaDate);
}

export function formatCompraFechamento(row: CompraRow) {
  return row.fechamentoDate ? formatDateBR(row.fechamentoDate) : "—";
}

/** Portal GlobalThings (não há deep-link estável de OS na API pública). */
export const GLOBAL_THINGS_PORTAL_URL = "https://sjh.globalthings.net";
