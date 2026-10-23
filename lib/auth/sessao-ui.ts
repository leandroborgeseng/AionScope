/** Textos e regras de UI da sessão de admin (UX do Designer, 23/10/2026). Puro. */
export const DICA_REQUER_LOGIN = "Requer login de admin";
export const MSG_SESSAO_EXPIRADA = "Sessão expirada. Entre de novo para salvar.";
export const ROTA_LOGIN_ADMIN = "/cadastros/contratos";

const ORIGEM_BASE = "https://aionscope.invalid";

/**
 * Só caminhos internos ("/x"). Recusa caracteres de controle, espaço e barra invertida
 * (navegadores os removem: "/\t/evil" vira "//evil"), "//host" e URL absoluta.
 * Confere também que a URL resolvida fica na mesma origem (no servidor, base fictícia).
 */
export function voltarSeguro(v: string | null | undefined, origem?: string): string | null {
  if (!v || typeof v !== "string") return null;
  if (/[\x00-\x20\x7f\\]/.test(v)) return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  const base = origem || (typeof window !== "undefined" && window.location?.origin) || ORIGEM_BASE;
  try {
    if (new URL(v, base).origin !== new URL(base).origin) return null;
  } catch {
    return null;
  }
  return v;
}

export function hrefLoginAdmin(voltar: string) {
  const v = voltarSeguro(voltar);
  return v ? `${ROTA_LOGIN_ADMIN}?voltar=${encodeURIComponent(v)}` : ROTA_LOGIN_ADMIN;
}

/** Mensagem de erro de escrita: 401 vira "Sessão expirada…"; senão a do servidor. */
export function mensagemErroEscrita(status: number, mensagemServidor?: string | null, padrao = "Falha ao salvar.") {
  if (status === 401) return MSG_SESSAO_EXPIRADA;
  return mensagemServidor || padrao;
}
