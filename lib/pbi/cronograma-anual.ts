import type { PeriodoOs } from "./catalog";
import { nowInSaoPaulo, parsePbiDate } from "./dates";
import { classifyPlanoEc, isTipoPredial, type PlanoEcTipo } from "./indicadores-os";
import { isTipoManutencaoMedica } from "./medical";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem, OsResumidaItem } from "./types";

export const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

export type MesCellStatus = "realizada" | "pendente" | "atrasada" | "vazia";

export type CronogramaMesCell = {
  month: number;
  status: MesCellStatus;
  planned: boolean;
  done: boolean;
};

export type CronogramaPlanRow = {
  tipo: PlanoEcTipo;
  months: CronogramaMesCell[];
  previstas: number;
  realizadas: number;
  semData: boolean;
  periodicidade: string;
  proximaRaw: string;
  ultimaRaw: string;
  observacao: string;
  items: CronogramaItem[];
};

export type CronogramaEquipRow = {
  key: string;
  tag: string;
  equipamento: string;
  setor: string;
  plans: CronogramaPlanRow[];
  previstas: number;
  realizadas: number;
};

export type CronogramaSetorGroup = {
  setor: string;
  equipamentos: CronogramaEquipRow[];
  previstas: number;
  realizadas: number;
};

export type CronogramaTipoKpi = {
  tipo: PlanoEcTipo | "Todos";
  previstas: number;
  realizadas: number;
  naoRealizadas: number;
  semData: number;
  cumprimento: number | null;
};

export type OsRealizacao = Pick<
  OsAnaliticoItem,
  | "CodigoSerialOS"
  | "OS"
  | "Tag"
  | "Equipamento"
  | "Setor"
  | "TipoDeManutencao"
  | "PlanoDeManutencao"
  | "SituacaoDaOS"
  | "Fechamento"
  | "DataDaSolucao"
  | "Abertura"
  | "Ocorrencia"
>;

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

export function yearFromGlobalFilters(from: string, to: string, fallback = nowInSaoPaulo().getFullYear()) {
  const fromYear = parsePbiDate(from)?.getFullYear();
  const toYear = parsePbiDate(to)?.getFullYear();
  if (fromYear != null) return fromYear;
  if (toYear != null) return toYear;
  return fallback;
}

export function filtersCrossYears(from: string, to: string) {
  const fromYear = parsePbiDate(from)?.getFullYear();
  const toYear = parsePbiDate(to)?.getFullYear();
  return fromYear != null && toYear != null && fromYear !== toYear;
}

export function osPeriodoForYear(year: number, today = nowInSaoPaulo()): PeriodoOs {
  const current = today.getFullYear();
  if (year === current) return "AnoAtual";
  if (year === current - 1) return "AnoAnterior";
  return "DoisAnosAtuais";
}

export function keepCronogramaPlano(tipo: string | null | undefined, somenteMedicos: boolean) {
  const plano = classifyPlanoEc(tipo);
  if (!plano) return false;
  if (!somenteMedicos) return true;
  if (isTipoPredial(tipo)) return false;
  if (plano === "Preventiva") return isTipoManutencaoMedica(tipo);
  return true;
}

/** Periodicidade da API (`Perioridicade`), em meses. Null se não for possível inferir recorrência mensal. */
export function parsePeriodicidadeMeses(raw: string | null | undefined): number | null {
  const v = normalize(raw);
  if (!v) return null;
  if (/(trimestr)/.test(v)) return 3;
  if (/(semestr)/.test(v)) return 6;
  if (/(bimestr)/.test(v)) return 2;
  if (/(anual|anua)/.test(v)) return 12;
  if (/(mensal)/.test(v)) return 1;

  const numbered = v.match(/(\d+)\s*(ano|mes|semana|dia)/);
  if (!numbered) return null;
  const n = Number(numbered[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = numbered[2];
  if (unit === "ano") return n * 12;
  if (unit === "mes") return n;
  if (unit === "semana") return n % 4 === 0 ? n / 4 : null;
  if (unit === "dia") return n >= 28 ? Math.max(1, Math.round(n / 30)) : null;
  return null;
}

export function plannedMonthsInYear(opts: {
  proxima: Date | null;
  ultima: Date | null;
  intervalMonths: number | null;
  year: number;
}): number[] {
  const { proxima, ultima, intervalMonths, year } = opts;
  const anchor = proxima ?? ultima;
  if (!anchor) return [];

  if (intervalMonths == null || intervalMonths <= 0) {
    return anchor.getFullYear() === year ? [anchor.getMonth()] : [];
  }

  const yearStart = year * 12;
  const yearEnd = year * 12 + 11;
  const anchorIdx = anchor.getFullYear() * 12 + anchor.getMonth();
  let idx = anchorIdx;
  while (idx >= yearStart) idx -= intervalMonths;
  idx += intervalMonths;

  const months: number[] = [];
  while (idx <= yearEnd) {
    months.push(idx - yearStart);
    idx += intervalMonths;
  }
  return months;
}

export function osRealizacaoDate(os: Pick<OsRealizacao, "Fechamento" | "DataDaSolucao" | "Abertura">): Date | null {
  return parsePbiDate(os.Fechamento) || parsePbiDate(os.DataDaSolucao) || parsePbiDate(os.Abertura);
}

function lookupKeys(tag?: string | null, equipamento?: string | null, setor?: string | null) {
  const keys: string[] = [];
  if (filled(tag)) keys.push(`tag:${normalize(tag)}`);
  if (filled(equipamento)) keys.push(`eq:${normalize(equipamento)}|${normalize(setor)}`);
  return keys;
}

function groupKey(item: { Tag?: string; Equipamento?: string; Setor?: string }) {
  const keys = lookupKeys(item.Tag, item.Equipamento, item.Setor);
  return keys[0] || `eq:${normalize(item.Equipamento)}|${normalize(item.Setor)}`;
}

function preferADash(items: CronogramaItem[], tipo: PlanoEcTipo) {
  const ofType = items.filter((item) => classifyPlanoEc(item.TipoDeManutencao) === tipo);
  if (tipo !== "Preventiva") return ofType;
  const aDash = ofType.filter((item) => normalize(item.TipoDeManutencao).startsWith("a -"));
  return aDash.length ? aDash : ofType;
}

function cellStatus(planned: boolean, done: boolean, month: number, year: number, today: Date): MesCellStatus {
  if (!planned) return "vazia";
  if (done) return "realizada";
  const current = today.getFullYear() === year ? today.getMonth() : today.getFullYear() > year ? 12 : -1;
  return month < current ? "atrasada" : "pendente";
}

export function buildOsMonthIndex(os: OsRealizacao[], year: number, somenteMedicos: boolean) {
  const byKeyTipo = new Map<string, Set<number>>();
  const listByKeyTipo = new Map<string, OsRealizacao[]>();

  for (const item of os) {
    if (!keepCronogramaPlano(item.TipoDeManutencao, somenteMedicos)) continue;
    const tipo = classifyPlanoEc(item.TipoDeManutencao);
    if (!tipo) continue;
    const date = osRealizacaoDate(item);
    if (!date || date.getFullYear() !== year) continue;
    const month = date.getMonth();
    for (const key of lookupKeys(item.Tag, item.Equipamento, item.Setor)) {
      const mapKey = `${key}|${tipo}`;
      const months = byKeyTipo.get(mapKey) ?? new Set<number>();
      months.add(month);
      byKeyTipo.set(mapKey, months);
      const list = listByKeyTipo.get(mapKey) ?? [];
      list.push(item);
      listByKeyTipo.set(mapKey, list);
    }
  }

  return { byKeyTipo, listByKeyTipo };
}

function osMonthsForEquip(index: ReturnType<typeof buildOsMonthIndex>, equip: CronogramaEquipRow, tipo: PlanoEcTipo) {
  const keys = lookupKeys(equip.tag, equip.equipamento, equip.setor);
  const months = new Set<number>();
  for (const key of keys) {
    const found = index.byKeyTipo.get(`${key}|${tipo}`);
    if (found) for (const month of found) months.add(month);
  }
  return months;
}

export function osForEquip(
  index: ReturnType<typeof buildOsMonthIndex>,
  tag: string,
  equipamento: string,
  setor: string,
  tipo?: PlanoEcTipo,
) {
  const keys = lookupKeys(tag, equipamento, setor);
  const tipos: PlanoEcTipo[] = tipo ? [tipo] : ["Preventiva", "Calibração", "TSE"];
  const seen = new Set<number>();
  const list: OsRealizacao[] = [];
  for (const key of keys) {
    for (const t of tipos) {
      for (const item of index.listByKeyTipo.get(`${key}|${t}`) ?? []) {
        const id = item.CodigoSerialOS ?? -1;
        if (seen.has(id)) continue;
        seen.add(id);
        list.push(item);
      }
    }
  }
  return list.sort((a, b) => {
    const da = osRealizacaoDate(a)?.getTime() ?? 0;
    const db = osRealizacaoDate(b)?.getTime() ?? 0;
    return db - da;
  });
}

function buildPlanRow(
  items: CronogramaItem[],
  tipo: PlanoEcTipo,
  year: number,
  today: Date,
  doneMonths: Set<number>,
): CronogramaPlanRow | null {
  if (!items.length) return null;
  const monthSet = new Set<number>();
  let semData = true;
  for (const item of items) {
    const proxima = parsePbiDate(item.ProximaRealizacao);
    const ultima = parsePbiDate(item.DataDaUltima);
    if (proxima || ultima) semData = false;
    const interval = parsePeriodicidadeMeses(item.Perioridicade);
    for (const month of plannedMonthsInYear({ proxima, ultima, intervalMonths: interval, year })) {
      monthSet.add(month);
    }
  }

  const months: CronogramaMesCell[] = Array.from({ length: 12 }, (_, month) => {
    const planned = monthSet.has(month);
    const done = planned && doneMonths.has(month);
    return {
      month,
      planned,
      done,
      status: cellStatus(planned, done, month, year, today),
    };
  });

  const previstas = months.filter((m) => m.planned).length;
  const realizadas = months.filter((m) => m.done).length;
  const first = items[0];

  return {
    tipo,
    months,
    previstas,
    realizadas,
    semData: semData && previstas === 0,
    periodicidade: items.map((i) => i.Perioridicade).find(filled) || first.Perioridicade || "",
    proximaRaw: items.map((i) => i.ProximaRealizacao).find((v) => parsePbiDate(v)) || first.ProximaRealizacao || "",
    ultimaRaw: items.map((i) => i.DataDaUltima).find((v) => parsePbiDate(v)) || first.DataDaUltima || "",
    observacao: items.map((i) => i.Observacao).find(filled) || first.Observacao || "",
    items,
  };
}

export function buildCronogramaAnual(opts: {
  cronograma: CronogramaItem[];
  os: OsRealizacao[];
  equipamentos: EquipamentoItem[];
  year: number;
  somenteMedicos: boolean;
  setores?: string[];
  tiposEquipamento?: string[];
  today?: Date;
}): {
  groups: CronogramaSetorGroup[];
  kpis: CronogramaTipoKpi[];
  semData: number;
} {
  const today = opts.today ?? nowInSaoPaulo();
  const osIndex = buildOsMonthIndex(opts.os, opts.year, opts.somenteMedicos);
  const eqByTag = new Map<string, EquipamentoItem>();
  for (const item of opts.equipamentos) {
    if (filled(item.Tag)) eqByTag.set(normalize(item.Tag), item);
  }

  const byEquip = new Map<string, CronogramaItem[]>();
  for (const item of opts.cronograma) {
    if (!keepCronogramaPlano(item.TipoDeManutencao, opts.somenteMedicos)) continue;
    const key = groupKey(item);
    const list = byEquip.get(key) ?? [];
    list.push(item);
    byEquip.set(key, list);
  }

  const equipamentos: CronogramaEquipRow[] = [];
  for (const [key, items] of byEquip) {
    const sample = items[0];
    const cadastro = filled(sample.Tag) ? eqByTag.get(normalize(sample.Tag)) : undefined;
    const equipamento = sample.Equipamento?.trim() || cadastro?.Equipamento?.trim() || "Sem nome";
    const setor = sample.Setor?.trim() || cadastro?.Setor?.trim() || "Sem setor";
    const tag = sample.Tag?.trim() || cadastro?.Tag?.trim() || "";

    if (opts.setores?.length && !opts.setores.some((s) => normalize(s) === normalize(setor))) continue;
    if (opts.tiposEquipamento?.length && !opts.tiposEquipamento.some((t) => normalize(t) === normalize(equipamento))) {
      continue;
    }

    const stub: CronogramaEquipRow = {
      key,
      tag,
      equipamento,
      setor,
      plans: [],
      previstas: 0,
      realizadas: 0,
    };

    const plans: CronogramaPlanRow[] = [];
    for (const tipo of ["Preventiva", "Calibração", "TSE"] as PlanoEcTipo[]) {
      const planItems = preferADash(items, tipo);
      const doneMonths = osMonthsForEquip(osIndex, stub, tipo);
      const row = buildPlanRow(planItems, tipo, opts.year, today, doneMonths);
      if (row) plans.push(row);
    }
    if (!plans.length) continue;

    stub.plans = plans;
    stub.previstas = plans.reduce((sum, p) => sum + p.previstas, 0);
    stub.realizadas = plans.reduce((sum, p) => sum + p.realizadas, 0);
    equipamentos.push(stub);
  }

  equipamentos.sort(
    (a, b) =>
      a.setor.localeCompare(b.setor, "pt-BR") ||
      a.equipamento.localeCompare(b.equipamento, "pt-BR") ||
      a.tag.localeCompare(b.tag, "pt-BR"),
  );

  const groupMap = new Map<string, CronogramaEquipRow[]>();
  for (const row of equipamentos) {
    const list = groupMap.get(row.setor) ?? [];
    list.push(row);
    groupMap.set(row.setor, list);
  }

  const groups: CronogramaSetorGroup[] = [...groupMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([setor, eqs]) => ({
      setor,
      equipamentos: eqs,
      previstas: eqs.reduce((sum, e) => sum + e.previstas, 0),
      realizadas: eqs.reduce((sum, e) => sum + e.realizadas, 0),
    }));

  const allPlans = equipamentos.flatMap((e) => e.plans);
  const byTipo = (tipo?: PlanoEcTipo) => allPlans.filter((p) => !tipo || p.tipo === tipo);
  const toKpi = (tipo: PlanoEcTipo | "Todos", plans: CronogramaPlanRow[]): CronogramaTipoKpi => {
    const previstas = plans.reduce((sum, p) => sum + p.previstas, 0);
    const realizadas = plans.reduce((sum, p) => sum + p.realizadas, 0);
    return {
      tipo,
      previstas,
      realizadas,
      naoRealizadas: Math.max(0, previstas - realizadas),
      semData: plans.filter((p) => p.semData).length,
      cumprimento: previstas ? (realizadas / previstas) * 100 : null,
    };
  };

  return {
    groups,
    kpis: [
      toKpi("Todos", allPlans),
      toKpi("Preventiva", byTipo("Preventiva")),
      toKpi("Calibração", byTipo("Calibração")),
      toKpi("TSE", byTipo("TSE")),
    ],
    semData: allPlans.filter((p) => p.semData).length,
  };
}

export function cronogramaMatrixCsvRows(groups: CronogramaSetorGroup[]) {
  const rows: Array<Record<string, unknown>> = [];
  for (const group of groups) {
    for (const equip of group.equipamentos) {
      for (const plan of equip.plans) {
        const row: Record<string, unknown> = {
          Setor: equip.setor,
          Tag: equip.tag,
          Equipamento: equip.equipamento,
          Tipo: plan.tipo,
          Periodicidade: plan.periodicidade,
          ProximaRealizacao: plan.proximaRaw,
          DataDaUltima: plan.ultimaRaw,
          Previstas: plan.previstas,
          Realizadas: plan.realizadas,
          Observacao: plan.observacao,
        };
        for (const cell of plan.months) {
          const label = MESES_ABREV[cell.month];
          row[label] =
            cell.status === "realizada"
              ? "X realizada"
              : cell.status === "atrasada"
                ? "X atrasada"
                : cell.status === "pendente"
                  ? "X pendente"
                  : "";
        }
        rows.push(row);
      }
    }
  }
  return rows;
}

export function toOsRealizacao(os: OsAnaliticoItem | OsResumidaItem): OsRealizacao {
  return {
    CodigoSerialOS: os.CodigoSerialOS,
    OS: os.OS,
    Tag: "Tag" in os ? os.Tag : "",
    Equipamento: os.Equipamento,
    Setor: os.Setor,
    TipoDeManutencao: os.TipoDeManutencao,
    PlanoDeManutencao: os.PlanoDeManutencao,
    SituacaoDaOS: os.SituacaoDaOS,
    Fechamento: os.Fechamento,
    DataDaSolucao: os.DataDaSolucao,
    Abertura: os.Abertura,
    Ocorrencia: "Ocorrencia" in os ? os.Ocorrencia : "",
  };
}
