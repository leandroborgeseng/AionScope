import { daysUntil, nowInSaoPaulo, parseBrNumber, parseDurationMinutes, parsePbiDate } from "./dates";
import { isCorretiva, isPreventiva } from "./filters";
import type {
  AnexoEquipamentoItem,
  AnexoOsItem,
  CronogramaItem,
  CronogramaStatus,
  CronogramaView,
  DisponibilidadeItem,
  EquipamentoItem,
  MonitorAtendimentoItem,
  MonitorReacaoItem,
  OsAnaliticoItem,
  TmefItem,
} from "./types";

function filled(value: string | null | undefined) {
  const v = (value ?? "").trim().toLocaleUpperCase("pt-BR");
  return Boolean(v) && v !== "NÃO INFORMADO" && v !== "NAO INFORMADO" && v !== "N/A" && v !== "-";
}

export function cronogramaStatus(item: CronogramaItem): CronogramaView {
  const proxima = parsePbiDate(item.ProximaRealizacao);
  if (!proxima) {
    return {
      ...item,
      proximaDate: null,
      diasParaVencer: null,
      statusCalculado: "sem_data",
      statusLabel: "Sem data válida",
    };
  }
  const dias = daysUntil(proxima);
  let statusCalculado: CronogramaStatus = "em_dia";
  let statusLabel = "Em dia";
  if (dias < 0) {
    statusCalculado = "atrasado";
    statusLabel = `Atrasado ${Math.abs(dias)} dia(s)`;
  } else if (dias <= 15) {
    statusCalculado = "vence_em";
    statusLabel = `Vence em ${dias} dia(s)`;
  }
  return {
    ...item,
    proximaDate: proxima.toISOString(),
    diasParaVencer: dias,
    statusCalculado,
    statusLabel,
  };
}

export function pct(part: number, total: number): number | null {
  if (!total) return null;
  return (part / total) * 100;
}

export function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function formatPct(value: number | null, digits = 1) {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null, digits = 1) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatBRL(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function disponibilidadeMedia(items: DisponibilidadeItem[]) {
  return avg(items.map((i) => i.DisponibilidadePercentualPeriodo));
}

export function mtbfMedio(disp: DisponibilidadeItem[], tmef: TmefItem[]) {
  const fromDisp = avg(disp.map((i) => (typeof i.TMEF === "number" ? i.TMEF : null)));
  if (fromDisp != null) return fromDisp;
  return avg(tmef.map((i) => parseBrNumber(i.MTBF)));
}

export function mttrMedio(disp: DisponibilidadeItem[]) {
  return avg(disp.map((i) => (typeof i.TMPR === "number" ? i.TMPR : null)));
}

export function preventivasEmDia(items: CronogramaView[]) {
  const dated = items.filter((i) => i.statusCalculado !== "sem_data");
  return {
    value: pct(dated.filter((i) => i.statusCalculado !== "atrasado").length, dated.length),
    total: dated.length,
    atrasados: dated.filter((i) => i.statusCalculado === "atrasado"),
  };
}

export function mixCorretivaPreventiva(os: OsAnaliticoItem[]) {
  const preventiva = os.filter((i) => isPreventiva(i.TipoDeManutencao)).length;
  const corretiva = os.filter((i) => isCorretiva(i.TipoDeManutencao)).length;
  const outros = os.length - preventiva - corretiva;
  return {
    preventiva,
    corretiva,
    outros,
    pctPreventiva: pct(preventiva, os.length),
    pctCorretiva: pct(corretiva, os.length),
  };
}

export function slaAtendimento(os: OsAnaliticoItem[]) {
  const eligible = os.filter((i) => parsePbiDate(i.DataDoAtendimento) && parsePbiDate(i.DataLimiteDoAtendimento));
  const ok = eligible.filter((i) => {
    const done = parsePbiDate(i.DataDoAtendimento)!;
    const limit = parsePbiDate(i.DataLimiteDoAtendimento)!;
    return done.getTime() <= limit.getTime();
  });
  return { value: pct(ok.length, eligible.length), total: eligible.length, ok, late: eligible.filter((i) => !ok.includes(i)) };
}

export function slaSolucao(os: OsAnaliticoItem[]) {
  const eligible = os.filter((i) => parsePbiDate(i.DataDaSolucao) && parsePbiDate(i.DataLimiteDaSolucao));
  const ok = eligible.filter((i) => {
    const done = parsePbiDate(i.DataDaSolucao)!;
    const limit = parsePbiDate(i.DataLimiteDaSolucao)!;
    return done.getTime() <= limit.getTime();
  });
  return { value: pct(ok.length, eligible.length), total: eligible.length, ok, late: eligible.filter((i) => !ok.includes(i)) };
}

export function liberadoParaUso(os: OsAnaliticoItem[]) {
  const closed = os.filter((i) => filled(i.Fechamento) || i.SituacaoDaOS?.toLocaleLowerCase("pt-BR") === "fechada");
  const withFlag = closed.filter((i) => filled(i.LiberadoParaUso));
  const missing = closed.filter((i) => !filled(i.LiberadoParaUso));
  return { value: pct(withFlag.length, closed.length), total: closed.length, missing };
}

export function monitorPrazo<T extends { TempoDecorrido: string; PrazoParaAtendimento: string }>(items: T[]) {
  const withPrazo = items.filter((i) => parseDurationMinutes(i.PrazoParaAtendimento) != null);
  const dentro = withPrazo.filter((i) => {
    const elapsed = parseDurationMinutes(i.TempoDecorrido) ?? Number.POSITIVE_INFINITY;
    const prazo = parseDurationMinutes(i.PrazoParaAtendimento) ?? 0;
    return elapsed <= prazo;
  });
  return {
    value: pct(dentro.length, withPrazo.length),
    total: withPrazo.length,
    dentro,
    estourado: withPrazo.filter((i) => !dentro.includes(i)),
    semPrazo: items.filter((i) => parseDurationMinutes(i.PrazoParaAtendimento) == null),
  };
}

export function pareto(values: Array<string | null | undefined>, top = 10) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = (value ?? "").trim() || "Não informado";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

export function anvisaValido(items: EquipamentoItem[]) {
  const today = nowInSaoPaulo();
  const withDate = items.filter((i) => parsePbiDate(i.ValidadeDoRegistroAnvisa));
  const valid = withDate.filter((i) => parsePbiDate(i.ValidadeDoRegistroAnvisa)! >= today);
  return { value: pct(valid.length, items.length), withDate: withDate.length, valid: valid.length, total: items.length };
}

export function alemFimDeVida(items: EquipamentoItem[]) {
  const today = nowInSaoPaulo();
  const list = items.filter((i) => {
    const eol = parsePbiDate(i.EndOfLife);
    const ativo = (i.Status ?? "").toLocaleUpperCase("pt-BR") === "ATIVO";
    return Boolean(eol && eol < today && ativo);
  });
  return { value: pct(list.length, items.length), list, total: items.length };
}

export function anexoObrigatorioKeywords() {
  return (process.env.NEXT_PUBLIC_ANEXOS_OBRIGATORIOS ?? "laudo,calibra,certificado,segurança elétrica,tse")
    .split(",")
    .map((s) => s.trim().toLocaleLowerCase("pt-BR"))
    .filter(Boolean);
}

export function isAnexoObrigatorio(item: Pick<AnexoEquipamentoItem, "Anexo" | "TipoAnexo">) {
  const hay = `${item.TipoAnexo ?? ""} ${item.Anexo ?? ""}`.toLocaleLowerCase("pt-BR");
  return anexoObrigatorioKeywords().some((k) => hay.includes(k));
}

export function equipamentosComAnexo(equipamentos: EquipamentoItem[], anexos: AnexoEquipamentoItem[]) {
  const tags = new Set(anexos.map((a) => a.Tag).filter(Boolean));
  const ids = new Set(anexos.map((a) => a.EquipamentoId));
  const withAny = equipamentos.filter((e) => tags.has(e.Tag) || ids.has(e.Id));
  const obrigatorios = anexos.filter(isAnexoObrigatorio);
  const obrTags = new Set(obrigatorios.map((a) => a.Tag));
  const obrIds = new Set(obrigatorios.map((a) => a.EquipamentoId));
  const withObr = equipamentos.filter((e) => obrTags.has(e.Tag) || obrIds.has(e.Id));
  return {
    comAnexo: pct(withAny.length, equipamentos.length),
    comObrigatorio: pct(withObr.length, equipamentos.length),
    withAny,
    withObr,
    total: equipamentos.length,
  };
}

export function osComEvidencia(os: Array<{ OS?: string; CodigoSerialOS?: number }>, anexos: AnexoOsItem[]) {
  const codes = new Set(anexos.map((a) => a.CodigoOS));
  const ids = new Set(anexos.map((a) => a.OSId));
  const withAnexo = os.filter((o) => codes.has(o.OS ?? "") || ids.has(o.CodigoSerialOS ?? -1));
  return { value: pct(withAnexo.length, os.length), withAnexo, total: os.length };
}

export function monthlyTrend(items: DisponibilidadeItem[]) {
  const map = new Map<string, { disp: number[]; tmef: number[]; tmpr: number[] }>();
  for (const item of items) {
    for (const m of item.DisponibilidadeMensal ?? []) {
      const key = `${m.Ano}-${String(m.Mes).padStart(2, "0")}`;
      const bucket = map.get(key) ?? { disp: [], tmef: [], tmpr: [] };
      bucket.disp.push(m.DisponibilidadePercentual);
      bucket.tmef.push(m.TMEF);
      bucket.tmpr.push(m.TMPR);
      map.set(key, bucket);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, bucket]) => ({
      mes,
      disponibilidade: avg(bucket.disp) ?? 0,
      tmef: avg(bucket.tmef) ?? 0,
      tmpr: avg(bucket.tmpr) ?? 0,
    }));
}

export function slaMonthly(os: OsAnaliticoItem[]) {
  const map = new Map<string, { atendOk: number; atend: number; solOk: number; sol: number }>();
  for (const item of os) {
    const abertura = parsePbiDate(item.Abertura);
    if (!abertura) continue;
    const key = `${abertura.getFullYear()}-${String(abertura.getMonth() + 1).padStart(2, "0")}`;
    const bucket = map.get(key) ?? { atendOk: 0, atend: 0, solOk: 0, sol: 0 };
    const atend = parsePbiDate(item.DataDoAtendimento);
    const atendLim = parsePbiDate(item.DataLimiteDoAtendimento);
    if (atend && atendLim) {
      bucket.atend += 1;
      if (atend.getTime() <= atendLim.getTime()) bucket.atendOk += 1;
    }
    const sol = parsePbiDate(item.DataDaSolucao);
    const solLim = parsePbiDate(item.DataLimiteDaSolucao);
    if (sol && solLim) {
      bucket.sol += 1;
      if (sol.getTime() <= solLim.getTime()) bucket.solOk += 1;
    }
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, b]) => ({
      mes,
      slaAtendimento: b.atend ? (b.atendOk / b.atend) * 100 : 0,
      slaSolucao: b.sol ? (b.solOk / b.sol) * 100 : 0,
    }));
}

export type MonitorItem = MonitorReacaoItem | MonitorAtendimentoItem;
