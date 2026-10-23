/** Regras puras do valor do parque (factory/parque-auto): fonte, data e itens sem valor. */
import { parseBrNumber } from "./dates";
import type { EquipamentoItem } from "./types";

export const PARQUE_ALERTA_DIAS = 30;
const DIA_MS = 86_400_000;

export type FonteParque = "ao-vivo" | "gravado" | null;

/** P2: soma ao vivo primeiro; o valor gravado só como reserva. P6: 0/ausente => null. */
export function escolherValorParque(opts: { aoVivo: number | null | undefined; gravado: number | null | undefined }): {
  valor: number | null;
  fonte: FonteParque;
} {
  if (opts.aoVivo != null && opts.aoVivo > 0) return { valor: opts.aoVivo, fonte: "ao-vivo" };
  if (opts.gravado != null && opts.gravado > 0) return { valor: opts.gravado, fonte: "gravado" };
  return { valor: null, fonte: null };
}

/** dd/mm/aaaa no fuso de São Paulo. */
export function formatDataBRT(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Competência YYYY-MM em BRT (base para uma futura regra mensal). */
export function competenciaBRT(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
}

/** P3: texto da data e alerta acima de 30 dias. */
export function frescorParque(atualizadoEm: string | null | undefined, agoraMs: number) {
  if (!atualizadoEm) return { texto: "Valor do parque sem data de atualização", dias: null as number | null, desatualizado: true };
  const data = formatDataBRT(atualizadoEm);
  if (!data) return { texto: "Valor do parque sem data de atualização", dias: null as number | null, desatualizado: true };
  const dias = Math.floor((agoraMs - Date.parse(atualizadoEm)) / DIA_MS);
  return { texto: `Valor do parque atualizado em ${data}`, dias, desatualizado: dias > PARQUE_ALERTA_DIAS };
}

export function temValorSubstituicao(item: EquipamentoItem): boolean {
  const n = parseBrNumber(item.ValorDeSubstituicao);
  return n != null && n > 0;
}

/** Equipamentos ativos sem valor de substituição (fora da soma). */
export function equipamentosSemValor(items: EquipamentoItem[]): EquipamentoItem[] {
  return items.filter((i) => !temValorSubstituicao(i)).sort((a, b) => String(a.Tag).localeCompare(String(b.Tag), "pt-BR"));
}

export type ParqueRegra = "unico" | "mensal";

/** Regra do denominador (D-I7). Config only: PARQUE_REGRA=unico|mensal; padrão "unico". */
export function parqueRegraDe(v: string | null | undefined): ParqueRegra {
  return v?.trim().toLowerCase() === "mensal" ? "mensal" : "unico";
}

/**
 * Valor do parque para a competência YYYY-MM.
 * unico: o mesmo valor vigente para todos os meses.
 * mensal: foto do mês; sem foto, a mais recente anterior; sem nenhuma anterior, o valor único.
 */
export function valorParqueDoMes(
  regra: ParqueRegra,
  unico: number | null,
  mensal: Array<{ competencia: string; valor: number }>,
  competencia: string,
): number | null {
  if (regra === "unico") return unico;
  let melhor: { competencia: string; valor: number } | null = null;
  for (const m of mensal) {
    if (m.competencia <= competencia && m.valor > 0 && (!melhor || m.competencia > melhor.competencia)) melhor = m;
  }
  return melhor?.valor ?? unico;
}
