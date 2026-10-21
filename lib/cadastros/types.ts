export type ParqueFonte = "api" | "manual";
export type ParqueEscopo = "todos" | "medicos";

export type ParqueMeta = {
  /** @deprecated coluna legado — ignorada no cálculo; limpa ao atualizar da API */
  valorSubstituicaoManual: number | null;
  /** Soma ValorDeSubstituicao (escopo) persistida da API. */
  valorApi: number | null;
  fonte: ParqueFonte;
  escopo: ParqueEscopo;
  atualizadoEm: string | null;
  atualizadoPor?: string | null;
  /** Meta antiga ~57 mi — só referência, não entra no cálculo. */
  valorManualReferencia: number | null;
  notas?: string | null;
};

export type Contrato = {
  id: string;
  nome: string;
  fornecedor?: string;
  valorMensal: number;
  /** YYYY-MM-DD — início da vigência (inclusive) */
  inicio?: string | null;
  /** YYYY-MM-DD — fim da vigência (inclusive) */
  fim?: string | null;
  ativo: boolean;
  observacao?: string;
  /** MANUTENCAO | LOCACAO. Null só em contratos antigos (antes da 009). */
  tipo?: TipoContrato | null;
  equipamento?: string | null;
  numero?: string | null;
  /** Chave natural da importação (ex.: csv-20-10:3). Não editável pela tela. */
  chaveImportacao?: string | null;
};

export type TipoContrato = "MANUTENCAO" | "LOCACAO";

export type ContratosFile = {
  contratos: Contrato[];
};

export type ContratoInput = {
  nome: string;
  fornecedor?: string;
  valorMensal: number;
  inicio?: string | null;
  fim?: string | null;
  ativo?: boolean;
  observacao?: string;
  tipo?: string | null;
  equipamento?: string | null;
  numero?: string | null;
};
