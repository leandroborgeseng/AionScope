export type TelaSala =
  | "agora"
  | "fluxo"
  | "envelhecimento"
  | "compras"
  | "programadas"
  | "ciclo-de-vida"
  | "indicadores"
  | "processos";

export const TELAS_SALA: Array<{ id: TelaSala; label: string; rotulo: string; titulo: string }> = [
  { id: "agora", label: "Agora", rotulo: "SITUAÇÃO OPERACIONAL", titulo: "Agora" },
  { id: "fluxo", label: "Fluxo OS", rotulo: "P01 · CORRETIVA", titulo: "Fluxo da OS" },
  { id: "envelhecimento", label: "Envelhecimento", rotulo: "OS ABERTAS", titulo: "Envelhecimento" },
  { id: "compras", label: "Compras", rotulo: "PEDIDOS POR E-MAIL", titulo: "Compras" },
  { id: "programadas", label: "Programadas", rotulo: "P02 · PLANO DO MÊS", titulo: "Programadas" },
  { id: "ciclo-de-vida", label: "Ciclo de vida", rotulo: "P03 · PARQUE", titulo: "Ciclo de vida" },
  { id: "indicadores", label: "Indicadores", rotulo: "MÊS E SEIS MESES", titulo: "Indicadores" },
  { id: "processos", label: "Processos", rotulo: "MAPEAMENTO EC", titulo: "Processos" },
];

export type FonteBloco = "api" | "manual" | "sem-dados";

export type Bloco = {
  id: string;
  fonte: FonteBloco;
  erro?: string;
};

export type LinhaFila = {
  os: string;
  equipamento: string;
  tag: string;
  setor: string;
  situacao: string;
  criticidade: string;
  parado: boolean;
  compra: boolean;
  idade: string;
};

export type SalaSnapshot = {
  atualizadoEm: string;
  relogio: string;
  plantao: boolean;
  plantaoTexto: string;
  segundos: number;
  sequencia: TelaSala[];
  alertas: Array<{ os: string; motivo: string }>;
  blocos: Bloco[];
  agora: {
    grave: number;
    foraDoPrazo: number;
    semPrimeiro: number;
    parados: number | null;
    plano: Array<{ tipo: string; faltam: number | null; percentual: number | null }>;
    planoAviso: string;
    paradosMaisTempo: Array<{ nome: string; setor: string; tempo: string }>;
    fila: LinhaFila[];
    filaOcultas: number;
    hojeAbertas: number;
    hojeFechadas: number;
    semanaAbertas: number;
    semanaFechadas: number;
    primeiroNoPrazo30d: number | null;
    tpm30d: number | null;
    disponibilidadeCriticos: number | null;
  };
  fluxo: {
    entraramHoje: number;
    etapas: Array<{ etapa: string; quantidade: number; maisAntiga: string; exemplos: string[] }>;
    encerradasHoje: number;
    entraram: Array<{ hora: string; os: string; equipamento: string; setor: string; prioridade: string; situacao: string }>;
    entraramOcultas: number;
    equipeAviso: string;
  };
  envelhecimento: {
    faixas: Array<{ id: string; label: string; total: number; partes: Array<{ etapa: string; quantidade: number }> }>;
    maisAntigas: Array<{ os: string; equipamento: string; setor: string; idade: string; semMovimento: string; etapa: string }>;
    idadeMediaDias: number | null;
    aguardandoTerceiros: number;
    semMovimentoMais7: number | null;
    pendenciaSemMotivo: number;
  };
  compras: {
    aviso: string;
    pedidos: [];
  };
  programadas: {
    aviso: string;
  };
  ciclo: {
    trilha: Array<{ etapa: string; quantidade: number | null }>;
    histograma: Array<{ faixa: string; emVida: number; alem: number }>;
    fimDeVida: Array<{ tag: string; equipamento: string; pontos: number; criterios: string }>;
    avisoDescontinuado: string;
    maisAntigos: Array<{ tag: string; equipamento: string; idade: string; fim: string }>;
  };
  indicadores: {
    meses: string[];
    cartoes: Array<{
      titulo: string;
      valor: string;
      detalhe: string;
      serie: Array<number | null>;
      fonte: FonteBloco;
    }>;
  };
  processos: {
    itens: Array<{ id: string; nome: string; quantidade: string; fonte: FonteBloco }>;
    foraDoHorario: number;
    melhorias: string;
  };
};
