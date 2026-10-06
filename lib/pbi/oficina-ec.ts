/**
 * Oficinas de Engenharia Clínica (SJH / GlobalThings).
 * Allowlist explícita (equals, normalizado) para Sala TV, snapshot EC e filas EC-only.
 *
 * Aceitos: ENGENHARIA CLÍNICA (e alias EC), CALIBRAÇÃO DE EQUIPAMENTOS,
 * INSTRUMENTAL, PREVENTIVA EQUIPAMENTOS, SEGURANÇA ELÉTRICA,
 * MOVIMENTAÇÃO EQUIPAMENTOS, ELETRÔNICA.
 *
 * Excluídos de propósito: OFICINA GERAL e demais oficinas prediais/geral
 * (REFRIGERAÇÃO, CIVIL/OBRAS, PREVENTIVAS (MANUTENÇÃO), TAPEÇARIA, etc.).
 * "GERAL" no nome normalizado é rejeitado mesmo se cair na allowlist por engano.
 */

/** Valores já normalizados (sem acento, upper, trim) — equals exato. */
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

/** Equals normalizado — nunca entram no recorte EC (manutenção geral / predial). */
export const OFICINAS_EC_DENYLIST = [
  "OFICINA GERAL",
  "GERAL",
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

/**
 * Equals (normalizado) contra a allowlist de oficinas EC.
 * Rejeita nomes com "GERAL" (ex.: OFICINA GERAL) e a denylist explícita.
 */
export function isOficinaEngenhariaClinica(oficina: string | null | undefined) {
  const v = normalizeOficina(oficina);
  if (!v) return false;
  if (OFICINAS_EC_DENY_SET.has(v)) return false;
  // Blindagem: qualquer oficina com "GERAL" no nome (ex.: OFICINA GERAL) fica de fora.
  if (v.includes("GERAL")) return false;
  return OFICINAS_EC_SET.has(v);
}

export const OFICINA_EC_REGRA_RESUMO =
  `somente oficinas de Engenharia Clínica (equals; exclui Oficina Geral): ${OFICINAS_EC_LABELS.join(", ")}`;
