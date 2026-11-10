/**
 * CSRF das mutações do cadastro do bot.
 * `AIONSCOPE_ORIGENS_PERMITIDAS`: origens exatas (esquema + host + porta), separadas por vírgula.
 * Sem host fixo. Lista vazia recusa toda mutação. GET não passa por aqui.
 * Origin presente tem prioridade; Referer só entra se o header Origin não veio.
 * A resposta é genérica e não ecoa a origem recebida.
 */
import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";

export const ORIGENS_PERMITIDAS_ENV = "AIONSCOPE_ORIGENS_PERMITIDAS";
export const MSG_ORIGEM_NEGADA = "Origem não permitida.";

export function canonizarOrigem(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const texto = valor.trim();
  if (!texto || texto.toLowerCase() === "null") return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.origin;
}

export function origensPermitidas(): Set<string> {
  const bruto = process.env[ORIGENS_PERMITIDAS_ENV] ?? "";
  const lista = new Set<string>();
  for (const parte of bruto.split(",")) {
    const origem = canonizarOrigem(parte);
    if (origem) lista.add(origem);
  }
  return lista;
}

/** Origin, se o header existe (mesmo inválido). Sem o header, a origem do Referer. */
export function origemDaRequisicao(request: Request): string | null {
  if (request.headers.has("origin")) return canonizarOrigem(request.headers.get("origin"));
  return canonizarOrigem(request.headers.get("referer"));
}

export function exigirOrigemPermitida(request: Request): Response | null {
  const origem = origemDaRequisicao(request);
  if (!origem || !origensPermitidas().has(origem)) {
    return Response.json({ ok: false, message: MSG_ORIGEM_NEGADA }, { status: 403 });
  }
  return null;
}

/** Sessão de administrador e, em seguida, origem permitida. 401 não vaza se a origem passaria. */
export function exigirMutacaoAdmin(request: Request): Response | null {
  const sessao = exigirSessaoAdmin(request);
  if (sessao) return sessao;
  return exigirOrigemPermitida(request);
}
