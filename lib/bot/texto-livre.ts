/**
 * E-mail, setor e outros_setores.
 * Setor não é lista fechada: a pessoa pode cuidar ou fazer plantão em outro lugar,
 * e isso vai em `outros_setores`, também texto livre.
 * Entrada maliciosa é recusada (não interpretada, não gravada, não ecoada).
 */

export const SETOR_TAMANHO_MAXIMO = 80;
export const EMAIL_TAMANHO_MAXIMO = 254;

const CONTROLE = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;
const EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizarTextoLivre(
  valor: unknown,
  maximo: number,
): { ok: true; texto: string | null } | { ok: false } {
  if (valor == null || valor === "") return { ok: true, texto: null };
  if (typeof valor !== "string") return { ok: false };
  const texto = valor.trim();
  if (!texto) return { ok: true, texto: null };
  if (texto.length > maximo) return { ok: false };
  if (CONTROLE.test(texto) || /[<>]/.test(texto)) return { ok: false };
  return { ok: true, texto };
}

export function normalizarEmail(valor: unknown): { ok: true; email: string | null } | { ok: false } {
  if (valor == null || valor === "") return { ok: true, email: null };
  if (typeof valor !== "string") return { ok: false };
  const email = valor.trim().toLowerCase();
  if (!email) return { ok: true, email: null };
  if (email.length > EMAIL_TAMANHO_MAXIMO || CONTROLE.test(email) || /[<>]/.test(email) || !EMAIL.test(email)) {
    return { ok: false };
  }
  return { ok: true, email };
}

/** Máscara de listagem. Não reconstrói o endereço. */
export function mascararEmail(email: string): string {
  const arroba = email.indexOf("@");
  const inicialLocal = arroba > 0 ? email[0] : "•";
  const inicialDominio = arroba >= 0 && arroba < email.length - 1 ? email[arroba + 1] : "•";
  return `${inicialLocal}•••@${inicialDominio}•••`;
}
