import type { EquipamentoItem } from "./types";

const TIPO_KEYS = [
  "Tipo",
  "TipoEquipamento",
  "TipoDeEquipamento",
  "GrupoFamilia",
  "GrupoDeFamilia",
  "GrupoDeFamilias",
  "Familia",
  "Classificacao",
  "Categoria",
] as const;

/** Nomes prediais/hotelaria excluídos do recorte médico. */
export const REGRAS_EXCLUSAO_MEDICO = [
  "Evaporadora, hi wall, ar-condicionado e split",
  "TV / televisão",
  "Fogão, cooktop e micro-ondas",
  "Liquidificador, processador de alimentos e extrator de suco",
  "Lava-louças, frigobar e máquina de gelo",
  "Elevador e martelo rompedor",
  "Nobreak, estabilizador e smartphone",
  "Impressora de etiquetas, detector de metal e unidade manutenção",
];

const INFRA_NAME_RE =
  /(evaporadora|hi wall|ar condicionado|\bsplit\b|fogao|cooktop|lavadora de pratos|liquidificador|processador de alimentos|extrator de suco|\belevador\b|martelo|maquina de gelo|frigobar|micro\s*-?\s*ondas|forno microondas|smartphone|nobreak|estabilizador|\btv\b|televisao|impressora de etiquetas|detector de metal|unidade manutencao)/i;

export type NomeQuantidade = { nome: string; quantidade: number };

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function tipoCadastro(item: EquipamentoItem): string {
  const record = item as EquipamentoItem & Record<string, unknown>;
  return TIPO_KEYS.map((key) => String(record[key] ?? "").trim())
    .filter(Boolean)
    .join(" | ");
}

export function isEquipamentoMedico(item: EquipamentoItem): boolean {
  const tipo = normalize(tipoCadastro(item));
  if (tipo) {
    if (tipo.includes("medic")) return true;
    if (/(infra|predial|utilidade|mobiliario|hotelaria|^refrigeracao$|obras)/.test(tipo)) {
      return false;
    }
  }

  const nome = normalize(item.Equipamento ?? "");
  if (INFRA_NAME_RE.test(nome)) return false;

  return true;
}

export function isTipoManutencaoMedica(tipo: string | null | undefined): boolean {
  const value = normalize(tipo ?? "");
  if (!value) return false;
  if (value.startsWith("m -") || value.startsWith("o -")) return false;
  if (value.includes("obras") || value.includes("tapecaria")) return false;
  if (value.includes("hotelaria") || value.includes("refrigeracao")) return false;
  if (value.startsWith("a -") || value.includes("medic") || value.includes("engenharia clinica")) return true;
  if (value === "preventiva" || value.includes("assistencia tecnica")) return true;
  return false;
}

function countByName(items: EquipamentoItem[]): NomeQuantidade[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const nome = item.Equipamento?.trim() || "Sem nome";
    map.set(nome, (map.get(nome) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function buildMedicalIndex(items: EquipamentoItem[]) {
  const medicos = items.filter(isEquipamentoMedico);
  const outros = items.filter((item) => !isEquipamentoMedico(item));
  return {
    tags: new Set(medicos.map((i) => i.Tag).filter(Boolean)),
    ids: new Set(medicos.map((i) => i.Id)),
    total: items.length,
    medicos: medicos.length,
    outros: outros.length,
    nomesMedicos: countByName(medicos),
    nomesExcluidos: countByName(outros),
  };
}

export function linkedToMedicalPark(
  tag: string | null | undefined,
  id: number | null | undefined,
  tags: Set<string>,
  ids: Set<number>,
) {
  if (tag && tags.has(tag)) return true;
  if (id != null && ids.has(id)) return true;
  return false;
}
