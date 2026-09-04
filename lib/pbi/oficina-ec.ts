/**
 * Oficinas de Engenharia Clínica (SJH / GlobalThings).
 * Allowlist explícita com base na listagem_analitica_das_os (amostra DoisAnosAtuais).
 *
 * Aceitos (equals, normalizado): OFICINA GERAL, ENGENHARIA CLÍNICA,
 * CALIBRAÇÃO DE EQUIPAMENTOS, INSTRUMENTAL, PREVENTIVA EQUIPAMENTOS,
 * SEGURANÇA ELÉTRICA, MOVIMENTAÇÃO EQUIPAMENTOS, ELETRÔNICA.
 *
 * Rejeitados na amostra: REFRIGERAÇÃO, CIVIL/ OBRAS, PREVENTIVAS (MANUTENÇÃO),
 * TAPEÇARIA, TELAS MOSQUITEIRAS, ANTECIPAÇÃO DOS SERVIÇOS (MANUTENÇÃO).
 */

export const OFICINAS_EC_ALLOWLIST = [
  "OFICINA GERAL",
  "ENGENHARIA CLINICA",
  "CALIBRACAO DE EQUIPAMENTOS",
  "INSTRUMENTAL",
  "PREVENTIVA EQUIPAMENTOS",
  "SEGURANCA ELETRICA",
  "MOVIMENTACAO EQUIPAMENTOS",
  "ELETRONICA",
] as const;

/** Nomes exibidos no rodapé / documentação (com acento, como na API). */
export const OFICINAS_EC_LABELS = [
  "OFICINA GERAL",
  "ENGENHARIA CLÍNICA",
  "CALIBRAÇÃO DE EQUIPAMENTOS",
  "INSTRUMENTAL",
  "PREVENTIVA EQUIPAMENTOS",
  "SEGURANÇA ELÉTRICA",
  "MOVIMENTAÇÃO EQUIPAMENTOS",
  "ELETRÔNICA",
] as const;

const OFICINAS_EC_SET = new Set<string>(OFICINAS_EC_ALLOWLIST);

export function normalizeOficina(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

/** Equals (normalizado) contra a allowlist de oficinas EC. */
export function isOficinaEngenhariaClinica(oficina: string | null | undefined) {
  const v = normalizeOficina(oficina);
  if (!v) return false;
  return OFICINAS_EC_SET.has(v);
}

export const OFICINA_EC_REGRA_RESUMO =
  `somente oficinas de Engenharia Clínica (equals): ${OFICINAS_EC_LABELS.join(", ")}`;
