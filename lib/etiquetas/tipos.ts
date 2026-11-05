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
    chip: "Manut. Prev.",
    chipLabel: "Manut. Preventiva",
    oficinaEquals: "PREVENTIVA EQUIPAMENTOS",
    oficinaLabel: "PREVENTIVA EQUIPAMENTOS",
  },
  {
    id: "calibracao",
    chip: "Cal",
    chipLabel: "Calibração",
    oficinaEquals: "CALIBRACAO DE EQUIPAMENTOS",
    oficinaLabel: "CALIBRAÇÃO DE EQUIPAMENTOS",
  },
  {
    id: "tse",
    chip: "Teste Seg.",
    chipLabel: "Teste Seg. Elétrica",
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
  /** Planos com OS aberta ou fechada (reimpressão) neste equipamento (ordem PREV → CAL → TSE). */
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
  /**
   * Inclui OS fechadas (não canceladas) pelo mês de Fechamento/DataDaSolucao.
   * Default: ligado quando há `monthKeys`; sem mês, fechadas ficam de fora (R2).
   * Só leitura — não reabre OS no Effort.
   */
  incluirFechadas?: boolean;
};

export type LabelSizeId = "50x30" | "40x30";

export type LabelSizePx = {
  id: LabelSizeId;
  label: string;
  wMm: number;
  hMm: number;
  /** Geometria B1 @ 203 dpi (largura ≤ cabeçote 384 pt). */
  wPx: number;
  hPx: number;
  /** Deslocamento vertical na impressão (dy > 0 desce). */
  offsetYPx: number;
  /**
   * Deslocamento horizontal na impressão (dx < 0 puxa à esquerda).
   * Compensa margem branca à esquerda / corte à direita na B1.
   */
  offsetXPx: number;
};

/**
 * Tamanhos de etiqueta para Niimbot B1 (203 dpi = 8 pt/mm).
 * Kit de desenho 50×30 = 400×240 pt; bitmap de impressão B1 = **384×240**
 * (largura do cabeçote térmico — 400 px estourava e cortava a direita).
 */
export const LABEL_SIZES_B1: readonly LabelSizePx[] = [
  {
    id: "50x30",
    label: "50 × 30 mm",
    wMm: 50,
    hMm: 30,
    wPx: 384,
    hPx: 240,
    offsetYPx: 4,
    /** Ajuste fino horizontal (dx < 0 puxa à esquerda). 0 = alinhado ao cabeçote. */
    offsetXPx: 0,
  },
  {
    id: "40x30",
    label: "40 × 30 mm",
    wMm: 40,
    hMm: 30,
    wPx: 320,
    hPx: 240,
    offsetYPx: 4,
    offsetXPx: 0,
  },
] as const;

/** Coordenadas do kit oficial (LEIA-ME / etiqueta-aion.html). */
export const LABEL_KIT_DESIGN_PX = { w: 400, h: 240 } as const;

export type LabelRenderInput = {
  brand: string;
  site: string;
  telefone: string;
  logoUrl: string;
  tag: string;
  equipamento: string;
  /** Nome do setor na etiqueta; vazio = não desenha a linha (ET3/E9). */
  setor: string;
  planos: PlanoEtiqueta[];
  realizacaoLabel: string;
  proximaLabel: string;
  qrUrl: string;
  size: LabelSizePx;
};

/** Texto no filtro/lista quando a OS/cadastro não tem setor (E8). Na etiqueta a linha some. */
export const SETOR_VAZIO_LABEL = "Sem setor";

export function setorListaLabel(setor: string | null | undefined): string {
  const s = (setor ?? "").trim();
  return s || SETOR_VAZIO_LABEL;
}

/** Setor para o canvas: vazio se não houver (não imprime "Sem setor"). */
export function setorParaEtiqueta(setor: string | null | undefined): string {
  const s = (setor ?? "").trim();
  if (!s || s === SETOR_VAZIO_LABEL) return "";
  return s;
}

/** Truncamento da linha de setor na B1 (~28 chars + …). */
export const SETOR_ETIQUETA_MAX_CHARS = 28;

export function truncateSetorEtiqueta(setor: string, max = SETOR_ETIQUETA_MAX_CHARS): string {
  const t = setor.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Ordenação natural de Tag (TAG-2 antes de TAG-10), crescente pt-BR. */
export function compareTagNatural(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

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
