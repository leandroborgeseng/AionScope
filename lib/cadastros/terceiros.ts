import type { EquipamentoItem } from "@/lib/pbi/types";
import type { EquipamentoTerceiroInput, EquipamentoTerceiroLocal } from "./types";

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
 * Identificador do “terceiro” para filtro dinâmico (valores distintos dos registros):
 * 1. Sufixo de Situação após "TERCEIRO - …" (padrão real na API HSJ)
 * 2. Fornecedor da API (quando preenchido)
 * 3. Médico/responsável do cadastro local
 */
export function labelTerceiro(opts: {
  situacao?: string | null;
  fornecedorApi?: string | null;
  medicoResponsavel?: string | null;
}): string {
  const fromSit = terceiroFromSituacao(opts.situacao);
  if (fromSit) return fromSit;
  const fornecedor = (opts.fornecedorApi ?? "").trim();
  if (fornecedor) return fornecedor;
  return (opts.medicoResponsavel ?? "").trim();
}

export function normalizeTerceiroInput(
  input: EquipamentoTerceiroInput,
): EquipamentoTerceiroInput | { error: string } {
  const tag = (input.tag ?? "").trim();
  if (!tag) return { error: "Tag é obrigatória." };

  return {
    tag,
    descricao: (input.descricao ?? "").trim() || undefined,
    medicoResponsavel: (input.medicoResponsavel ?? "").trim() || undefined,
    setor: (input.setor ?? "").trim() || undefined,
    observacao: (input.observacao ?? "").trim() || undefined,
    ativo: input.ativo !== false,
  };
}

export type TerceiroListRow = {
  key: string;
  tag: string;
  descricao: string;
  setor: string;
  /** Valor usado no filtro “por terceiro”. */
  terceiro: string;
  fornecedor: string;
  medicoResponsavel: string;
  valorSubstituicao: string;
  situacao: string;
  status: string;
  api: EquipamentoItem | null;
  local: EquipamentoTerceiroLocal | null;
  noApi: boolean;
  noLocal: boolean;
};

export function mergeTerceirosLista(
  apiItems: EquipamentoItem[],
  locais: EquipamentoTerceiroLocal[],
): TerceiroListRow[] {
  const terceirosApi = filterEquipamentosTerceiro(apiItems);
  const byTag = new Map<string, EquipamentoItem>();
  for (const item of terceirosApi) {
    const t = item.Tag?.trim();
    if (t) byTag.set(t.toLocaleUpperCase("pt-BR"), item);
  }

  const localByTag = new Map<string, EquipamentoTerceiroLocal>();
  for (const loc of locais) {
    const t = loc.tag?.trim();
    if (t) localByTag.set(t.toLocaleUpperCase("pt-BR"), loc);
  }

  const keys = new Set([...byTag.keys(), ...localByTag.keys()]);
  const rows: TerceiroListRow[] = [];

  for (const key of keys) {
    const api = byTag.get(key) ?? null;
    const local = localByTag.get(key) ?? null;
    const tag = api?.Tag?.trim() || local?.tag || key;
    const fornecedor = (api?.Fornecedor ?? "").trim();
    const medico = (local?.medicoResponsavel ?? "").trim();
    const situacao = (api?.Situacao ?? "").trim();
    rows.push({
      key: `t-${key}`,
      tag,
      descricao: (api?.Equipamento || local?.descricao || "").trim() || "—",
      setor: (api?.Setor || local?.setor || "").trim() || "—",
      terceiro: labelTerceiro({
        situacao,
        fornecedorApi: fornecedor,
        medicoResponsavel: medico,
      }),
      fornecedor: fornecedor || "—",
      medicoResponsavel: medico || "—",
      valorSubstituicao: api?.ValorDeSubstituicao ?? "",
      situacao: situacao || (local ? "Local" : "—"),
      status: api?.Status?.trim() || (local?.ativo === false ? "Inativo" : "—"),
      api,
      local,
      noApi: !api,
      noLocal: !local,
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
