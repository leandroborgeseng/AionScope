export const STATUS_ORDEM = ["solicitado", "ordem_gerada", "cancelado", "fora_escopo"] as const;
export const CATEGORIA_ORDEM = ["Instrumental", "Equipamentos Médicos", "Outros"] as const;
export const ORIGEM_ORDEM = ["manutencao_sjh", "oficina_aion_cc", "tramite_interno"] as const;
export const CONFIANCA_ORDEM = ["alta", "media", "baixa"] as const;

export type StatusOrdem = (typeof STATUS_ORDEM)[number];
export type CategoriaOrdem = (typeof CATEGORIA_ORDEM)[number];
export type OrigemOrdem = (typeof ORIGEM_ORDEM)[number];
export type ConfiancaOrdem = (typeof CONFIANCA_ORDEM)[number];

export type ItemOrdem = {
  descricao: string | null;
  quantidade: string | null;
  unidade: string | null;
  valor_unitario: string | null;
  valor_total: string | null;
  codigo: string | null;
};

/** Campos que o robô pode enviar no upsert. */
export type CamposOrdem = {
  status: StatusOrdem | null;
  categoria: CategoriaOrdem | null;
  data_pedido: string | null;
  data_ordem: string | null;
  valor_total: string | null;
  fornecedor: string | null;
  numero_orcamento: string | null;
  numero_os: string | null;
  setor_equipamento: string | null;
  origem: OrigemOrdem | null;
  solicitante: string | null;
  assunto_email: string | null;
  email_message_id: string | null;
  anexo_origem: string | null;
  confianca: ConfiancaOrdem | null;
  observacoes: string | null;
  ordens_relacionadas: string[] | null;
};

export const CAMPOS_ORDEM = [
  "status",
  "categoria",
  "data_pedido",
  "data_ordem",
  "valor_total",
  "fornecedor",
  "numero_orcamento",
  "numero_os",
  "setor_equipamento",
  "origem",
  "solicitante",
  "assunto_email",
  "email_message_id",
  "anexo_origem",
  "confianca",
  "observacoes",
  "ordens_relacionadas",
] as const;

export type NomeCampoOrdem = (typeof CAMPOS_ORDEM)[number];

/** Campos só da Sala (entrega real / exclusão TV) — não entram no upsert do robô. */
export type CamposSalaOrdem = {
  data_entrega: string | null;
  itens_entregues: string | null;
  /** Nota ao marcar fora_escopo (outro cliente, não realizado, etc.). */
  motivo_exclusao: string | null;
};

export type ParsedOrdem = {
  numero_ordem: string;
  campos: Partial<CamposOrdem>;
  itens?: ItemOrdem[];
};

export type EditadoManualmente = Partial<
  Record<NomeCampoOrdem | "itens" | "data_entrega" | "itens_entregues" | "motivo_exclusao", boolean>
>;

export type OrdemCompra = CamposOrdem &
  CamposSalaOrdem & {
    numero_ordem: string;
    itens: ItemOrdem[];
    fonte: string;
    editado_manualmente: EditadoManualmente;
    created_at: string;
    updated_at: string;
  };

export type PatchSalaOrdem = {
  categoria?: CategoriaOrdem;
  numero_os?: string | null;
  data_entrega?: string | null;
  itens_entregues?: string | null;
  status?: StatusOrdem;
  motivo_exclusao?: string | null;
  /** Atalho: status=fora_escopo + motivo opcional. */
  marcar_fora_escopo?: boolean;
  /** Atalho: volta à TV (ordem_gerada se tem data_ordem, senão solicitado). */
  restaurar_tv?: boolean;
};

export type DetalheErro = { campo: string; mensagem: string };

export type ErroValidacao = {
  status: 400 | 422;
  erro: string;
  detalhes: DetalheErro[];
};

export type ListaFiltros = {
  desde?: string;
  categoria?: string;
  fornecedor?: string;
  mes?: string;
  os?: string;
  sem_valor?: boolean;
  /** Só OCs abertas na TV: não canceladas, não fora_escopo e sem data_entrega. */
  abertas?: boolean;
  /** Só OCs com status fora_escopo (excluídas da TV, audit trail). */
  excluidas?: boolean;
  page: number;
  page_size: number;
};

export type ListaOrdens = {
  itens: OrdemCompra[];
  page: number;
  page_size: number;
  total: number;
};

export type PedidoTvOrdem = {
  numeroOrdem: string;
  categoria: string;
  fornecedor: string;
  dataPedido: string;
  dataOrdem: string;
  valor: string;
  numeroOs: string;
  status: string;
  confianca: string;
  paradoDias: number;
  situacao: string;
};
