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

type Ancora = { date: Date; mesSomente: boolean };

const VAZIO: DatasTipoInterna = { ultima: null, proxima: null, mes: null, plano: "" };

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
  if (/^20\d{7}$/.test(valor) && Number(valor.slice(6, 8)) !== date.getDate()) {
    return { date, mesSomente: true };
  }
  return { date, mesSomente: false };
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
    if (candidata.getMonth() === mes) return { date: candidata, mesSomente: false };
  }
  return { date: new Date(ano, mes, 1), mesSomente: true };
}

function escolherProxima(item: CronogramaItem, agora: Date): Ancora | null {
  const proxima = interpretarDataCronograma(item.ProximaRealizacao);
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
  return melhor ?? proxima;
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
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const candidatos: Array<{ ancora: Ancora; plano: string }> = [];
  for (const item of itens) {
    const u = interpretarDataCronograma(item.DataDaUltima);
    if (u && (!ultima || u.date > ultima.date)) ultima = u;
    const p = escolherProxima(item, agora);
    if (!p) continue;
    candidatos.push({ ancora: p, plano: texto(item.PlanoDeManutencao) });
  }
  const futuros = candidatos.filter((item) => item.ancora.date >= inicioMes);
  const pool = futuros.length ? futuros : candidatos;
  pool.sort((a, b) => a.ancora.date.getTime() - b.ancora.date.getTime());
  const escolhida = pool[0];
  if (escolhida) {
    proxima = escolhida.ancora;
    plano = escolhida.plano.length <= 80 ? escolhida.plano : "";
  }
  return {
    ultima: ultima ? textoData(ultima.date, ultima.mesSomente) : null,
    proxima: proxima ? textoData(proxima.date, proxima.mesSomente) : null,
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
  return { ultima: datas.ultima, proxima: datas.proxima };
}
