import { addHours } from "date-fns";
import {
  MESES_ABREV,
  buildCronogramaAnual,
  buildOsMonthIndex,
  osForEquip,
  type CronogramaSetorGroup,
} from "./cronograma-anual";
import { parseBrNumber, parsePbiDate } from "./dates";
import { extractPrazoHoras } from "./indicadores-os";
import { pct } from "./indicators";
import { isOficinaEngenhariaClinica } from "./oficina-ec";
import type { CronogramaItem, EquipamentoItem, OsAnaliticoItem } from "./types";

export { isOficinaEngenhariaClinica } from "./oficina-ec";

function filled(value: string | null | undefined) {
  const v = (value ?? "").trim().toLocaleUpperCase("pt-BR");
  return Boolean(v) && v !== "NÃO INFORMADO" && v !== "NAO INFORMADO" && v !== "N/A" && v !== "-";
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function dateInFilter(date: Date | null | undefined, from: string, to: string) {
  if (!date) return false;
  const start = parsePbiDate(from);
  const end = parsePbiDate(to);
  if (!start || !end) return true;
  return date.getTime() >= start.getTime() && date.getTime() <= endOfDay(end).getTime();
}

export function osExecucaoDate(os: Pick<OsAnaliticoItem, "Fechamento" | "DataDaSolucao">) {
  return parsePbiDate(os.Fechamento) || parsePbiDate(os.DataDaSolucao);
}

export function osCustoDate(os: Pick<OsAnaliticoItem, "Fechamento" | "Abertura">) {
  return parsePbiDate(os.Fechamento) || parsePbiDate(os.Abertura);
}

export function osNoPeriodo(os: OsAnaliticoItem[], from: string, to: string) {
  return os.filter(
    (item) =>
      dateInFilter(parsePbiDate(item.Abertura), from, to) ||
      dateInFilter(parsePbiDate(item.Fechamento), from, to),
  );
}

export type PlanejadoMes = {
  month: number;
  label: string;
  previstas: number;
  executadas: number;
};

export type PlanejadoDrillRow = {
  tag: string;
  equipamento: string;
  setor: string;
  tipo: string;
  plano: string;
  periodicidade: string;
  proxima: string;
  status: "Executado" | "Pendente";
  os: string;
};

export function buildPlanejadoExecutado(opts: {
  cronograma: CronogramaItem[];
  os: OsAnaliticoItem[];
  equipamentos: EquipamentoItem[];
  year: number;
  somenteMedicos: boolean;
}) {
  const osExec = opts.os.filter((item) => osExecucaoDate(item));
  const { groups, kpis, semData } = buildCronogramaAnual({
    cronograma: opts.cronograma,
    os: osExec,
    equipamentos: opts.equipamentos,
    year: opts.year,
    somenteMedicos: opts.somenteMedicos,
  });

  const months: PlanejadoMes[] = Array.from({ length: 12 }, (_, month) => {
    let previstas = 0;
    let executadas = 0;
    for (const group of groups) {
      for (const equip of group.equipamentos) {
        for (const plan of equip.plans) {
          const cell = plan.months[month];
          if (cell?.planned) previstas += 1;
          if (cell?.done) executadas += 1;
        }
      }
    }
    return { month, label: MESES_ABREV[month], previstas, executadas };
  });

  const totais = kpis[0];
  return {
    groups,
    months,
    previstas: totais?.previstas ?? 0,
    executadas: totais?.realizadas ?? 0,
    cumprimento: totais?.cumprimento ?? null,
    semData,
  };
}

export function planejadoDrillDoMes(
  groups: CronogramaSetorGroup[],
  os: OsAnaliticoItem[],
  year: number,
  somenteMedicos: boolean,
  month: number,
): PlanejadoDrillRow[] {
  const osExec = os.filter((item) => osExecucaoDate(item));
  const index = buildOsMonthIndex(osExec, year, somenteMedicos);
  const rows: PlanejadoDrillRow[] = [];

  for (const group of groups) {
    for (const equip of group.equipamentos) {
      for (const plan of equip.plans) {
        const cell = plan.months[month];
        if (!cell?.planned) continue;
        const matched = osForEquip(index, equip.tag, equip.equipamento, equip.setor, plan.tipo).filter((item) => {
          const date = osExecucaoDate(item);
          return date?.getFullYear() === year && date.getMonth() === month;
        });
        rows.push({
          tag: equip.tag,
          equipamento: equip.equipamento,
          setor: equip.setor,
          tipo: plan.tipo,
          plano: plan.items.map((item) => item.PlanoDeManutencao).find(filled) || plan.tipo,
          periodicidade: plan.periodicidade,
          proxima: plan.proximaRaw,
          status: cell.done ? "Executado" : "Pendente",
          os: matched.map((item) => item.OS).filter(Boolean).join(", ") || "—",
        });
      }
    }
  }
  return rows;
}

export type CustoMes = {
  month: number;
  label: string;
  gasto: number;
  pct: number;
};

export type CustoOsRow = OsAnaliticoItem & {
  custoNum: number;
  dataCusto: Date;
};

export function buildCustoParque(opts: {
  os: OsAnaliticoItem[];
  equipamentos: EquipamentoItem[];
  from: string;
  to: string;
  year: number;
}) {
  const parkTags = new Set(opts.equipamentos.map((item) => item.Tag).filter(filled));
  const valores = opts.equipamentos.map((item) => parseBrNumber(item.ValorDeAquisicao));
  const valorParque = valores.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const comValor = valores.filter((value) => value != null && value > 0).length;

  const osRows: CustoOsRow[] = [];
  for (const item of opts.os) {
    if (!filled(item.Tag) || !parkTags.has(item.Tag)) continue;
    const dataCusto = osCustoDate(item);
    if (!dataCusto || dataCusto.getFullYear() !== opts.year) continue;
    osRows.push({
      ...item,
      custoNum: parseBrNumber(item.Custo) ?? 0,
      dataCusto,
    });
  }

  const months: CustoMes[] = Array.from({ length: 12 }, (_, month) => {
    const gasto = osRows
      .filter((item) => item.dataCusto.getMonth() === month)
      .reduce((sum, item) => sum + item.custoNum, 0);
    return {
      month,
      label: MESES_ABREV[month],
      gasto,
      pct: valorParque ? (gasto / valorParque) * 100 : 0,
    };
  });

  const periodoRows = osRows.filter((item) => dateInFilter(item.dataCusto, opts.from, opts.to));
  const gastoPeriodo = periodoRows.reduce((sum, item) => sum + item.custoNum, 0);
  const semCusto = periodoRows.filter((item) => item.custoNum === 0).length;

  return {
    valorParque,
    comValor,
    totalEquip: opts.equipamentos.length,
    months,
    gastoPeriodo,
    pctPeriodo: pct(gastoPeriodo, valorParque),
    periodoRows,
    anoRows: osRows,
    semCusto,
    osAno: osRows.length,
  };
}

export type AtendimentoClassificacao = "No prazo" | "Fora" | "Sem atendimento" | "Sem limite";

export type AtendimentoRow = OsAnaliticoItem & {
  classificacao: AtendimentoClassificacao;
  limiteOrigem: "DataLimite" | "Prioridade" | "—";
  limiteUsado: Date | null;
  noPrazo: boolean | null;
};

export function classifyAtendimentoPrazo(os: OsAnaliticoItem[]): AtendimentoRow[] {
  return os
    .filter((item) => filled(item.Tag))
    .map((item) => {
      const atendimento = parsePbiDate(item.DataDoAtendimento);
      const abertura = parsePbiDate(item.Abertura);
      const limiteApi = parsePbiDate(item.DataLimiteDoAtendimento);
      const prazoHoras = extractPrazoHoras(item.Prioridade);
      const limiteFallback = !limiteApi && abertura && prazoHoras != null ? addHours(abertura, prazoHoras) : null;
      const limite = limiteApi ?? limiteFallback;
      const limiteOrigem: AtendimentoRow["limiteOrigem"] = limiteApi
        ? "DataLimite"
        : limiteFallback
          ? "Prioridade"
          : "—";

      if (!atendimento) {
        return { ...item, classificacao: "Sem atendimento", limiteOrigem, limiteUsado: limite, noPrazo: null };
      }
      if (!limite) {
        return { ...item, classificacao: "Sem limite", limiteOrigem, limiteUsado: null, noPrazo: null };
      }
      const noPrazo = atendimento.getTime() <= limite.getTime();
      return {
        ...item,
        classificacao: noPrazo ? "No prazo" : "Fora",
        limiteOrigem,
        limiteUsado: limite,
        noPrazo,
      };
    });
}

export function summarizeAtendimento(rows: AtendimentoRow[]) {
  const noPrazo = rows.filter((row) => row.classificacao === "No prazo").length;
  const fora = rows.filter((row) => row.classificacao === "Fora").length;
  const semAtendimento = rows.filter((row) => row.classificacao === "Sem atendimento").length;
  const semLimite = rows.filter((row) => row.classificacao === "Sem limite").length;
  const comPrazo = noPrazo + fora;
  return {
    noPrazo,
    fora,
    semAtendimento,
    semLimite,
    comPrazo,
    total: rows.length,
    pctNoPrazo: pct(noPrazo, comPrazo),
    pie: [
      { name: "No prazo", value: noPrazo },
      { name: "Fora", value: fora },
      { name: "Sem atendimento", value: semAtendimento },
    ].filter((item) => item.value > 0),
  };
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function isTipoManutencaoOficinaEc(tipo: string | null | undefined) {
  const v = normalize(tipo);
  if (!v) return false;
  if (v.startsWith("m -") || v.startsWith("o -")) return false;
  if (v.includes("obras") || v.includes("tapecaria") || v.includes("hotelaria") || v.includes("refrigeracao")) {
    return false;
  }
  if (v.startsWith("a -") || v.includes("engenharia clinica")) return true;
  if (v.includes("calibra")) return true;
  if (v.includes("prevent") && v.includes("medic")) return true;
  if (v.includes("seguranca eletrica") || v.includes("tse")) return true;
  if (v.includes("instrumental")) return true;
  return false;
}

export function filterOsOficinaEc(os: OsAnaliticoItem[]) {
  const hasOficina = os.some((item) => isOficinaEngenhariaClinica(item.Oficina));
  if (hasOficina) {
    return {
      recorte: "oficina" as const,
      items: os.filter((item) => isOficinaEngenhariaClinica(item.Oficina)),
    };
  }
  return {
    recorte: "tipo" as const,
    items: os.filter((item) => isTipoManutencaoOficinaEc(item.TipoDeManutencao)),
  };
}

export type VolumeMes = {
  month: number;
  label: string;
  abertas: number;
  fechadas: number;
  processadas: number;
  estoqueAberto: number;
};

export type VolumeOsRow = OsAnaliticoItem & {
  movimento: "Aberta" | "Fechada" | "Ambas";
};

function monthsInRange(from: string, to: string) {
  const start = parsePbiDate(from);
  const end = parsePbiDate(to);
  if (!start || !end) return 1;
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
}

export function buildVolumeOficina(opts: {
  os: OsAnaliticoItem[];
  from: string;
  to: string;
  year: number;
}) {
  const { items, recorte } = filterOsOficinaEc(opts.os);

  const months: VolumeMes[] = Array.from({ length: 12 }, (_, month) => {
    const monthEnd = new Date(opts.year, month + 1, 0, 23, 59, 59, 999);
    let abertas = 0;
    let fechadas = 0;
    let estoqueAberto = 0;
    for (const item of items) {
      const abertura = parsePbiDate(item.Abertura);
      const fechamento = osExecucaoDate(item);
      if (abertura?.getFullYear() === opts.year && abertura.getMonth() === month) abertas += 1;
      if (fechamento?.getFullYear() === opts.year && fechamento.getMonth() === month) fechadas += 1;
      const abriuAteFim = Boolean(abertura && abertura.getTime() <= monthEnd.getTime());
      const fechouAteFim = Boolean(fechamento && fechamento.getTime() <= monthEnd.getTime());
      if (abriuAteFim && !fechouAteFim) estoqueAberto += 1;
    }
    return {
      month,
      label: MESES_ABREV[month],
      abertas,
      fechadas,
      processadas: abertas + fechadas,
      estoqueAberto,
    };
  });

  const abertasPeriodo = items.filter((item) => dateInFilter(parsePbiDate(item.Abertura), opts.from, opts.to));
  const fechadasPeriodo = items.filter((item) => dateInFilter(osExecucaoDate(item), opts.from, opts.to));
  const mesesPeriodo = monthsInRange(opts.from, opts.to);
  const totalAbertas = abertasPeriodo.length;
  const totalFechadas = fechadasPeriodo.length;

  return {
    recorte,
    items,
    months,
    totalAbertas,
    totalFechadas,
    processadas: totalAbertas + totalFechadas,
    mediaMensal: (totalAbertas + totalFechadas) / mesesPeriodo,
    mesesPeriodo,
  };
}

export function volumeDrillPeriodo(
  items: OsAnaliticoItem[],
  from: string,
  to: string,
  tipo: "aberta" | "fechada" | "todas" = "todas",
): VolumeOsRow[] {
  const rows: VolumeOsRow[] = [];
  for (const item of items) {
    const abriu = dateInFilter(parsePbiDate(item.Abertura), from, to);
    const fechou = dateInFilter(osExecucaoDate(item), from, to);
    if (tipo === "aberta" && !abriu) continue;
    if (tipo === "fechada" && !fechou) continue;
    if (tipo === "todas" && !abriu && !fechou) continue;
    rows.push({
      ...item,
      movimento: abriu && fechou ? "Ambas" : abriu ? "Aberta" : "Fechada",
    });
  }
  return rows;
}

export function volumeDrillDoMes(items: OsAnaliticoItem[], year: number, month: number): VolumeOsRow[] {
  const rows: VolumeOsRow[] = [];
  for (const item of items) {
    const abertura = parsePbiDate(item.Abertura);
    const fechamento = osExecucaoDate(item);
    const abriu = abertura?.getFullYear() === year && abertura.getMonth() === month;
    const fechou = fechamento?.getFullYear() === year && fechamento.getMonth() === month;
    if (!abriu && !fechou) continue;
    rows.push({
      ...item,
      movimento: abriu && fechou ? "Ambas" : abriu ? "Aberta" : "Fechada",
    });
  }
  return rows;
}

const NOTA_TEXTO: Record<string, number> = {
  otimo: 5,
  excelente: 5,
  bom: 4,
  regular: 3,
  ruim: 2,
  pessimo: 1,
};

export type AvaliacaoParse = {
  filled: boolean;
  label: string;
  nota: number | null;
  positiva: boolean | null;
};

export function parseAvaliacao(raw: string | null | undefined): AvaliacaoParse {
  if (!filled(raw)) return { filled: false, label: "", nota: null, positiva: null };
  const trimmed = String(raw).trim();
  const numeric = parseBrNumber(trimmed);
  if (numeric != null && numeric >= 1 && numeric <= 5) {
    return { filled: true, label: String(numeric), nota: numeric, positiva: numeric >= 4 };
  }
  const key = normalize(trimmed);
  const nota = NOTA_TEXTO[key] ?? null;
  const positiva = nota != null ? nota >= 4 : null;
  return {
    filled: true,
    label: trimmed.toLocaleUpperCase("pt-BR"),
    nota,
    positiva,
  };
}

export type SatisfacaoRow = OsAnaliticoItem & {
  avaliacaoLabel: string;
  nota: number | null;
  positiva: boolean | null;
};

export type SatisfacaoMes = {
  month: number;
  label: string;
  avaliadas: number;
  positivas: number;
};

export function buildSatisfacao(opts: {
  os: OsAnaliticoItem[];
  from: string;
  to: string;
  year: number;
}) {
  const { items: oficina, recorte } = filterOsOficinaEc(opts.os);
  const periodo = osNoPeriodo(oficina, opts.from, opts.to);

  const rows: SatisfacaoRow[] = [];
  const dist = new Map<string, number>();
  let comNota = 0;
  let somaNota = 0;
  let positivas = 0;

  for (const item of periodo) {
    const parsed = parseAvaliacao(item.Avaliacao);
    if (!parsed.filled) continue;
    rows.push({
      ...item,
      avaliacaoLabel: parsed.label,
      nota: parsed.nota,
      positiva: parsed.positiva,
    });
    dist.set(parsed.label, (dist.get(parsed.label) ?? 0) + 1);
    if (parsed.nota != null) {
      comNota += 1;
      somaNota += parsed.nota;
    }
    if (parsed.positiva) positivas += 1;
  }

  const months: SatisfacaoMes[] = Array.from({ length: 12 }, (_, month) => {
    let avaliadas = 0;
    let positivasMes = 0;
    for (const item of oficina) {
      const parsed = parseAvaliacao(item.Avaliacao);
      if (!parsed.filled) continue;
      const data = osExecucaoDate(item) || parsePbiDate(item.Abertura);
      if (!data || data.getFullYear() !== opts.year || data.getMonth() !== month) continue;
      avaliadas += 1;
      if (parsed.positiva) positivasMes += 1;
    }
    return { month, label: MESES_ABREV[month], avaliadas, positivas: positivasMes };
  });

  const avaliadas = rows.length;
  const total = periodo.length;

  return {
    recorte,
    total,
    avaliadas,
    pctAvaliadas: pct(avaliadas, total),
    media: comNota ? somaNota / comNota : null,
    temNotaNumerica: comNota > 0,
    positivas,
    pctPositivas: pct(positivas, avaliadas),
    distribuicao: [...dist.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR")),
    months,
    rows,
  };
}
