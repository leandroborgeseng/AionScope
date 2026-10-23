/** Textos e regras de UI da sessão de admin (UX do Designer, 23/10/2026). Puro. */
export const DICA_REQUER_LOGIN = "Requer login de admin";
export const MSG_SESSAO_EXPIRADA = "Sessão expirada. Entre de novo para salvar.";
export const ROTA_LOGIN_ADMIN = "/cadastros/contratos";

/** Só caminhos internos ("/x"), nunca "//host" nem URL absoluta (evita open redirect). */
export function voltarSeguro(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
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
