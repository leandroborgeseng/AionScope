/**
 * Contrato do card de indicador na Sala TV (/sala/indicadores) — esboço UX 23/10/2026.
 * Puro: sem React/banco. Cada indicador do catálogo produz um ResumoIndicador.
 */
import {
  META_ANUAL_PCT,
  formatPctParque,
  type CustoParqueAno,
} from "@/lib/pbi/custo-manutencao-parque";
import { formatBRL } from "@/lib/pbi/indicators";

export type StatusCard = "dentro" | "acima" | "sem-dados";

export type PontoMensal = {
  /** valor do mês na unidade do indicador; null = sem dado (futuro ou indisponível) */
  valor: number | null;
  meta: number | null;
  futuro: boolean;
};

export type ResumoIndicador = {
  id: string;
  titulo: string;
  href: string;
  rotuloPeriodo: string;
  /** número principal já formatado ("2,97%" ou "—") */
  valorPrincipal: string;
  valorPrincipalNum: number | null;
  status: StatusCard;
  /** linha de apoio (ex.: R$ acumulado até outubro) */
  valorSecundario: string | null;
  /** valor do mês corrente formatado (D-SI1) */
  valorMes: string | null;
  /** "Meta até out: 3,33% · Teto anual: 4,00%" */
  meta: string | null;
  serieMensal: PontoMensal[];
  teto: number | null;
  /** frase quando sem dados (ex.: "Valor do parque indisponível") */
  motivoSemDados: string | null;
};

const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Estado efetivo do KPI de custo/parque: o MESMO para a página do indicador e para o card da Sala (I2/I3). */
export function estadoCustoParque(ind: CustoParqueAno, faltandoExtra: string[] = []) {
  const faltando = [...ind.faltando, ...faltandoExtra];
  const semDados = faltando.length > 0;
  const atual = ind.atual;
  return {
    faltando,
    semDados,
    atual,
    pctAtual: semDados ? null : (atual?.pctAcumulado ?? null),
    statusAtual: semDados ? null : (atual?.status ?? null),
  };
}

export const HREF_CUSTO_PARQUE = "/indicadores/custo-manutencao-parque";

/** Resumo do card "Custo de manutenção do parque" a partir do resultado de buildCustoParqueAno. */
export function resumoCustoParque(ind: CustoParqueAno, faltandoExtra: string[] = []): ResumoIndicador {
  const e = estadoCustoParque(ind, faltandoExtra);
  const mes = e.atual?.month ?? 11;
  const status: StatusCard = e.statusAtual === "Dentro" ? "dentro" : e.statusAtual === "Acima" ? "acima" : "sem-dados";
  return {
    id: "custo-manutencao-parque",
    titulo: "Custo de manutenção do parque",
    href: `${HREF_CUSTO_PARQUE}?ano=${ind.year}`,
    rotuloPeriodo: String(ind.year),
    valorPrincipal: formatPctParque(e.pctAtual),
    valorPrincipalNum: e.pctAtual,
    status,
    valorSecundario: e.semDados || !e.atual ? null : `${formatBRL(e.atual.acumulado)} acumulado até ${MESES_LONGOS[mes]}`,
    valorMes: e.semDados || !e.atual ? null : `${MESES_CURTOS[mes]}: ${formatBRL(e.atual.despesa)} no mês`,
    meta: `Meta até ${MESES_CURTOS[mes]}: ${formatPctParque(e.atual?.metaPct ?? null)} · Teto anual: ${formatPctParque(META_ANUAL_PCT)}`,
    serieMensal: ind.months.map((m) => ({
      valor: e.semDados || m.futuro ? null : m.pctAcumulado,
      meta: m.metaPct,
      futuro: m.futuro,
    })),
    teto: META_ANUAL_PCT,
    motivoSemDados: e.semDados ? (ind.valorParque == null ? "Valor do parque indisponível" : `Não foi possível calcular: ${e.faltando.join("; ")}`) : null,
  };
}

export function rotuloStatusCard(s: StatusCard) {
  return s === "dentro" ? "✓ Dentro da meta" : s === "acima" ? "▲ Acima da meta" : "Sem dados";
}

export function ariaLabelCard(r: ResumoIndicador) {
  const st = r.status === "dentro" ? "dentro da meta" : r.status === "acima" ? "acima da meta" : "sem dados";
  return `${r.titulo}: ${r.status === "sem-dados" ? "sem dados" : `${r.valorPrincipal}, ${st}`}. Abrir detalhe`;
}

/** Grade (I13): 1 → tela cheia; 2–4 → 2×2; 5–6 → 3×2; >6 → páginas de 6 (3×2), sem encolher a fonte. */
export function gradeIndicadores(n: number) {
  if (n <= 1) return { colunas: 1, linhas: 1, porPagina: 1, paginas: n <= 0 ? 0 : 1, ampliado: true };
  if (n <= 4) return { colunas: 2, linhas: 2, porPagina: 4, paginas: 1, ampliado: false };
  return { colunas: 3, linhas: 2, porPagina: 6, paginas: Math.ceil(n / 6), ampliado: false };
}

/** Ordem do catálogo, com "acima da meta" primeiro (esboço UX §2). Estável. */
export function ordenarCards<T extends { status: StatusCard }>(cards: T[]): T[] {
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.status === "acima" ? 0 : 1) - (b.c.status === "acima" ? 0 : 1) || a.i - b.i)
    .map((x) => x.c);
}

export function paginar<T>(itens: T[], pagina: number, porPagina: number): T[] {
  if (porPagina <= 0) return [];
  return itens.slice(pagina * porPagina, pagina * porPagina + porPagina);
}

/** "HH:MM" no fuso de São Paulo, independente do TZ do processo. */
export function horaLeitura(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
}

export type EstadoCard =
  | { tipo: "carregando" }
  | { tipo: "ok"; resumo: ResumoIndicador }
  | { tipo: "erro"; ultimo: ResumoIndicador | null; ultimaLeitura: number | null; mensagem: string };

/** Decide o que o card mostra (I6/I14): erro mantém o último valor bom esmaecido + horário da última leitura. */
export function estadoCard(opts: {
  carregando: boolean;
  erro: string | null;
  resumo: ResumoIndicador | null;
  ultimo: { resumo: ResumoIndicador; em: number } | null;
}): EstadoCard {
  if (opts.erro) return { tipo: "erro", ultimo: opts.ultimo?.resumo ?? null, ultimaLeitura: opts.ultimo?.em ?? null, mensagem: opts.erro };
  if (opts.carregando || !opts.resumo) return opts.ultimo ? { tipo: "ok", resumo: opts.ultimo.resumo } : { tipo: "carregando" };
  return { tipo: "ok", resumo: opts.resumo };
}
