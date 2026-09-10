/**
 * Gap: equipamentos ativos sem Preventiva no cronograma.
 * Regra QMentum: Preventiva é obrigatória; Calibração e TSE são informativos.
 * Classificação loose = TipoDeManutencao OU PlanoDeManutencao (Tipo vazio não zera cobertura).
 */
import { classifyPlanoEc, type PlanoEcTipo } from "./indicadores-os";
import { isEquipamentoMedico } from "./medical";
import type { CronogramaItem, EquipamentoItem } from "./types";

export type PlanoSet = { Preventiva: boolean; Calibração: boolean; TSE: boolean };

export type GapPreventivaRow = {
  tag: string;
  equipamento: string;
  setor: string;
  situacao: string;
  criticidade: string;
  temPreventiva: boolean;
  temCalibracao: boolean;
  temTse: boolean;
};

export type GapPreventivaResult = {
  janela: { from: string; to: string };
  parqueMedicoComTag: number;
  semPreventiva: GapPreventivaRow[];
  comPreventiva: number;
  altaSemPreventiva: number;
  setores: string[];
  situacoes: string[];
  criticidades: string[];
  linhasCronograma: number;
  tagsComPlanoLoose: number;
  linhasTipoVazioMasPlanoClassifica: number;
};

export function emptyPlanos(): PlanoSet {
  return { Preventiva: false, Calibração: false, TSE: false };
}

/** Loose: Tipo OU nome do Plano — Tipo vazio não zera cobertura. */
export function classifyCronogramaPlanoLoose(row: CronogramaItem): PlanoEcTipo | null {
  return classifyPlanoEc(row.TipoDeManutencao) || classifyPlanoEc(row.PlanoDeManutencao);
}

export function buildPlanosByTagLoose(cronograma: CronogramaItem[]) {
  const planosByTag = new Map<string, PlanoSet>();
  let linhasTipoVazioMasPlanoClassifica = 0;
  let linhasEcLoose = 0;

  for (const row of cronograma) {
    const strict = classifyPlanoEc(row.TipoDeManutencao);
    const loose = classifyCronogramaPlanoLoose(row);
    if (!strict && loose && !(row.TipoDeManutencao || "").trim()) {
      linhasTipoVazioMasPlanoClassifica += 1;
    }
    if (!loose) continue;
    linhasEcLoose += 1;
    const tag = (row.Tag ?? "").trim();
    if (!tag) continue;
    const cur = planosByTag.get(tag) ?? emptyPlanos();
    cur[loose] = true;
    planosByTag.set(tag, cur);
  }

  return { planosByTag, linhasTipoVazioMasPlanoClassifica, linhasEcLoose };
}

export function critRank(c: string) {
  const v = c.toLocaleUpperCase("pt-BR");
  if (v.includes("ALT") || v.includes("CRÍT") || v.includes("CRIT")) return 0;
  if (v.includes("MÉD") || v.includes("MED") || v.includes("SEMI")) return 1;
  if (v.includes("BAIX") || v.includes("NÃO CRIT") || v.includes("NAO CRIT")) return 2;
  return 3;
}

export function isAltaCriticidade(c: string) {
  return critRank(c) === 0;
}

export function gapPreventivaJanelaDefault(now = new Date()) {
  const y = now.getFullYear();
  // Ano corrente + próximo; se estivermos em 2025–2026, cobre a janela operacional típica.
  return {
    from: `${y}-01-01`,
    to: `${y + 1}-12-31`,
  };
}

/** Preferência operacional: 2025–2027 quando ainda relevante; senão ano corrente + próximo. */
export function gapPreventivaJanelaOperacional(now = new Date()) {
  const y = now.getFullYear();
  if (y <= 2027) {
    return { from: "2025-01-01", to: "2027-12-31" };
  }
  return gapPreventivaJanelaDefault(now);
}

export function buildGapPreventiva(
  equipamentos: EquipamentoItem[],
  cronograma: CronogramaItem[],
  janela: { from: string; to: string },
): GapPreventivaResult {
  const { planosByTag, linhasTipoVazioMasPlanoClassifica } = buildPlanosByTagLoose(cronograma);

  const comTag = equipamentos.filter((e) => Boolean((e.Tag ?? "").trim()));
  const medicos = comTag.filter(isEquipamentoMedico);

  const semPreventiva: GapPreventivaRow[] = [];
  let comPreventiva = 0;
  let altaSemPreventiva = 0;
  const setorSet = new Set<string>();
  const situacaoSet = new Set<string>();
  const critSet = new Set<string>();

  for (const eq of medicos) {
    const tag = eq.Tag.trim();
    const planos = planosByTag.get(tag) ?? emptyPlanos();
    const setor = eq.Setor?.trim() || "—";
    const situacao = eq.Situacao?.trim() || "—";
    const criticidade = eq.Criticidade?.trim() || "—";
    setorSet.add(setor);
    situacaoSet.add(situacao);
    critSet.add(criticidade);

    const row: GapPreventivaRow = {
      tag,
      equipamento: eq.Equipamento?.trim() || "—",
      setor,
      situacao,
      criticidade,
      temPreventiva: planos.Preventiva,
      temCalibracao: planos["Calibração"],
      temTse: planos.TSE,
    };

    if (planos.Preventiva) {
      comPreventiva += 1;
    } else {
      semPreventiva.push(row);
      if (isAltaCriticidade(criticidade)) altaSemPreventiva += 1;
    }
  }

  semPreventiva.sort(
    (a, b) =>
      critRank(a.criticidade) - critRank(b.criticidade) ||
      a.setor.localeCompare(b.setor, "pt-BR") ||
      a.tag.localeCompare(b.tag, "pt-BR"),
  );

  return {
    janela,
    parqueMedicoComTag: medicos.length,
    semPreventiva,
    comPreventiva,
    altaSemPreventiva,
    setores: [...setorSet].sort((a, b) => a.localeCompare(b, "pt-BR")),
    situacoes: [...situacaoSet].sort((a, b) => a.localeCompare(b, "pt-BR")),
    criticidades: [...critSet].sort((a, b) => critRank(a) - critRank(b) || a.localeCompare(b, "pt-BR")),
    linhasCronograma: cronograma.length,
    tagsComPlanoLoose: planosByTag.size,
    linhasTipoVazioMasPlanoClassifica,
  };
}

export function filterGapRows(
  rows: GapPreventivaRow[],
  filters: { criticidade?: string; setor?: string; situacao?: string },
) {
  return rows.filter((row) => {
    if (filters.criticidade && filters.criticidade !== "Todas" && row.criticidade !== filters.criticidade) {
      return false;
    }
    if (filters.setor && filters.setor !== "Todos" && row.setor !== filters.setor) return false;
    if (filters.situacao && filters.situacao !== "Todas" && row.situacao !== filters.situacao) return false;
    return true;
  });
}
