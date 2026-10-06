export type Vinculo2025 = "matrícula" | "nome" | null;

export type ParticipanteTreinamento = {
  ano: number;
  data_treinamento: string;
  periodo_original: string;
  matricula: string | null;
  nome: string;
  setor: string | null;
  setor_original: string | null;
  carga_min: number | null;
  carga_estimada: boolean;
  instrutor: string;
  equipamento: string;
  fonte: string;
  reciclagem: boolean | null;
  vinculo_2025: Vinculo2025;
  leitura_incerta: boolean;
};

export type FaixaReciclagem = "ok" | "atencao" | "critico";

export type ResumoSetor = {
  setor: string;
  treinados_anterior: number;
  reciclados_atual: number;
  taxa_reciclagem_pct: number;
  faixa: FaixaReciclagem;
};

export type AnoAgg = {
  ano: number;
  treinados: number;
  horas_homem: number;
  horas_homem_estimado: boolean;
};

export type PainelTreinamentos = {
  treinamento: string;
  atualizado_em: string;
  anos: AnoAgg[];
  ano_anterior: number;
  ano_atual: number;
  variacao_treinados_pct: number;
  reciclados_atual: number;
  taxa_reciclagem_geral_pct: number;
  novos_atual: number;
  taxa_novos_pct: number;
  setores: ResumoSetor[];
  sem_setor_novos: number;
  meta_reciclagem_pct: number;
  nota_setor: string;
  /** Cobertura por setor — oculto até haver quadro RH. */
  cobertura_disponivel: false;
};

export type FiltrosTreinamentos = {
  ano: number | "todos";
  setor: string | "todos";
  reciclagem: "todos" | "sim" | "nao" | "na";
  busca: string;
};
