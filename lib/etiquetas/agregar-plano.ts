import { parsePbiDate } from "@/lib/pbi/dates";
import { isOficinaEquals, isOsAindaAberta, mesTrabalhoPendente } from "@/lib/pbi/volume-ec";
import {
  PLANOS_ETIQUETA,
  type AgregarEtiquetasOptions,
  type EtiquetaEquipamento,
  type OsParaEtiqueta,
  type OsPlanoResumo,
  type PlanoEtiqueta,
} from "./tipos";

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function planoDaOficina(oficina: string | null | undefined): PlanoEtiqueta | null {
  for (const cfg of PLANOS_ETIQUETA) {
    if (isOficinaEquals(oficina, cfg.oficinaEquals)) return cfg.id;
  }
  return null;
}

function fichaVidaPath(tag: string) {
  return `/equipamentos/${encodeURIComponent(tag.trim())}`;
}

function ordemPlano(a: PlanoEtiqueta, b: PlanoEtiqueta) {
  const order: PlanoEtiqueta[] = ["preventiva", "calibracao", "tse"];
  return order.indexOf(a) - order.indexOf(b);
}

function toResumo(os: OsParaEtiqueta, plano: PlanoEtiqueta): OsPlanoResumo {
  return {
    os: os.OS,
    codigoSerial: os.CodigoSerialOS,
    oficina: os.Oficina,
    plano,
    abertura: os.Abertura,
    prazoEncerramento: os.PrazoDeEncerramentoOs,
    dataLimiteSolucao: os.DataLimiteDaSolucao,
    situacao: os.SituacaoDaOS,
  };
}

function earliestDate(dates: Array<Date | null>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!best || d.getTime() < best.getTime()) best = d;
  }
  return best;
}

function latestDate(dates: Array<Date | null>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best;
}

/**
 * Agrega OS abertas das oficinas de plano (Preventiva / Calibração / TSE)
 * em uma linha por Tag, com quais etiquetas aplicar e datas de realização / próxima.
 *
 * Período: mês do trabalho pendente (`mesTrabalhoPendente` — prazo → limite → abertura).
 * Sem `monthKeys` → todas as abertas. LGPD: só Tag / equipamento (sem CPF).
 */
export function agregarEtiquetasPlano(
  os: OsParaEtiqueta[],
  options: AgregarEtiquetasOptions = {},
): EtiquetaEquipamento[] {
  const planosFiltro = new Set<PlanoEtiqueta>(
    options.planos?.length ? options.planos : PLANOS_ETIQUETA.map((p) => p.id),
  );
  const monthSet =
    options.monthKeys && options.monthKeys.length > 0
      ? new Set(options.monthKeys)
      : null;

  const cronoMap = new Map<string, Date | null>();
  for (const hint of options.cronogramaProximas ?? []) {
    const tag = hint.tag.trim();
    if (!tag) continue;
    const prev = cronoMap.get(tag);
    if (!prev || (hint.proxima && hint.proxima.getTime() > (prev?.getTime() ?? 0))) {
      cronoMap.set(tag, hint.proxima);
    }
  }

  type Acc = {
    tag: string;
    equipamento: string;
    modelo: string;
    fabricante: string;
    setor: string;
    centroDeCusto: string;
    osPorPlano: Partial<Record<PlanoEtiqueta, OsPlanoResumo & { _abertura: Date | null; _proximaOs: Date | null }>>;
  };

  const byTag = new Map<string, Acc>();

  for (const item of os) {
    if (!isOsAindaAberta(item)) continue;
    const plano = planoDaOficina(item.Oficina);
    if (!plano || !planosFiltro.has(plano)) continue;

    const mes = mesTrabalhoPendente(item);
    if (monthSet && mes) {
      if (!monthSet.has(monthKey(mes.year, mes.month))) continue;
    } else if (monthSet && !mes) {
      continue;
    }

    const tag = (item.Tag ?? "").trim();
    if (!tag) continue;

    let acc = byTag.get(tag);
    if (!acc) {
      acc = {
        tag,
        equipamento: (item.Equipamento ?? "").trim(),
        modelo: (item.Modelo ?? "").trim(),
        fabricante: (item.Fabricante ?? "").trim(),
        setor: (item.Setor ?? "").trim(),
        centroDeCusto: (item.CentroDeCusto ?? "").trim(),
        osPorPlano: {},
      };
      byTag.set(tag, acc);
    } else {
      if (!acc.equipamento && item.Equipamento) acc.equipamento = item.Equipamento.trim();
      if (!acc.modelo && item.Modelo) acc.modelo = item.Modelo.trim();
      if (!acc.setor && item.Setor) acc.setor = item.Setor.trim();
    }

    const abertura = parsePbiDate(item.Abertura);
    const proximaOs =
      parsePbiDate(item.PrazoDeEncerramentoOs) || parsePbiDate(item.DataLimiteDaSolucao);
    const existing = acc.osPorPlano[plano];
    // Mantém a OS com abertura mais antiga (ciclo atual) para o plano.
    if (!existing || (abertura && (!existing._abertura || abertura < existing._abertura))) {
      acc.osPorPlano[plano] = {
        ...toResumo(item, plano),
        _abertura: abertura,
        _proximaOs: proximaOs,
      };
    }
  }

  const result: EtiquetaEquipamento[] = [];

  for (const acc of byTag.values()) {
    const planos = (Object.keys(acc.osPorPlano) as PlanoEtiqueta[]).sort(ordemPlano);
    if (planos.length === 0) continue;

    const aberturas = planos.map((p) => acc.osPorPlano[p]?._abertura ?? null);
    const realizacao = earliestDate(aberturas);

    const prazosOs = planos.map((p) => acc.osPorPlano[p]?._proximaOs ?? null);
    const prazoOs = latestDate(prazosOs);
    const crono = cronoMap.get(acc.tag) ?? null;
    const temPrazoEncerramento = planos.some((p) =>
      Boolean(parsePbiDate(acc.osPorPlano[p]?.prazoEncerramento)),
    );
    const temLimiteSolucao = planos.some((p) =>
      Boolean(parsePbiDate(acc.osPorPlano[p]?.dataLimiteSolucao)),
    );

    let proxima: Date | null = null;
    let proximaFonte: EtiquetaEquipamento["proximaFonte"] = "nenhuma";
    if (prazoOs) {
      proxima = prazoOs;
      proximaFonte = temPrazoEncerramento ? "prazo-os" : temLimiteSolucao ? "limite-solucao" : "prazo-os";
    } else if (crono) {
      proxima = crono;
      proximaFonte = "cronograma";
    } else if (realizacao) {
      proxima = new Date(realizacao.getFullYear() + 1, realizacao.getMonth(), realizacao.getDate());
      proximaFonte = "estimativa";
    }

    const osPorPlano: EtiquetaEquipamento["osPorPlano"] = {};
    for (const p of planos) {
      const raw = acc.osPorPlano[p];
      if (!raw) continue;
      osPorPlano[p] = {
        os: raw.os,
        codigoSerial: raw.codigoSerial,
        oficina: raw.oficina,
        plano: raw.plano,
        abertura: raw.abertura,
        prazoEncerramento: raw.prazoEncerramento,
        dataLimiteSolucao: raw.dataLimiteSolucao,
        situacao: raw.situacao,
      };
    }

    result.push({
      tag: acc.tag,
      equipamento: acc.equipamento,
      modelo: acc.modelo,
      fabricante: acc.fabricante,
      setor: acc.setor,
      centroDeCusto: acc.centroDeCusto,
      planos,
      realizacao,
      proxima,
      proximaFonte,
      osPorPlano,
      fichaVidaPath: fichaVidaPath(acc.tag),
    });
  }

  return result.sort((a, b) => {
    const setor = a.setor.localeCompare(b.setor, "pt-BR");
    if (setor !== 0) return setor;
    return a.tag.localeCompare(b.tag, "pt-BR");
  });
}

export function formatMesAno(date: Date | null): string {
  if (!date) return "—";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${mm}/${date.getFullYear()}`;
}

export function formatProximaLabel(date: Date | null, preferDay = true): string {
  if (!date) return "—";
  if (preferDay && date.getDate() !== 1) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${date.getFullYear()}`;
  }
  return formatMesAno(date);
}

export function chipLabels(planos: PlanoEtiqueta[]): string[] {
  return planos.map((id) => PLANOS_ETIQUETA.find((p) => p.id === id)?.chip ?? id.toUpperCase());
}

export function absoluteFichaVidaUrl(path: string, origin?: string): string {
  const base =
    origin ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_URL : undefined) ||
    "";
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
