import { parseBrNumber } from "@/lib/pbi/dates";
import type { EquipamentoItem } from "@/lib/pbi/types";

/** Situação começa com TERCEIRO (ex.: "TERCEIRO", "TERCEIRO - SODEXO"). */
export function isSituacaoTerceiro(situacao: string | null | undefined) {
  const v = (situacao ?? "").trim().toLocaleUpperCase("pt-BR");
  return v === "TERCEIRO" || v.startsWith("TERCEIRO ") || v.startsWith("TERCEIRO-");
}

/**
 * Nome do terceiro embutido em Situação ("TERCEIRO - AION …") ou vazio se for só "TERCEIRO".
 */
export function terceiroFromSituacao(situacao: string | null | undefined): string {
  const raw = (situacao ?? "").trim();
  if (!isSituacaoTerceiro(raw)) return "";
  const stripped = raw.replace(/^TERCEIRO\s*[-–—:]?\s*/i, "").trim();
  return stripped;
}

export function filterEquipamentosTerceiro(items: EquipamentoItem[]) {
  return items.filter((item) => isSituacaoTerceiro(item.Situacao));
}

/**
 * Identificador do “terceiro” para filtro dinâmico:
 * 1. Sufixo de Situação após "TERCEIRO - …"
 * 2. Fornecedor da API (quando preenchido)
 */
export function labelTerceiro(opts: {
  situacao?: string | null;
  fornecedorApi?: string | null;
}): string {
  const fromSit = terceiroFromSituacao(opts.situacao);
  if (fromSit) return fromSit;
  return (opts.fornecedorApi ?? "").trim();
}

export type TerceiroListRow = {
  key: string;
  tag: string;
  descricao: string;
  setor: string;
  /** Valor usado no filtro “por terceiro”. */
  terceiro: string;
  fornecedor: string;
  valorSubstituicao: string;
  situacao: string;
  status: string;
  api: EquipamentoItem;
};

/** Lista somente equipamentos PBI com Situação TERCEIRO… */
export function buildTerceirosLista(apiItems: EquipamentoItem[]): TerceiroListRow[] {
  const terceirosApi = filterEquipamentosTerceiro(apiItems);
  const rows: TerceiroListRow[] = [];

  for (const api of terceirosApi) {
    const tag = (api.Tag ?? "").trim();
    if (!tag) continue;
    const key = tag.toLocaleUpperCase("pt-BR");
    const fornecedor = (api.Fornecedor ?? "").trim();
    const situacao = (api.Situacao ?? "").trim();
    rows.push({
      key: `t-${key}`,
      tag,
      descricao: (api.Equipamento ?? "").trim() || "—",
      setor: (api.Setor ?? "").trim() || "—",
      terceiro: labelTerceiro({ situacao, fornecedorApi: fornecedor }),
      fornecedor: fornecedor || "—",
      valorSubstituicao: api.ValorDeSubstituicao ?? "",
      situacao: situacao || "—",
      status: (api.Status ?? "").trim() || "—",
      api,
    });
  }

  rows.sort((a, b) => a.tag.localeCompare(b.tag, "pt-BR", { sensitivity: "base" }));
  return rows;
}

export function distinctTerceiros(rows: TerceiroListRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row.terceiro.trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

export type TerceiroValorResumo = {
  /** Mesmo discriminador do filtro (sufixo Situação / Fornecedor). */
  terceiro: string;
  quantidade: number;
  /** Soma de ValorDeSubstituicao (> 0) do grupo. */
  somaSubstituicao: number;
};

export type TerceirosValorTotais = {
  porTerceiro: TerceiroValorResumo[];
  quantidadeTotal: number;
  somaSubstituicaoTotal: number;
};

/**
 * Agrupa equipamentos de terceiros pelo mesmo label do filtro e soma ValorDeSubstituicao.
 */
export function resumirValorSubstituicaoPorTerceiro(rows: TerceiroListRow[]): TerceirosValorTotais {
  const map = new Map<string, TerceiroValorResumo>();

  for (const row of rows) {
    const terceiro = row.terceiro.trim() || "(sem identificação)";
    const atual = map.get(terceiro) ?? {
      terceiro,
      quantidade: 0,
      somaSubstituicao: 0,
    };
    atual.quantidade += 1;
    const n = parseBrNumber(row.valorSubstituicao);
    if (n != null && n > 0) atual.somaSubstituicao += n;
    map.set(terceiro, atual);
  }

  const porTerceiro = [...map.values()].sort((a, b) => {
    if (b.somaSubstituicao !== a.somaSubstituicao) return b.somaSubstituicao - a.somaSubstituicao;
    return a.terceiro.localeCompare(b.terceiro, "pt-BR", { sensitivity: "base" });
  });

  return {
    porTerceiro,
    quantidadeTotal: rows.length,
    somaSubstituicaoTotal: porTerceiro.reduce((acc, g) => acc + g.somaSubstituicao, 0),
  };
}
