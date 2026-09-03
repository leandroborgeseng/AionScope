import { addHours, differenceInMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { inList } from "./filters";
import { formatPct, pct } from "./indicators";
import { parsePbiDate } from "./dates";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "./types";

export const CRITICIDADE_GRUPOS = ["Alta", "Média", "Baixa", "Sem criticidade"] as const;
export type CriticidadeGrupo = (typeof CRITICIDADE_GRUPOS)[number];

export const TEMPO_FAIXAS = ["0–2h", "2–4h", "4–12h", "12–72h", ">72h"] as const;
export type TempoFaixa = (typeof TEMPO_FAIXAS)[number];

export type TempoClassificacao =
  | "Dentro do prazo"
  | "Fora do prazo"
  | TempoFaixa
  | "Sem atendimento registrado";

export const PLANO_EC_TIPOS = ["Preventiva", "Calibração", "TSE"] as const;
export type PlanoEcTipo = (typeof PLANO_EC_TIPOS)[number];
export type PlanoEcTab = "Todos" | PlanoEcTipo;

export type EquipamentoIndex = {
  byTag: Map<string, EquipamentoItem>;
  byNomeSetor: Map<string, EquipamentoItem>;
};

export type OsCriticidadeRow = OsAnaliticoItem & {
  criticidade: CriticidadeGrupo;
  criticidadeRaw: string;
};

export type OsTempoRow = OsAnaliticoItem & {
  classificacao: TempoClassificacao;
  horasAteAtendimento: number | null;
  limiteOrigem: "DataLimite" | "Prioridade" | "—";
  noPrazo: boolean | null;
};

export type PlanoEcRow = {
  id: string;
  tipoPlano: PlanoEcTipo;
  tag: string;
  equipamento: string;
  setor: string;
  plano: string;
  tipoManutencao: string;
  periodicidade: string;
  proximaRaw: string;
  mesPlanejado: string;
  plannedDate: Date | null;
  situacaoOs: string;
  dataRealizacao: string;
  realizacaoDate: Date | null;
  noMes: "Sim" | "Não" | "—";
  aberta: boolean;
  realizadaNoMes: boolean;
  realizadaForaMes: boolean;
  semDataPlanejada: boolean;
  cronograma?: CronogramaItem;
  os?: OsAnaliticoItem;
};

function filled(value: string | null | undefined) {
  const v = (value ?? "").trim().toLocaleUpperCase("pt-BR");
  return Boolean(v) && v !== "NÃO INFORMADO" && v !== "NAO INFORMADO" && v !== "N/A" && v !== "-";
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function osTemEquipamento(os: Pick<OsAnaliticoItem, "Tag" | "Equipamento">) {
  return filled(os.Tag) || filled(os.Equipamento);
}

export function buildEquipamentoIndex(items: EquipamentoItem[]): EquipamentoIndex {
  const byTag = new Map<string, EquipamentoItem>();
  const byNomeSetor = new Map<string, EquipamentoItem>();
  for (const item of items) {
    if (filled(item.Tag)) byTag.set(normalize(item.Tag), item);
    if (filled(item.Equipamento)) {
      byNomeSetor.set(`${normalize(item.Equipamento)}|${normalize(item.Setor)}`, item);
    }
  }
  return { byTag, byNomeSetor };
}

export function findEquipamento(
  index: EquipamentoIndex,
  tag?: string | null,
  equipamento?: string | null,
  setor?: string | null,
) {
  if (filled(tag)) {
    const byTag = index.byTag.get(normalize(tag));
    if (byTag) return byTag;
  }
  if (filled(equipamento)) {
    return index.byNomeSetor.get(`${normalize(equipamento)}|${normalize(setor)}`);
  }
  return undefined;
}

export function grupoCriticidade(raw: string | null | undefined): CriticidadeGrupo {
  const v = normalize(raw);
  if (!v) return "Sem criticidade";
  if (v.startsWith("alta")) return "Alta";
  if (v.startsWith("media")) return "Média";
  if (v.startsWith("baixa")) return "Baixa";
  return "Sem criticidade";
}

export function resolveCriticidade(os: OsAnaliticoItem, index: EquipamentoIndex) {
  const eq = findEquipamento(index, os.Tag, os.Equipamento, os.Setor);
  const criticidadeRaw = eq?.Criticidade?.trim() ?? "";
  return {
    criticidade: grupoCriticidade(criticidadeRaw),
    criticidadeRaw: criticidadeRaw || "Sem criticidade",
    equipamentoCadastro: eq,
  };
}

export function matchesCriticidadeFiltro(raw: string, selected: string[]) {
  if (!selected.length) return true;
  return inList(raw, selected) || selected.some((item) => grupoCriticidade(item) === grupoCriticidade(raw) && grupoCriticidade(raw) !== "Sem criticidade");
}

export function classifyOsCriticidade(os: OsAnaliticoItem[], index: EquipamentoIndex, criticidades: string[] = []): OsCriticidadeRow[] {
  return os
    .filter(osTemEquipamento)
    .map((item) => {
      const resolved = resolveCriticidade(item, index);
      return { ...item, criticidade: resolved.criticidade, criticidadeRaw: resolved.criticidadeRaw };
    })
    .filter((row) => matchesCriticidadeFiltro(row.criticidadeRaw, criticidades));
}

export function summarizeCriticidade(rows: OsCriticidadeRow[]) {
  const counts = Object.fromEntries(CRITICIDADE_GRUPOS.map((g) => [g, 0])) as Record<CriticidadeGrupo, number>;
  for (const row of rows) counts[row.criticidade] += 1;
  const total = rows.length;
  return CRITICIDADE_GRUPOS.map((grupo) => ({
    grupo,
    count: counts[grupo],
    pct: pct(counts[grupo], total),
    pctLabel: formatPct(pct(counts[grupo], total)),
  }));
}

export function extractPrazoHoras(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const match = value.match(/(\d+)\s*H/i);
  if (match) return Number(match[1]);
  const v = normalize(value);
  if (/\bbaixa\b/.test(v)) return 72;
  if (/\bmedia\b/.test(v)) return 12;
  if (/\balta\b/.test(v)) return 2;
  return null;
}

function faixaDeHoras(hours: number): TempoFaixa {
  if (hours <= 2) return "0–2h";
  if (hours <= 4) return "2–4h";
  if (hours <= 12) return "4–12h";
  if (hours <= 72) return "12–72h";
  return ">72h";
}

export function classifyOsTempo(os: OsAnaliticoItem[], index: EquipamentoIndex, criticidades: string[] = []): OsTempoRow[] {
  return os
    .filter(osTemEquipamento)
    .filter((item) => matchesCriticidadeFiltro(resolveCriticidade(item, index).criticidadeRaw, criticidades))
    .map((item) => {
      const atendimento = parsePbiDate(item.DataDoAtendimento);
      const abertura = parsePbiDate(item.Abertura);
      const limiteApi = parsePbiDate(item.DataLimiteDoAtendimento);
      const prazoHoras = extractPrazoHoras(item.Prioridade);
      const limiteFallback = !limiteApi && abertura && prazoHoras != null ? addHours(abertura, prazoHoras) : null;
      const limite = limiteApi ?? limiteFallback;
      const limiteOrigem: OsTempoRow["limiteOrigem"] = limiteApi ? "DataLimite" : limiteFallback ? "Prioridade" : "—";
      const horasAteAtendimento =
        atendimento && abertura ? Math.max(0, differenceInMinutes(atendimento, abertura) / 60) : null;

      if (atendimento && limite) {
        const noPrazo = atendimento.getTime() <= limite.getTime();
        return {
          ...item,
          classificacao: noPrazo ? "Dentro do prazo" : "Fora do prazo",
          horasAteAtendimento,
          limiteOrigem,
          noPrazo,
        };
      }

      if (atendimento && abertura && horasAteAtendimento != null) {
        return {
          ...item,
          classificacao: faixaDeHoras(horasAteAtendimento),
          horasAteAtendimento,
          limiteOrigem,
          noPrazo: null,
        };
      }

      return {
        ...item,
        classificacao: "Sem atendimento registrado",
        horasAteAtendimento,
        limiteOrigem,
        noPrazo: null,
      };
    });
}

export function summarizeTempo(rows: OsTempoRow[]) {
  const dentro = rows.filter((r) => r.classificacao === "Dentro do prazo").length;
  const fora = rows.filter((r) => r.classificacao === "Fora do prazo").length;
  const semAtendimento = rows.filter((r) => r.classificacao === "Sem atendimento registrado").length;
  const faixas = TEMPO_FAIXAS.map((faixa) => ({
    name: faixa,
    count: rows.filter((r) => r.classificacao === faixa).length,
  }));
  const comPrazo = dentro + fora;
  return {
    dentro,
    fora,
    semAtendimento,
    comPrazo,
    pctNoPrazo: pct(dentro, comPrazo),
    faixas,
    chart: [
      { name: "Dentro do prazo", count: dentro },
      { name: "Fora do prazo", count: fora },
      ...faixas,
      { name: "Sem atendimento", count: semAtendimento },
    ].filter((d) => d.count > 0),
  };
}

export function formatHorasAtendimento(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const safe = Math.max(0, hours);
  const h = Math.floor(safe);
  const m = Math.round((safe - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function isTipoPredial(tipo: string | null | undefined) {
  const v = normalize(tipo);
  return v.startsWith("m -") || v.startsWith("o -");
}

export function classifyPlanoEc(tipo: string | null | undefined): PlanoEcTipo | null {
  const v = normalize(tipo);
  if (!v) return null;
  if (v.includes("seguranca eletrica") || v.includes("tse")) return "TSE";
  if (v.includes("calibra")) return "Calibração";
  if (v.includes("prevent")) return "Preventiva";
  return null;
}

function keepPlanoEc(tipo: string | null | undefined, somenteMedicos: boolean) {
  const plano = classifyPlanoEc(tipo);
  if (!plano) return false;
  if (somenteMedicos && isTipoPredial(tipo)) return false;
  return true;
}

function isOsAberta(situacao: string | null | undefined) {
  const v = normalize(situacao);
  return v.includes("aberta") || v.includes("pendente") || v.includes("em andamento") || v.includes("aguard");
}

function isOsFechada(os: OsAnaliticoItem) {
  const v = normalize(os.SituacaoDaOS);
  return v.includes("fechada") || v.includes("encerrada") || v.includes("conclu") || filled(os.Fechamento);
}

function realizacaoOs(os: OsAnaliticoItem) {
  return parsePbiDate(os.Fechamento) || parsePbiDate(os.DataDaSolucao);
}

function sameYearMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatMesPlanejado(date: Date | null, raw: string) {
  if (date) return format(date, "MMM/yyyy", { locale: ptBR });
  return filled(raw) ? raw : "—";
}

function osLookupKey(tag?: string | null, equipamento?: string | null, setor?: string | null) {
  if (filled(tag)) return `tag:${normalize(tag)}`;
  if (filled(equipamento)) return `eq:${normalize(equipamento)}|${normalize(setor)}`;
  return "";
}

function planoParecido(a: string | null | undefined, b: string | null | undefined) {
  if (!filled(a) || !filled(b)) return false;
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function scoreOsMatch(os: OsAnaliticoItem, planned: Date | null, plano: string) {
  let score = 0;
  if (planoParecido(os.PlanoDeManutencao, plano)) score += 40;
  const realizacao = realizacaoOs(os);
  if (planned && realizacao && sameYearMonth(realizacao, planned)) score += 80;
  else if (isOsAberta(os.SituacaoDaOS) && !isOsFechada(os)) score += 50;
  else if (realizacao && planned) {
    const diff = Math.abs(realizacao.getFullYear() * 12 + realizacao.getMonth() - (planned.getFullYear() * 12 + planned.getMonth()));
    score += Math.max(0, 30 - diff);
  } else if (isOsFechada(os)) score += 15;
  return score;
}

function buildRowFromParts(opts: {
  id: string;
  tipoPlano: PlanoEcTipo;
  cronograma?: CronogramaItem;
  os?: OsAnaliticoItem;
}): PlanoEcRow {
  const { id, tipoPlano, cronograma, os } = opts;
  const plannedDate = parsePbiDate(cronograma?.ProximaRealizacao);
  const realizacaoDate = os ? realizacaoOs(os) : null;
  const fechada = os ? isOsFechada(os) : false;
  const abertaOs = os ? isOsAberta(os.SituacaoDaOS) && !fechada : false;
  const semDataPlanejada = !plannedDate;
  const realizadaNoMes = Boolean(plannedDate && realizacaoDate && sameYearMonth(realizacaoDate, plannedDate));
  const realizadaForaMes = Boolean(plannedDate && realizacaoDate && !sameYearMonth(realizacaoDate, plannedDate));
  const aberta = !fechada && (abertaOs || !os || !realizacaoDate);

  let noMes: PlanoEcRow["noMes"] = "—";
  if (plannedDate && realizacaoDate) noMes = realizadaNoMes ? "Sim" : "Não";

  return {
    id,
    tipoPlano,
    tag: cronograma?.Tag || os?.Tag || "",
    equipamento: cronograma?.Equipamento || os?.Equipamento || "",
    setor: cronograma?.Setor || os?.Setor || "",
    plano: cronograma?.PlanoDeManutencao || os?.PlanoDeManutencao || "",
    tipoManutencao: cronograma?.TipoDeManutencao || os?.TipoDeManutencao || "",
    periodicidade: cronograma?.Perioridicade || "",
    proximaRaw: cronograma?.ProximaRealizacao || "",
    mesPlanejado: formatMesPlanejado(plannedDate, cronograma?.ProximaRealizacao ?? ""),
    plannedDate,
    situacaoOs: os?.SituacaoDaOS || (os ? "—" : "Sem OS no período"),
    dataRealizacao: os?.Fechamento || os?.DataDaSolucao || "",
    realizacaoDate,
    noMes,
    aberta,
    realizadaNoMes,
    realizadaForaMes,
    semDataPlanejada,
    cronograma,
    os,
  };
}

export function buildPlanoEcRows(
  cronograma: CronogramaItem[],
  os: OsAnaliticoItem[],
  somenteMedicos: boolean,
): PlanoEcRow[] {
  const planos = cronograma.filter((item) => keepPlanoEc(item.TipoDeManutencao, somenteMedicos));
  const osPlanos = os.filter((item) => keepPlanoEc(item.TipoDeManutencao, somenteMedicos));

  const osByKey = new Map<string, OsAnaliticoItem[]>();
  for (const item of osPlanos) {
    const tipo = classifyPlanoEc(item.TipoDeManutencao);
    const lookup = osLookupKey(item.Tag, item.Equipamento, item.Setor);
    if (!tipo || !lookup) continue;
    const key = `${tipo}|${lookup}`;
    const list = osByKey.get(key) ?? [];
    list.push(item);
    osByKey.set(key, list);
  }

  const used = new Set<number>();
  const rows: PlanoEcRow[] = [];

  for (const item of planos) {
    const tipoPlano = classifyPlanoEc(item.TipoDeManutencao);
    if (!tipoPlano) continue;
    const key = `${tipoPlano}|${osLookupKey(item.Tag, item.Equipamento, item.Setor)}`;
    const candidates = (osByKey.get(key) ?? []).filter((o) => !used.has(o.CodigoSerialOS));
    const planned = parsePbiDate(item.ProximaRealizacao);
    const matched = [...candidates].sort(
      (a, b) => scoreOsMatch(b, planned, item.PlanoDeManutencao) - scoreOsMatch(a, planned, item.PlanoDeManutencao),
    )[0];
    if (matched) used.add(matched.CodigoSerialOS);
    rows.push(
      buildRowFromParts({
        id: `cronograma-${item.Tag}-${item.PlanoDeManutencao}-${item.TipoDeManutencao}-${item.ProximaRealizacao}-${item.Equipamento}`,
        tipoPlano,
        cronograma: item,
        os: matched,
      }),
    );
  }

  for (const item of osPlanos) {
    if (used.has(item.CodigoSerialOS)) continue;
    const tipoPlano = classifyPlanoEc(item.TipoDeManutencao);
    if (!tipoPlano) continue;
    rows.push(
      buildRowFromParts({
        id: `os-${item.CodigoSerialOS}`,
        tipoPlano,
        os: item,
      }),
    );
  }

  return rows;
}

export function summarizePlanoEc(rows: PlanoEcRow[]) {
  const abertas = rows.filter((r) => r.aberta).length;
  const noMes = rows.filter((r) => r.realizadaNoMes).length;
  const foraMes = rows.filter((r) => r.realizadaForaMes).length;
  const semData = rows.filter((r) => r.semDataPlanejada).length;
  const porTipo = PLANO_EC_TIPOS.map((tipo) => ({
    name: tipo,
    count: rows.filter((r) => r.tipoPlano === tipo).length,
  }));
  return { abertas, noMes, foraMes, semData, porTipo, total: rows.length };
}

export function filterPlanoEcRows(rows: PlanoEcRow[], tab: PlanoEcTab, kpi?: "abertas" | "noMes" | "foraMes" | "semData" | null) {
  return rows.filter((row) => {
    if (tab !== "Todos" && row.tipoPlano !== tab) return false;
    if (kpi === "abertas") return row.aberta;
    if (kpi === "noMes") return row.realizadaNoMes;
    if (kpi === "foraMes") return row.realizadaForaMes;
    if (kpi === "semData") return row.semDataPlanejada;
    return true;
  });
}
