/**
 * Tempo da OS na etapa atual. Não é SLA: não lê prazo, limite nem vencimento.
 *
 * Origem de `diasNaEtapa`, nesta ordem:
 * 1. `PendenciaAbertaEm` — data em que a pendência aberta foi registrada na
 *    listagem analítica. Não usa `PrazoDeEncerramentoPendencia` (isso é prazo).
 *    `DataAberturaPendencia` existe na OS resumida, que esta API não lê.
 * 2. `DataDoAtendimento`, se a pendência não tiver data.
 * 3. `Abertura`, se ainda não houve atendimento.
 *
 * O dia civil é o de America/Sao_Paulo. `tempoAteAtendimento` é a duração
 * entre a abertura e o primeiro atendimento, em horas e dias inteiros
 * (o que sobra fica de fora). Sem atendimento, os dois campos de atendimento
 * vêm nulos.
 */
import { ETAPAS } from "@/lib/ec/etapas";
import { montarOsDetalhe, textoSolicitacaoOs } from "@/lib/ec/os-detalhe";
import { texto } from "@/lib/ec/texto";
import { paredeSaoPaulo, parsePbiDate } from "@/lib/pbi/dates";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { prepararSolicitacao } from "./solicitacao";

export const CAMPO_DATA_PENDENCIA = "PendenciaAbertaEm";

export type OrigemEtapa = "pendencia" | "atendimento" | "abertura";

export type TempoOs = {
  dataAtendimento: string | null;
  tempoAteAtendimento: { horas: number; dias: number } | null;
  diasNaEtapa: number;
  diasNaEtapaOrigem: OrigemEtapa;
};

export type CamposEtapa = TempoOs & {
  etapa: string;
  manutencaoExterna: boolean;
  pendenciaCompra: boolean;
  abertura: string;
  textoEtapa: string;
  solicitacao?: string;
};

export function diasCivis(origem: Date, agora: Date) {
  const hoje = paredeSaoPaulo(agora);
  const inicio = Date.UTC(origem.getFullYear(), origem.getMonth(), origem.getDate());
  const fim = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((fim - inicio) / 86_400_000));
}

export function textoDaEtapa(etapa: string, dias: number) {
  if (dias <= 0) return `${etapa} desde hoje`;
  if (dias === 1) return `${etapa} há 1 dia`;
  return `${etapa} há ${dias} dias`;
}

export function calcularTempo(
  item: Pick<OsAnaliticoItem, "Abertura" | "DataDoAtendimento" | "PendenciaAbertaEm">,
  agora: Date,
): TempoOs {
  const abertura = parsePbiDate(item.Abertura);
  const atendimento = parsePbiDate(item.DataDoAtendimento);
  const pendencia = parsePbiDate(item.PendenciaAbertaEm);
  let origem: OrigemEtapa = "abertura";
  let ancora = abertura;
  if (pendencia) {
    origem = "pendencia";
    ancora = pendencia;
  } else if (atendimento) {
    origem = "atendimento";
    ancora = atendimento;
  }
  let tempoAteAtendimento: TempoOs["tempoAteAtendimento"] = null;
  if (abertura && atendimento) {
    const ms = Math.max(0, atendimento.getTime() - abertura.getTime());
    tempoAteAtendimento = {
      horas: Math.floor(ms / 3_600_000),
      dias: Math.floor(ms / 86_400_000),
    };
  }
  return {
    dataAtendimento: atendimento ? texto(item.DataDoAtendimento) : null,
    tempoAteAtendimento,
    diasNaEtapa: ancora ? diasCivis(ancora, agora) : 0,
    diasNaEtapaOrigem: origem,
  };
}

export function indiceEtapa(etapa: string) {
  const indice = ETAPAS.indexOf(etapa as (typeof ETAPAS)[number]);
  return indice < 0 ? ETAPAS.length : indice;
}

export function camposEtapa(item: OsAnaliticoItem, agora: Date, opts: { solicitacao: boolean }): CamposEtapa {
  const detalhe = montarOsDetalhe(item);
  const tempo = calcularTempo(item, agora);
  const etapa = String(detalhe.etapa);
  const corpo: CamposEtapa = {
    etapa,
    manutencaoExterna: detalhe.manutencaoExterna,
    pendenciaCompra: detalhe.pendenciaCompra,
    abertura: texto(item.Abertura),
    dataAtendimento: tempo.dataAtendimento,
    tempoAteAtendimento: tempo.tempoAteAtendimento,
    diasNaEtapa: tempo.diasNaEtapa,
    diasNaEtapaOrigem: tempo.diasNaEtapaOrigem,
    textoEtapa: textoDaEtapa(etapa, tempo.diasNaEtapa),
  };
  if (opts.solicitacao) corpo.solicitacao = prepararSolicitacao(textoSolicitacaoOs(item));
  return corpo;
}
