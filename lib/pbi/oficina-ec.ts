/**
 * Oficinas de Engenharia Clínica (SJH / GlobalThings).
 * Allowlist positiva (equals canônicos + padrões) para Sala TV, snapshot EC e filas EC-only.
 *
 * Família EC: Engenharia Clínica / eng. clínica / EC, Calibração, Preventiva (equipamentos),
 * TSE / Segurança Elétrica, Instrumental, Movimentação, Eletrônica.
 *
 * Excluídos: Oficina Geral, manutenção geral/predial
 * (REFRIGERAÇÃO, CIVIL/OBRAS, PREVENTIVAS (MANUTENÇÃO), TAPEÇARIA, etc.).
 */

/** Valores canônicos normalizados (sem acento, upper, trim) — amostra API. */
export const OFICINAS_EC_ALLOWLIST = [
  "ENGENHARIA CLINICA",
  "EC",
  "CALIBRACAO DE EQUIPAMENTOS",
  "INSTRUMENTAL",
  "PREVENTIVA EQUIPAMENTOS",
  "SEGURANCA ELETRICA",
  "MOVIMENTACAO EQUIPAMENTOS",
  "ELETRONICA",
] as const;

/** Nomes exibidos no rodapé / documentação (com acento, como na API). */
export const OFICINAS_EC_LABELS = [
  "ENGENHARIA CLÍNICA",
  "EC",
  "CALIBRAÇÃO DE EQUIPAMENTOS",
  "INSTRUMENTAL",
  "PREVENTIVA EQUIPAMENTOS",
  "SEGURANÇA ELÉTRICA",
  "MOVIMENTAÇÃO EQUIPAMENTOS",
  "ELETRÔNICA",
] as const;

/**
 * Padrões positivos (string já normalizada). Preferidos a "contém clínica" solto.
 * Ordem irrelevante — basta um match.
 */
export const OFICINAS_EC_PATTERNS: readonly RegExp[] = [
  // Engenharia Clínica e abreviações (não basta "CLINICA" sozinha)
  /ENGENHARIA\s+CLINICA/,
  /^ENG\.?\s*CLINICA$/,
  /^EC$/,
  // Calibração (plano EC)
  /CALIBRACAO/,
  // TSE / teste de segurança elétrica
  /^TSE$/,
  /\bTSE\b/,
  /SEGURANCA\s+ELETRICA/,
  /TESTE\s+DE\s+SEGURANCA\s+ELETRICA/,
  // Preventiva de equipamentos médicos (não predial)
  /^PREVENTIVA$/,
  /PREVENTIVA\s+EQUIPAMENTOS/,
  // Demais oficinas EC da amostra
  /^INSTRUMENTAL$/,
  /MOVIMENTACAO\s+EQUIPAMENTOS/,
  /^ELETRONICA$/,
];

/** Equals normalizado — nunca entram no recorte EC (manutenção geral / predial). */
export const OFICINAS_EC_DENYLIST = [
  "OFICINA GERAL",
  "GERAL",
  "MANUTENCAO GERAL",
] as const;

/** Substrings que marcam oficina predial / fora da EC (após normalize). */
const OFICINAS_EC_DENY_SUBSTRINGS = [
  "GERAL",
  "REFRIGERACAO",
  "TAPECARIA",
  "MOSQUITEIR",
  "HOTELARIA",
  "CIVIL",
  "OBRAS",
  "ANTECIPACAO",
] as const;

const OFICINAS_EC_SET = new Set<string>(OFICINAS_EC_ALLOWLIST);
const OFICINAS_EC_DENY_SET = new Set<string>(OFICINAS_EC_DENYLIST);

export function normalizeOficina(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

function isDeniedOficina(v: string) {
  if (OFICINAS_EC_DENY_SET.has(v)) return true;
  for (const frag of OFICINAS_EC_DENY_SUBSTRINGS) {
    if (v.includes(frag)) return true;
  }
  // Preventiva predial: "PREVENTIVAS (MANUTENÇÃO)" — não confundir com PREVENTIVA EQUIPAMENTOS
  if (v.includes("PREVENTIVAS") && v.includes("MANUTENCAO")) return true;
  if (v.includes("PREVENTIVA") && v.includes("MANUTENCAO") && !v.includes("EQUIPAMENTO")) {
    return true;
  }
  return false;
}

function matchesEcPattern(v: string) {
  if (OFICINAS_EC_SET.has(v)) return true;
  return OFICINAS_EC_PATTERNS.some((re) => re.test(v));
}

/**
 * Oficina pertence à família EC?
 * Allowlist positiva (canônicos + padrões), case/acento-insensitive.
 * Rejeita Oficina Geral e predial antes de aceitar padrões.
 */
export function isOficinaEngenhariaClinica(oficina: string | null | undefined) {
  const v = normalizeOficina(oficina);
  if (!v) return false;
  if (isDeniedOficina(v)) return false;
  return matchesEcPattern(v);
}

export const OFICINA_EC_REGRA_RESUMO =
  `somente oficinas de Engenharia Clínica (família EC; exclui Oficina Geral): ${OFICINAS_EC_LABELS.join(", ")}`;
