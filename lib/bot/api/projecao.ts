/**
 * Campos que a API pode devolver. O que não está aqui não é lido do cache.
 */
import { texto } from "@/lib/ec/texto";
import type { EquipamentoItem, OsAnaliticoItem } from "@/lib/pbi/types";

export type OsPublica = {
  numero: string;
  situacao: string;
  tipo: string;
  tipoManutencao: string;
  prioridade: string;
  oficina: string;
  tag: string;
  equipamento: string;
  modelo: string;
  fabricante: string;
  setor: string;
  centroDeCusto: string;
  patrimonio: string;
  numeroSerie: string;
  abertura: string;
  fechamento: string;
  dataSolucao: string;
  dataAtendimento: string;
  dataLimiteAtendimento: string;
  dataLimiteSolucao: string;
  solicitante: string;
  tecnico: string;
  matriculaTecnico: string;
  responsavel: string;
  matriculaResponsavel: string;
};

export type EventoHistorico = {
  tipo: "abertura" | "atendimento" | "solucao" | "fechamento" | "limiteAtendimento" | "limiteSolucao";
  em: string;
};

const EVENTOS: Array<[EventoHistorico["tipo"], keyof OsAnaliticoItem]> = [
  ["abertura", "Abertura"],
  ["atendimento", "DataDoAtendimento"],
  ["solucao", "DataDaSolucao"],
  ["fechamento", "Fechamento"],
  ["limiteAtendimento", "DataLimiteDoAtendimento"],
  ["limiteSolucao", "DataLimiteDaSolucao"],
];

export function projetarOs(item: OsAnaliticoItem): OsPublica {
  return {
    numero: texto(item.OS),
    situacao: texto(item.SituacaoDaOS),
    tipo: texto(item.Tipo),
    tipoManutencao: texto(item.TipoDeManutencao),
    prioridade: texto(item.Prioridade),
    oficina: texto(item.Oficina),
    tag: texto(item.Tag),
    equipamento: texto(item.Equipamento),
    modelo: texto(item.Modelo),
    fabricante: texto(item.Fabricante),
    setor: texto(item.Setor),
    centroDeCusto: texto(item.CentroDeCusto),
    patrimonio: texto(item.Patrimonio),
    numeroSerie: texto(item.NumeroDeSerie),
    abertura: texto(item.Abertura),
    fechamento: texto(item.Fechamento),
    dataSolucao: texto(item.DataDaSolucao),
    dataAtendimento: texto(item.DataDoAtendimento),
    dataLimiteAtendimento: texto(item.DataLimiteDoAtendimento),
    dataLimiteSolucao: texto(item.DataLimiteDaSolucao),
    solicitante: texto(item.Requisitante),
    tecnico: texto(item.TecnicoResolvedor),
    matriculaTecnico: texto(item.MatriculaResolvedor),
    responsavel: texto(item.Responsavel),
    matriculaResponsavel: texto(item.MatriculaResponsavel),
  };
}

export function historicoOs(item: OsAnaliticoItem): EventoHistorico[] {
  const eventos: EventoHistorico[] = [];
  for (const [tipo, campo] of EVENTOS) {
    const em = texto(item[campo] as string | null | undefined);
    if (em) eventos.push({ tipo, em });
  }
  return eventos;
}

export type EquipamentoPublico = {
  tag: string;
  equipamento: string;
  modelo: string;
  fabricante: string;
  numeroSerie: string;
  patrimonio: string;
  criticidade: string;
  prioridade: string;
  status: string;
  situacao: string;
  setor: string;
  centroDeCusto: string;
  grupoDeSetores: string;
  registroAnvisa: string;
  validadeRegistroAnvisa: string;
  dataAquisicao: string;
  dataInstalacao: string;
  dataInativacao: string;
  dataFabricacao: string;
  endOfLife: string;
  endOfService: string;
  fornecedor: string;
};

export function projetarEquipamento(item: EquipamentoItem): EquipamentoPublico {
  return {
    tag: texto(item.Tag),
    equipamento: texto(item.Equipamento),
    modelo: texto(item.Modelo),
    fabricante: texto(item.Fabricante),
    numeroSerie: texto(item.NSerie),
    patrimonio: texto(item.Patrimonio),
    criticidade: texto(item.Criticidade),
    prioridade: texto(item.Prioridade),
    status: texto(item.Status),
    situacao: texto(item.Situacao),
    setor: texto(item.Setor),
    centroDeCusto: texto(item.CentroDeCusto),
    grupoDeSetores: texto(item.GrupoDeSetores),
    registroAnvisa: texto(item.RegistroAnvisa),
    validadeRegistroAnvisa: texto(item.ValidadeDoRegistroAnvisa),
    dataAquisicao: texto(item.DataDeAquisicao),
    dataInstalacao: texto(item["DataDeInstalação"]),
    dataInativacao: texto(item["DataDeInativação"]),
    dataFabricacao: texto(item.DataDeFabricacao),
    endOfLife: texto(item.EndOfLife),
    endOfService: texto(item.EndOfService),
    fornecedor: texto(item.Fornecedor),
  };
}
