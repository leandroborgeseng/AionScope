/**
 * Telefone digitado no formulário → E.164 do Brasil.
 * Com e sem +55, com e sem o nono dígito, caem no mesmo valor.
 * Fixo (assinante de 8 dígitos começando em 2–5) não ganha o nono dígito.
 * A unicidade desse valor, entre ativos/inativos, fica no banco e no serviço.
 */

const DDD_VALIDOS = new Set(
  [
    "11", "12", "13", "14", "15", "16", "17", "18", "19",
    "21", "22", "24", "27", "28",
    "31", "32", "33", "34", "35", "37", "38",
    "41", "42", "43", "44", "45", "46", "47", "48", "49",
    "51", "53", "54", "55",
    "61", "62", "63", "64", "65", "66", "67", "68", "69",
    "71", "73", "74", "75", "77", "79",
    "81", "82", "83", "84", "85", "86", "87", "88", "89",
    "91", "92", "93", "94", "95", "96", "97", "98", "99",
  ],
);

const SEPARADORES = /^\+?[\d\s().-]+$/;

export function normalizarTelefone(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  const bruto = entrada.trim();
  if (!bruto || !SEPARADORES.test(bruto)) return null;

  let digitos = bruto.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  if (!digitos.startsWith("55") || (digitos.length !== 12 && digitos.length !== 13)) return null;

  const ddd = digitos.slice(2, 4);
  let assinante = digitos.slice(4);
  if (!DDD_VALIDOS.has(ddd)) return null;

  if (assinante.length === 9) {
    if (!assinante.startsWith("9")) return null;
  } else if (assinante.length === 8) {
    if (!"2345".includes(assinante[0] ?? "")) assinante = `9${assinante}`;
  } else {
    return null;
  }

  return `+55${ddd}${assinante}`;
}

/** Máscara de listagem: +55 11 •••••-0001. Nunca devolve o miolo do número. */
export function mascararTelefone(e164: string): string {
  const digitos = e164.replace(/\D/g, "");
  if (!digitos.startsWith("55") || (digitos.length !== 12 && digitos.length !== 13)) {
    return "+55 •• ••••-••••";
  }
  const ddd = digitos.slice(2, 4);
  const assinante = digitos.slice(4);
  const ultimos = assinante.slice(-4);
  const ocultos = "•".repeat(assinante.length - 4);
  return `+55 ${ddd} ${ocultos}-${ultimos}`;
}

/** Número completo, só na revelação temporária da tela admin. Não usar em lista nem em log. */
export function formatarTelefoneCompleto(e164: string): string {
  const digitos = e164.replace(/\D/g, "");
  if (!digitos.startsWith("55") || (digitos.length !== 12 && digitos.length !== 13)) return e164;
  const ddd = digitos.slice(2, 4);
  const assinante = digitos.slice(4);
  const corte = assinante.length === 9 ? 5 : 4;
  return `+55 ${ddd} ${assinante.slice(0, corte)}-${assinante.slice(corte)}`;
}
