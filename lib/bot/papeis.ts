/**
 * Papel é só rótulo (A15): não muda permissão nem a allowlist.
 * Os cinco valores são a decisão de 10/11/2026. `AIONSCOPE_BOT_PAPEIS`
 * (vírgula) substitui a lista inteira, sem migração.
 * Setor e outros_setores são outro assunto: texto livre, não esta lista.
 */

export const PAPEIS_BOT_ENV = "AIONSCOPE_BOT_PAPEIS";

export const PAPEIS_BOT_PADRAO = [
  "Diretoria/Gestão",
  "Chefia de Enfermagem",
  "Compras",
  "Manutenção",
  "Solicitante assistencial",
] as const;

/**
 * Quem aprova na v1. A porta continua sendo a sessão única de administrador;
 * este rótulo é o que fica em `aprovado_por`.
 */
export const APROVADOR_BOT_V1 = "Leandro";

export function papeisBot(): string[] {
  const bruto = process.env[PAPEIS_BOT_ENV]?.trim();
  if (!bruto) return [...PAPEIS_BOT_PADRAO];
  const lista = bruto
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return lista.length ? lista : [...PAPEIS_BOT_PADRAO];
}

export function canonizarPapel(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const chave = valor.trim().toLocaleLowerCase("pt-BR");
  if (!chave) return null;
  return papeisBot().find((papel) => papel.toLocaleLowerCase("pt-BR") === chave) ?? null;
}
