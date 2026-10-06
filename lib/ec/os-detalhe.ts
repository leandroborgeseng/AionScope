import { format } from "date-fns";
import { parsePbiDate } from "@/lib/pbi/dates";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { osFechamentoDate } from "@/lib/pbi/volume-ec";
import type { EtapaOs } from "./etapas";
import { etapaOs } from "./etapas";
import { classeManutencao, semAcento, texto } from "./texto";

/** Detalhe operacional de uma OS para painel da TV / Sala (campos já no OsAnaliticoItem). */
export type OsDetalheSnapshot = {
  os: string;
  equipamento: string;
  tag: string;
  setor: string;
  oficina: string;
  responsavel: string;
  situacaoOs: string;
  criticidade: string;
  etapa: EtapaOs | string;
  aberto: boolean;
  /** O que o solicitante pediu / descrição útil da demanda. */
  solicitacao: string;
  ocorrencia: string;
  servico: string;
  observacaoOs: string;
  pendencia: string;
  observacaoPendencia: string;
  /** Reparo externo / assistência / EXT. */
  manutencaoExterna: boolean;
  assistencia: string;
  /** Pendência de compra / classe compra. */
  pendenciaCompra: boolean;
  abertura: string;
  primeiroAtendimento: string;
  fechamento: string;
  tipoManutencao: string;
  prioridade: string;
  requisitante: string;
};

function primeiroTexto(...valores: Array<string | null | undefined>) {
  for (const valor of valores) {
    const t = texto(valor);
    if (t) return t;
  }
  return "";
}

function formatarDataCurta(valor: string | null | undefined) {
  const data = parsePbiDate(valor);
  if (!data) return texto(valor) || "—";
  return format(data, "dd/MM/yyyy HH:mm");
}

function detectaExterna(os: OsAnaliticoItem, etapa: string) {
  if (etapa === "Reparo externo" || etapa === "Contrato/assistência") return true;
  const assistencia = texto(os.Assistencia);
  if (assistencia) return true;
  const blob = semAcento(
    `${os.Pendencia ?? ""} ${os.PendenciaAberta ?? ""} ${os.ObservacaoDaPendencia ?? ""} ${os.TipoDeManutencao ?? ""} ${os.ObservacaoDaOS ?? ""}`,
  );
  return (
    blob.includes("EXTERNA") ||
    blob.includes("ASSISTENCIA") ||
    /\bEXT\b/.test(blob) ||
    blob.includes("REPARO EXTERNO")
  );
}

function detectaCompra(os: OsAnaliticoItem, etapa: string, classe: ReturnType<typeof classeManutencao>) {
  if (classe === "compra" || etapa === "Aguarda peça/compra") return true;
  const blob = semAcento(
    `${os.Pendencia ?? ""} ${os.PendenciaAberta ?? ""} ${os.ObservacaoDaPendencia ?? ""} ${os.TipoDeManutencao ?? ""}`,
  );
  return blob.includes("COMPRA") || blob.includes("PECA") || blob.includes("ORCAMENTO");
}

/**
 * Monta o objeto de detalhe a partir dos campos do OsAnaliticoItem.
 * Não inventa APIs — só agrega o que já veio na listagem analítica.
 */
export function montarOsDetalhe(
  os: OsAnaliticoItem,
  extras?: {
    criticidade?: string;
    etapa?: EtapaOs | string;
    aberto?: boolean;
  },
): OsDetalheSnapshot {
  const classe = classeManutencao(os.TipoDeManutencao);
  const fechamento = osFechamentoDate(os);
  const aberto =
    extras?.aberto ??
    (semAcento(os.SituacaoDaOS) !== "FECHADA" &&
      semAcento(os.SituacaoDaOS) !== "CANCELADA" &&
      fechamento == null);
  const etapaResolvida =
    extras?.etapa ??
    etapaOs({
      encerrada: !aberto,
      classe,
      pendencia: `${os.Pendencia ?? ""} ${os.PendenciaAberta ?? ""}`,
      assistencia: os.Assistencia ?? "",
      observacao: os.ObservacaoDaOS ?? "",
      temAtendimento: Boolean(parsePbiDate(os.DataDoAtendimento)),
    }).etapa;

  const pendencia = primeiroTexto(os.PendenciaAberta, os.Pendencia);
  const solicitacao = primeiroTexto(
    os.ObservacaoDaRequisicao,
    os.Servico,
    os.Ocorrencia,
    os.ObservacaoDaOS,
  );

  return {
    os: texto(os.OS) || "—",
    equipamento: texto(os.Equipamento) || "—",
    tag: texto(os.Tag) || "—",
    setor: texto(os.Setor) || "—",
    oficina: texto(os.Oficina) || "—",
    responsavel: texto(os.Responsavel) || "—",
    situacaoOs: texto(os.SituacaoDaOS) || "—",
    criticidade: extras?.criticidade || texto(os.Prioridade) || "—",
    etapa: etapaResolvida,
    aberto,
    solicitacao: solicitacao || "—",
    ocorrencia: texto(os.Ocorrencia) || "—",
    servico: texto(os.Servico) || "—",
    observacaoOs: texto(os.ObservacaoDaOS) || "—",
    pendencia: pendencia || "—",
    observacaoPendencia: texto(os.ObservacaoDaPendencia) || "—",
    manutencaoExterna: detectaExterna(os, etapaResolvida),
    assistencia: texto(os.Assistencia) || "—",
    pendenciaCompra: detectaCompra(os, etapaResolvida, classe),
    abertura: formatarDataCurta(os.Abertura),
    primeiroAtendimento: formatarDataCurta(os.DataDoAtendimento),
    fechamento: fechamento ? format(fechamento, "dd/MM/yyyy HH:mm") : "—",
    tipoManutencao: texto(os.TipoDeManutencao) || "—",
    prioridade: texto(os.Prioridade) || "—",
    requisitante: texto(os.Requisitante) || "—",
  };
}

/** Sugestão leve para vincular OC ↔ OS (busca de abertas). */
export type OsAbertaSugestao = {
  os: string;
  equipamento: string;
  tag: string;
  setor: string;
  oficina: string;
  situacao: string;
  responsavel: string;
  abertura: string;
  aberto: boolean;
  etapa: string;
  pendenciaCompra: boolean;
  manutencaoExterna: boolean;
};

export function paraSugestao(detalhe: OsDetalheSnapshot): OsAbertaSugestao {
  return {
    os: detalhe.os,
    equipamento: detalhe.equipamento,
    tag: detalhe.tag,
    setor: detalhe.setor,
    oficina: detalhe.oficina,
    situacao: detalhe.situacaoOs,
    responsavel: detalhe.responsavel,
    abertura: detalhe.abertura,
    aberto: detalhe.aberto,
    etapa: String(detalhe.etapa),
    pendenciaCompra: detalhe.pendenciaCompra,
    manutencaoExterna: detalhe.manutencaoExterna,
  };
}

export function filtrarOsPorQuery(itens: OsAbertaSugestao[], q: string, limite = 20) {
  const termo = semAcento(q);
  if (!termo) return itens.slice(0, limite);
  const pontuados = itens
    .map((item) => {
      const os = semAcento(item.os);
      const tag = semAcento(item.tag);
      const equip = semAcento(item.equipamento);
      const setor = semAcento(item.setor);
      let score = 0;
      if (os === termo) score = 100;
      else if (os.startsWith(termo)) score = 80;
      else if (os.includes(termo)) score = 60;
      else if (tag.includes(termo)) score = 40;
      else if (equip.includes(termo)) score = 30;
      else if (setor.includes(termo)) score = 20;
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.os.localeCompare(b.item.os));
  return pontuados.slice(0, limite).map((row) => row.item);
}
