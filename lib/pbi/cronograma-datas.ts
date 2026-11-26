/**
 * Última e próxima de preventiva, TSE e calibração a partir do cronograma.
 *
 * A cópia grava `ProximaRealizacao` como código de 9 dígitos (`2099MM…`),
 * não como data de calendário (`docs/sala/api-campos.md`). `parsePbiDate`
 * ancora o mês. O mês seguinte usa a mesma conta do cronograma anual
 * (`plannedMonthsInYear` + `Perioridicade`). `DataDaUltima` costuma vir vazia.
 *
 * A ficha do bot só olhava preventiva, comparava a TAG com hífen e exigia a
 * palavra no `TipoDeManutencao`. Plano classificado só pelo nome, TAG
 * `HSJ02932` contra `HSJ-02932`, ou âncora em 2099 sem mês ainda futuro na
 * janela de dois anos devolvia `proximaPreventiva: null`.
 *
 * Código de 9 dígitos (`20` + 7 dígitos) não é data. Com periodicidade, a próxima
 * é o mês projetado (`MM/yyyy`). Sem periodicidade, a próxima fica null e
 * `motivo` explica; o ano 2099 e o dia embutido no código não saem.
 */
import { semAcento, texto } from "@/lib/ec/texto";
import { parsePbiDate } from "./dates";
import { classifyCronogramaPlanoLoose } from "./gap-preventiva";
import { parsePeriodicidadeMeses, plannedMonthsInYear } from "./cronograma-anual";
import type { PlanoEcTipo } from "./indicadores-os";
import type { CronogramaItem } from "./types";

export type DatasTipo = {
  ultima: string | null;
  proxima: string | null;
  motivo: string | null;
};

export type DatasTipoInterna = DatasTipo & {
  mes: string | null;
  plano: string;
};

export type DatasTag = {
  preventiva: DatasTipoInterna;
  tse: DatasTipoInterna;
  calibracao: DatasTipoInterna;
};

type Ancora = { date: Date; mesSomente: boolean; codigo: boolean };

const MOTIVO_CODIGO = "código de mês sem periodicidade";
const MOTIVO_INVALIDA = "sem data válida";

const VAZIO: DatasTipoInterna = { ultima: null, proxima: null, motivo: null, mes: null, plano: "" };

export function chaveTag(tag: string | null | undefined) {
  const limpa = semAcento(tag).replace(/[^A-Z0-9]/g, "");
  const partes = limpa.match(/^([A-Z]*)0*(\d+)$/);
  if (!partes?.[2]) return limpa;
  return `${partes[1]}${partes[2]}`;
}

export function interpretarDataCronograma(raw: string | null | undefined): Ancora | null {
  const valor = (raw ?? "").trim();
  if (!valor) return null;
  const date = parsePbiDate(valor);
  if (!date) return null;
  if (/^20\d{7}$/.test(valor)) {
    return { date, mesSomente: true, codigo: true };
  }
  return { date, mesSomente: false, codigo: false };
}

function textoData(date: Date, mesSomente: boolean) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  if (mesSomente) return `${mm}/${yyyy}`;
  return `${String(date.getDate()).padStart(2, "0")}/${mm}/${yyyy}`;
}

function mesChave(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dataNoMes(ano: number, mes: number, ancora: Ancora | null): Ancora {
  if (ancora && !ancora.mesSomente) {
    const dia = ancora.date.getDate();
    const candidata = new Date(ano, mes, dia);
    if (candidata.getMonth() === mes) return { date: candidata, mesSomente: false, codigo: false };
  }
  return { date: new Date(ano, mes, 1), mesSomente: true, codigo: false };
}

function escolherProxima(item: CronogramaItem, agora: Date): { ancora: Ancora | null; motivo: string | null } {
  const raw = (item.ProximaRealizacao ?? "").trim();
  const proxima = interpretarDataCronograma(raw);
  const ultima = interpretarDataCronograma(item.DataDaUltima);
  const interval = parsePeriodicidadeMeses(item.Perioridicade);
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth();
  let melhor: Ancora | null = null;
  for (const ano of [anoAtual, anoAtual + 1]) {
    const meses = plannedMonthsInYear({
      proxima: proxima?.date ?? null,
      ultima: ultima?.date ?? null,
      intervalMonths: interval,
      year: ano,
    });
    for (const mes of meses) {
      if (ano === anoAtual && mes < mesAtual) continue;
      const candidata = dataNoMes(ano, mes, proxima ?? ultima);
      if (!melhor || candidata.date < melhor.date) melhor = candidata;
    }
  }
  if (melhor) return { ancora: melhor, motivo: null };
  if (proxima?.codigo) return { ancora: null, motivo: MOTIVO_CODIGO };
  if (proxima) return { ancora: proxima, motivo: null };
  if (raw) return { ancora: null, motivo: MOTIVO_INVALIDA };
  return { ancora: null, motivo: null };
}

function linhasDoTipo(itens: CronogramaItem[], tipo: PlanoEcTipo) {
  const doTipo = itens.filter((item) => classifyCronogramaPlanoLoose(item) === tipo);
  if (tipo !== "Preventiva") return doTipo;
  const preferidas = doTipo.filter((item) => semAcento(item.TipoDeManutencao).startsWith("A -"));
  const comData = preferidas.filter(
    (item) => interpretarDataCronograma(item.ProximaRealizacao) || interpretarDataCronograma(item.DataDaUltima),
  );
  return comData.length ? preferidas : doTipo;
}

function resumir(itens: CronogramaItem[], agora: Date): DatasTipoInterna {
  if (!itens.length) return { ...VAZIO };
  let ultima: Ancora | null = null;
  let proxima: Ancora | null = null;
  let plano = "";
  let motivo: string | null = null;
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const candidatos: Array<{ ancora: Ancora; plano: string }> = [];
  for (const item of itens) {
    const u = interpretarDataCronograma(item.DataDaUltima);
    if (u && (!ultima || u.date > ultima.date)) ultima = u;
    const escolha = escolherProxima(item, agora);
    if (!escolha.ancora) {
      if (!motivo && escolha.motivo) motivo = escolha.motivo;
      continue;
    }
    candidatos.push({ ancora: escolha.ancora, plano: texto(item.PlanoDeManutencao) });
  }
  const futuros = candidatos.filter((item) => item.ancora.date >= inicioMes);
  const pool = futuros.length ? futuros : candidatos;
  pool.sort((a, b) => a.ancora.date.getTime() - b.ancora.date.getTime());
  const escolhida = pool[0];
  if (escolhida) {
    proxima = escolhida.ancora;
    plano = escolhida.plano.length <= 80 ? escolhida.plano : "";
    motivo = null;
  }
  return {
    ultima: ultima ? textoData(ultima.date, ultima.mesSomente) : null,
    proxima: proxima ? textoData(proxima.date, proxima.mesSomente) : null,
    motivo,
    mes: proxima ? mesChave(proxima.date) : null,
    plano,
  };
}

export function datasPorTipo(itens: CronogramaItem[], agora = new Date()): DatasTag {
  return {
    preventiva: resumir(linhasDoTipo(itens, "Preventiva"), agora),
    tse: resumir(linhasDoTipo(itens, "TSE"), agora),
    calibracao: resumir(linhasDoTipo(itens, "Calibração"), agora),
  };
}

export function datasPublicas(datas: DatasTipoInterna): DatasTipo {
  return { ultima: datas.ultima, proxima: datas.proxima, motivo: datas.motivo };
}
