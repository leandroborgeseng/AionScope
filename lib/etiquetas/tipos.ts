import type { OsAnaliticoItem } from "@/lib/pbi/types";

/** Tipos de plano que geram etiqueta (oficinas de Preventiva / Cal / TSE). */
export type PlanoEtiqueta = "preventiva" | "calibracao" | "tse";

export const PLANOS_ETIQUETA: readonly {
  id: PlanoEtiqueta;
  chip: string;
  chipLabel: string;
  oficinaEquals: string;
  oficinaLabel: string;
}[] = [
  {
    id: "preventiva",
    chip: "PREV",
    chipLabel: "Preventiva",
    oficinaEquals: "PREVENTIVA EQUIPAMENTOS",
    oficinaLabel: "PREVENTIVA EQUIPAMENTOS",
  },
  {
    id: "calibracao",
    chip: "CAL",
    chipLabel: "Calibração",
    oficinaEquals: "CALIBRACAO DE EQUIPAMENTOS",
    oficinaLabel: "CALIBRAÇÃO DE EQUIPAMENTOS",
  },
  {
    id: "tse",
    chip: "TSE",
    chipLabel: "Segurança elétrica",
    oficinaEquals: "SEGURANCA ELETRICA",
    oficinaLabel: "SEGURANÇA ELÉTRICA",
  },
] as const;

export type OsPlanoResumo = {
  os: string;
  codigoSerial: number;
  oficina: string;
  plano: PlanoEtiqueta;
  abertura: string;
  prazoEncerramento: string;
  dataLimiteSolucao: string;
  situacao: string;
};

export type EtiquetaEquipamento = {
  tag: string;
  equipamento: string;
  modelo: string;
  fabricante: string;
  setor: string;
  centroDeCusto: string;
  /** Planos com OS aberta neste equipamento (ordem PREV → CAL → TSE). */
  planos: PlanoEtiqueta[];
  /** Data de realização (Abertura da OS mais antiga entre os planos). */
  realizacao: Date | null;
  /** Próxima realização (prazo OS / cronograma / estimativa). */
  proxima: Date | null;
  proximaFonte: "prazo-os" | "limite-solucao" | "cronograma" | "estimativa" | "nenhuma";
  osPorPlano: Partial<Record<PlanoEtiqueta, OsPlanoResumo>>;
  /** Path estável da ficha vida (sem origin). */
  fichaVidaPath: string;
};

export type CronogramaProximaHint = {
  tag: string;
  proxima: Date | null;
};

export type AgregarEtiquetasOptions = {
  /** Chaves `YYYY-MM`. Vazio = todas as OS abertas das oficinas de plano. */
  monthKeys?: string[];
  /** Filtrar quais tipos entram. Default: todos. */
  planos?: PlanoEtiqueta[];
  /** Próxima do cronograma por Tag (opcional). */
  cronogramaProximas?: CronogramaProximaHint[];
};

export type LabelSizeId = "50x30" | "40x30";

export type LabelSizePx = {
  id: LabelSizeId;
  label: string;
  wMm: number;
  hMm: number;
  /** Geometria B1 @ 203 dpi */
  wPx: number;
  hPx: number;
  offsetYPx: number;
};

/** Tamanhos de etiqueta para Niimbot B1 (203 dpi). */
export const LABEL_SIZES_B1: readonly LabelSizePx[] = [
  {
    id: "50x30",
    label: "50 × 30 mm",
    wMm: 50,
    hMm: 30,
    wPx: 384,
    hPx: 240,
    offsetYPx: 4,
  },
  {
    id: "40x30",
    label: "40 × 30 mm",
    wMm: 40,
    hMm: 30,
    wPx: 320,
    hPx: 240,
    offsetYPx: 4,
  },
] as const;

export type LabelRenderInput = {
  brand: string;
  site: string;
  telefone: string;
  logoUrl: string;
  tag: string;
  equipamento: string;
  planos: PlanoEtiqueta[];
  realizacaoLabel: string;
  proximaLabel: string;
  qrUrl: string;
  size: LabelSizePx;
};

/** Subconjunto de OS usado nos testes / agregador. */
export type OsParaEtiqueta = Pick<
  OsAnaliticoItem,
  | "CodigoSerialOS"
  | "OS"
  | "Oficina"
  | "Tag"
  | "Equipamento"
  | "Modelo"
  | "Fabricante"
  | "Setor"
  | "CentroDeCusto"
  | "Abertura"
  | "Fechamento"
  | "DataDaSolucao"
  | "SituacaoDaOS"
  | "PrazoDeEncerramentoOs"
  | "DataLimiteDaSolucao"
>;
