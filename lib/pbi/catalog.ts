export type PbiResource =
  | "cronograma"
  | "tipo-manutencao"
  | "os-analitico"
  | "os-resumida"
  | "equipamentos"
  | "tmef"
  | "tpm"
  | "disp-equipamento"
  | "disp-equipamento-mes"
  | "monitor-reacao"
  | "monitor-atendimento"
  | "anexos-equipamento"
  | "anexos-os"
  | "oficina"
  | "contratos";

export type PbiEndpoint = {
  resource: PbiResource;
  path: string;
  tokenEnv: string;
  authHeader: "X-API-KEY" | "API-KEY";
  pending: boolean;
  pendingReason?: string;
};

export const PBI_ENDPOINTS: Record<PbiResource, PbiEndpoint> = {
  cronograma: {
    resource: "cronograma",
    path: "/api/pbi/v1/cronograma",
    tokenEnv: "PBI_TOKEN_CRONOGRAMA",
    authHeader: "X-API-KEY",
    pending: false,
  },
  "tipo-manutencao": {
    resource: "tipo-manutencao",
    path: "/api/pbi/v1/tipo_manutencao",
    tokenEnv: "PBI_TOKEN_TIPO_MANUTENCAO",
    authHeader: "X-API-KEY",
    pending: false,
  },
  "os-analitico": {
    resource: "os-analitico",
    path: "/api/pbi/v1/listagem_analitica_das_os",
    tokenEnv: "PBI_TOKEN_OS_ANALITICO",
    authHeader: "X-API-KEY",
    pending: false,
  },
  "os-resumida": {
    resource: "os-resumida",
    path: "/api/pbi/v1/listagem_analitica_das_os_resumida",
    tokenEnv: "PBI_TOKEN_OS_ANALITICO_RESUMIDO",
    authHeader: "X-API-KEY",
    pending: false,
  },
  equipamentos: {
    resource: "equipamentos",
    path: "/api/pbi/v1/equipamentos",
    tokenEnv: "PBI_TOKEN_EQUIPAMENTOS",
    authHeader: "X-API-KEY",
    pending: false,
  },
  tmef: {
    resource: "tmef",
    path: "/api/pbi/v1/tempo_medio_entre_falhas",
    tokenEnv: "PBI_TOKEN_TMEF",
    authHeader: "X-API-KEY",
    pending: false,
  },
  tpm: {
    resource: "tpm",
    path: "/api/pbi/v1/tempo_de_parada_medio",
    tokenEnv: "PBI_TOKEN_TPM",
    authHeader: "X-API-KEY",
    pending: true,
    pendingReason: "Endpoint retornou 404 no último teste (recurso não encontrado).",
  },
  "disp-equipamento": {
    resource: "disp-equipamento",
    path: "/api/pbi/v1/disponibilidade_equipamento",
    tokenEnv: "PBI_TOKEN_DISP_EQUIPAMENTO",
    authHeader: "X-API-KEY",
    pending: true,
    pendingReason: "Endpoint retornou 404. Use a versão mês a mês, já liberada.",
  },
  "disp-equipamento-mes": {
    resource: "disp-equipamento-mes",
    path: "/api/pbi/v1/disponibilidade_equipamento_mes_a_mes",
    tokenEnv: "PBI_TOKEN_DISP_EQUIPAMENTO_MES",
    authHeader: "X-API-KEY",
    pending: false,
  },
  "monitor-reacao": {
    resource: "monitor-reacao",
    path: "/api/pbi/v1/monitor_reacao",
    tokenEnv: "PBI_TOKEN_MONITOR_REACAO",
    authHeader: "X-API-KEY",
    pending: false,
  },
  "monitor-atendimento": {
    resource: "monitor-atendimento",
    path: "/api/pbi/v1/monitor_atendimento",
    tokenEnv: "PBI_TOKEN_MONITOR_ATENDIMENTO",
    authHeader: "X-API-KEY",
    pending: false,
  },
  "anexos-equipamento": {
    resource: "anexos-equipamento",
    path: "/api/pbi/v1/anexos_equipamento",
    tokenEnv: "PBI_TOKEN_ANEXOS_EQUIPAMENTO",
    authHeader: "X-API-KEY",
    pending: false,
  },
  "anexos-os": {
    resource: "anexos-os",
    path: "/api/pbi/v1/anexos_os",
    tokenEnv: "PBI_TOKEN_ANEXOS_OS",
    authHeader: "X-API-KEY",
    pending: false,
  },
  oficina: {
    resource: "oficina",
    path: "/api/pbi/v1/oficina",
    tokenEnv: "PBI_TOKEN_OFICINA",
    authHeader: "API-KEY",
    pending: true,
    pendingReason: "Endpoint retornou 401. Oficinas são derivadas da listagem de OS.",
  },
  contratos: {
    resource: "contratos",
    path: "/api/pbi/v1/contratos",
    tokenEnv: "PBI_TOKEN_CONTRATOS",
    authHeader: "X-API-KEY",
    pending: false,
  },
};

export const PERIOD_ENUMS = [
  "Todos",
  "SemanaAtual",
  "MesAtual",
  "MesCorrente",
  "MesAnterior",
  "AnoAtual",
  "AnoCorrente",
  "AnoAnterior",
  "DoisAnosAtuais",
  "DoisAnosCorrente",
] as const;

export type PeriodoOs = (typeof PERIOD_ENUMS)[number];

export const TIPO_MANUTENCAO_ENUMS = ["Todos", "ApenasPreventiva", "ApenasCorretiva"] as const;
export type TipoManutencaoFiltro = (typeof TIPO_MANUTENCAO_ENUMS)[number];
