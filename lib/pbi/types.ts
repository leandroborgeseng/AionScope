export type CronogramaItem = {
  Empresa: string;
  CentroDeCusto: string;
  Setor: string;
  Equipamento: string;
  Fabricante: string;
  Modelo: string;
  Tag: string;
  PlanoDeManutencao: string;
  TipoDeManutencao: string;
  DataDaUltima: string;
  ProximaRealizacao: string;
  Perioridicade: string;
  Observacao: string;
};

export type TipoManutencaoItem = {
  Id: number;
  Descricao: string;
  Ativo: string;
  TipoPreventivo: string;
  TipoCorretiva: string;
};

export type OsAnaliticoItem = {
  CodigoSerialOS: number;
  GrupoEmpresa?: string;
  Empresa: string;
  OS: string;
  Oficina: string;
  MatriculaResponsavel?: string;
  Responsavel: string;
  Tipo: string;
  Prioridade: string;
  TipoDeManutencao: string;
  SituacaoDaOS: string;
  ComplexidadeDaOS: string;
  PlanoDeManutencao: string;
  Tag: string;
  CodigoExtra?: string;
  Patrimonio?: string;
  NumeroDeSerie?: string;
  Equipamento: string;
  Modelo: string;
  Fabricante: string;
  Setor: string;
  CentroDeCusto: string;
  Abertura: string;
  Parada: string;
  Funcionamento: string;
  Fechamento: string;
  Ocorrencia: string;
  Causa: string;
  Pendencia: string;
  PendenciaAberta: string;
  PendenciaAbertaEm?: string;
  ObservacaoDaPendencia?: string;
  PrazoDeEncerramentoPendencia?: string;
  PrazoDeEncerramentoOs: string;
  Servico: string;
  HorasTrabalhadas: string;
  MatriculaResolvedor?: string;
  TecnicoResolvedor: string;
  Assistencia?: string;
  Custo: string;
  Deslocamento: string;
  ObservacaoDaOS?: string;
  MotivoCancelamentoOS?: string;
  ObservacaoMotivoCancelamentoOS?: string;
  SLAAtendimento: string;
  Status: string;
  DataLimiteDoAtendimento: string;
  DataDoAtendimento: string;
  DataLimiteDaSolucao: string;
  DataDaSolucao: string;
  NumeroDaRequisicao?: string;
  Requisitante?: string;
  ObservacaoDaRequisicao?: string;
  Avaliacao: string;
  ObservacaoDaAvaliacao?: string;
  MotivoDaAvaliacao?: string;
  Seguro: string;
  LiberadoParaUso: string;
  PrazoAtendimento?: string;
  PrazoEncerramento?: string;
  JustificativaEncerramento: string;
  AbertaPor?: string;
};

export type OsResumidaItem = {
  CodigoSerialOS: number;
  Empresa: string;
  OS: string;
  Oficina: string;
  MatriculaResponsavel?: string;
  Responsavel: string;
  Tipo: string;
  Prioridade: string;
  TipoDeManutencao: string;
  SituacaoDaOS: string;
  ComplexidadeDaOS: string;
  PlanoDeManutencao: string;
  Equipamento: string;
  Modelo: string;
  Fabricante: string;
  Setor: string;
  Abertura: string;
  Fechamento: string;
  Ocorrencia: string;
  Causa: string;
  Status: string;
  DataDaSolucao: string;
  PendenciaAberta: string;
  DataAberturaPendencia: string;
  DataConclusaoPendencia: string;
  ObservacaoPendencia: string;
};

export type OsResumidaResponse = {
  TotalItens: number;
  Itens: OsResumidaItem[];
};

export type EquipamentoItem = {
  Id: number;
  Tag: string;
  NSerie: string;
  Patrimonio: string;
  Equipamento: string;
  Modelo: string;
  Fabricante: string;
  Criticidade: string;
  Prioridade: string;
  RazaoSocial?: string;
  CodigoCliente?: string;
  Cliente: string;
  Setor: string;
  GrupoDeSetores: string;
  Endereco?: string;
  UF?: string;
  Bairro?: string;
  Cidade?: string;
  Cep?: string;
  CentroDeCusto: string;
  DataDeAquisicao: string;
  ValorDeAquisicao: string;
  NotaFiscal?: string;
  ValorDeSubstituicao: string;
  DataDeFabricacao: string;
  "DataDeInstalação": string;
  "DataDeInativação": string;
  DataDeGarantia: string;
  DataDeGarantiaEstendida: string;
  ComponenteDe?: string;
  RegistroAnvisa: string;
  ValidadeDoRegistroAnvisa: string;
  Situacao: string;
  Status: string;
  EndOfLife: string;
  EndOfService: string;
  Fornecedor: string;
  Observacao?: string;
  GarantiaExterna: string;
  DataDeCadastro: string;
  Tipo?: string;
  TipoEquipamento?: string;
  TipoDeEquipamento?: string;
  GrupoFamilia?: string;
  Familia?: string;
  Classificacao?: string;
  Categoria?: string;
};

export type TmefItem = {
  Empresa: string;
  CentroDeCusto: string;
  Tag: string;
  Equipamento: string;
  Setor: string;
  Modelo: string;
  Fabricante: string;
  NumeroDeSerie: string;
  Patrimonio: string;
  Os: string;
  MTBF: string;
};

export type DisponibilidadeMensal = {
  Ano: number;
  Mes: number;
  DisponibilidadePercentual: number;
  TMPR: number;
  TMEF: number;
  DiasParado: number;
  DiasFuncionando: number;
};

export type DisponibilidadeItem = {
  EmpresaId: number;
  EquipamentoId: number;
  Tag: string;
  EquipamentoDescricaoCompleta: string;
  PlanoDeDescricaoId?: number;
  PlanoDeDescricao: string;
  ModeloId?: number;
  ModeloDescricao: string;
  FabricanteId?: number;
  Fabricante: string;
  Criticidade: string;
  SetorId?: number;
  SetorCodigo?: string;
  SetorDescricao: string;
  CaminhoSetor: string;
  Componente: boolean;
  NumeroDeSerie: string;
  Patrimonio: string;
  CodigoExtra?: string;
  QuantidadeOSParadaNoPeriodo: number;
  PossuiOSParadaSemFuncionamento: boolean;
  DisponibilidadePercentualPeriodo: number;
  CentrosDeCusto: string;
  CentrosDeCustoIds?: string;
  TMEF?: number;
  TMPR?: number;
  DiasDoPeriodo: number;
  DiasParado?: number;
  DiasFuncionando?: number;
  DisponibilidadeMensal: DisponibilidadeMensal[];
};

export type MonitorReacaoItem = {
  Empresa: string;
  Cliente: string;
  Setor: string;
  Numero: string;
  Observacao: string;
  Tag: string;
  Equipamento: string;
  Requisitante: string;
  TipoManutencao: string;
  Prioridade: string;
  DataHoraCriacao: string;
  TempoDecorrido: string;
  PrazoParaAtendimento: string;
};

export type MonitorAtendimentoItem = {
  Empresa: string;
  Cliente: string;
  Setor: string;
  NumeroOS: string;
  ObservacaoDaRequisicao: string;
  Tag: string;
  Equipamento: string;
  Requisitante: string;
  TipoManutencao: string;
  Prioridade: string;
  DataHoraAbertura: string;
  TempoDecorrido: string;
  PrazoParaAtendimento: string;
};

export type AnexoEquipamentoItem = {
  EquipamentoId: number;
  Tag: string;
  Anexo: string;
  TipoAnexoId?: number;
  TipoAnexo?: string;
  LinkAnexo: string;
  DataHoraInclusao: string;
};

export type AnexoOsItem = {
  OSId: number;
  CodigoOS: string;
  Anexo: string;
  TipoAnexoId?: number;
  TipoAnexo?: string;
  LinkAnexo: string;
  DataHoraInclusao: string;
};

export type Lookups = {
  empresas: string[];
  setores: string[];
  oficinas: string[];
  criticidades: string[];
  fabricantes: string[];
  modelos: string[];
  tiposManutencao: TipoManutencaoItem[];
  oficinaEndpointLiberado: boolean;
};

export type PbiSuccess<T> = {
  ok: true;
  data: T;
  total?: number;
  cachedAt: string;
  disabled?: false;
};

export type PbiFailure = {
  ok: false;
  status: number | null;
  message: string;
  disabled?: boolean;
  pendingReason?: string;
  cachedAt?: string;
};

export type PbiResult<T> = PbiSuccess<T> | PbiFailure;

export type CronogramaStatus = "em_dia" | "vence_em" | "atrasado" | "sem_data";

export type CronogramaView = CronogramaItem & {
  proximaDate: string | null;
  diasParaVencer: number | null;
  statusCalculado: CronogramaStatus;
  statusLabel: string;
};
