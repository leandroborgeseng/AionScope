export type ParqueFonte = "api" | "manual";
export type ParqueEscopo = "todos" | "medicos";

export type ParqueMeta = {
  /** Override opcional — só entra no cálculo se > 0 e salvo explicitamente. */
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
};

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
};

/** Acompanhamento local de equipamento TERCEIRO (médico / responsável). */
export type EquipamentoTerceiroLocal = {
  id: string;
  tag: string;
  descricao?: string;
  medicoResponsavel?: string;
  setor?: string;
  observacao?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type EquipamentoTerceiroInput = {
  tag: string;
  descricao?: string;
  medicoResponsavel?: string;
  setor?: string;
  observacao?: string;
  ativo?: boolean;
};
