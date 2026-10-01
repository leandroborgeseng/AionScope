import {
  keepCronogramaPlano,
  parsePeriodicidadeMeses,
  plannedMonthsInYear,
} from "@/lib/pbi/cronograma-anual";
import { parsePbiDate } from "@/lib/pbi/dates";
import { classifyPlanoEc, type PlanoEcTipo } from "@/lib/pbi/indicadores-os";
import type { CronogramaItem, OsAnaliticoItem } from "@/lib/pbi/types";
import { isOsCancelada, osFechamentoDate } from "@/lib/pbi/volume-ec";
import { isOficinaEngenhariaClinica } from "@/lib/pbi/oficina-ec";
import { texto } from "./texto";

export type TipoPlanoTv = "Calibração" | "Preventiva" | "TSE";

export type ResumoTipoPlano = {
  tipo: TipoPlanoTv;
  previstos: number;
  executados: number;
  faltam: number;
  percentual: number | null;
};

export type PendentePlano = {
  tipo: string;
  equipamento: string;
  setor: string;
  tag: string;
};

export type ResumoProgramadasMes = {
  previstos: number;
  executados: number;
  faltam: number;
  percentual: number | null;
  porTipo: ResumoTipoPlano[];
  pendentes: PendentePlano[];
  semDataPlanejada: number;
  aviso: string;
};

const TIPOS: TipoPlanoTv[] = ["Calibração", "Preventiva", "TSE"];

function rotuloCurto(tipo: TipoPlanoTv) {
  if (tipo === "Calibração") return "CALIB.";
  if (tipo === "Preventiva") return "PREV.";
  return "TSE";
}

function percentual(parte: number, total: number) {
  if (!total) return null;
  return Math.round((Math.min(parte, total) / total) * 100);
}

/**
 * Cumprimento do plano no mês civil atual.
 * Previsto = ocorrências do cronograma (ProximaRealizacao/DataDaUltima + periodicidade)
 * ancoradas no mês. Executado = OS de plano fechadas no mês (independente, como no indicador).
 */
export function resumoProgramadasMes(
  cronograma: CronogramaItem[],
  os: OsAnaliticoItem[],
  agora: Date,
): ResumoProgramadasMes {
  const year = agora.getFullYear();
  const month = agora.getMonth();
  const planos = cronograma.filter((item) => keepCronogramaPlano(item.TipoDeManutencao, false));
  let semDataPlanejada = 0;

  const previstosPorTipo = new Map<TipoPlanoTv, number>(TIPOS.map((tipo) => [tipo, 0]));
  const pendentes: PendentePlano[] = [];

  for (const item of planos) {
    const tipo = classifyPlanoEc(item.TipoDeManutencao) as TipoPlanoTv | null;
    if (!tipo || !TIPOS.includes(tipo)) continue;
    const proxima = parsePbiDate(item.ProximaRealizacao);
    const ultima = parsePbiDate(item.DataDaUltima);
    if (!proxima && !ultima) {
      semDataPlanejada += 1;
      continue;
    }
    const interval = parsePeriodicidadeMeses(item.Perioridicade);
    const meses = plannedMonthsInYear({ proxima, ultima, intervalMonths: interval, year });
    if (!meses.includes(month)) continue;
    previstosPorTipo.set(tipo, (previstosPorTipo.get(tipo) ?? 0) + 1);
    pendentes.push({
      tipo: rotuloCurto(tipo),
      equipamento: texto(item.Equipamento) || "—",
      setor: texto(item.Setor) || "—",
      tag: texto(item.Tag),
    });
  }

  const executadosPorTipo = new Map<TipoPlanoTv, number>(TIPOS.map((tipo) => [tipo, 0]));
  for (const item of os) {
    if (!isOficinaEngenhariaClinica(item.Oficina)) continue;
    if (isOsCancelada(item)) continue;
    const tipo = classifyPlanoEc(item.TipoDeManutencao) as TipoPlanoTv | null;
    if (!tipo || !TIPOS.includes(tipo)) continue;
    const fechamento = osFechamentoDate(item);
    if (!fechamento) continue;
    if (fechamento.getFullYear() !== year || fechamento.getMonth() !== month) continue;
    executadosPorTipo.set(tipo, (executadosPorTipo.get(tipo) ?? 0) + 1);
  }

  const porTipo: ResumoTipoPlano[] = TIPOS.map((tipo) => {
    const previstos = previstosPorTipo.get(tipo) ?? 0;
    const executados = executadosPorTipo.get(tipo) ?? 0;
    return {
      tipo,
      previstos,
      executados,
      faltam: Math.max(0, previstos - executados),
      percentual: percentual(executados, previstos),
    };
  });

  const previstos = porTipo.reduce((soma, item) => soma + item.previstos, 0);
  const executados = porTipo.reduce((soma, item) => soma + item.executados, 0);
  const faltam = Math.max(0, previstos - executados);

  return {
    previstos,
    executados,
    faltam,
    percentual: percentual(executados, previstos),
    porTipo,
    pendentes: pendentes.slice(0, 8),
    semDataPlanejada,
    aviso: previstos
      ? `Previsto pelo cronograma (mês ancorado em ProximaRealizacao). Executado = OS fechadas no mês. ${semDataPlanejada ? `${semDataPlanejada} linha(s) sem data no cronograma.` : "Laudo anexado ainda não entra na conta."}`
      : "Nenhum plano ancorado neste mês no cronograma (ProximaRealizacao ilegível ou fora do mês).",
  };
}

export function planoAgoraCards(resumo: ResumoProgramadasMes) {
  return resumo.porTipo.map((item) => ({
    tipo: item.tipo,
    faltam: resumo.previstos ? item.faltam : null,
    percentual: item.percentual,
  }));
}
