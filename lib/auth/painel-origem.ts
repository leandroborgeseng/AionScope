/**
 * CSRF do login único. Origin presente tem prioridade; Referer só entra
 * se o header Origin não veio. A resposta não ecoa a origem recebida.
 * `AIONSCOPE_PAINEL_ORIGENS`: origens extras (esquema + host + porta), vírgula.
 * O host do próprio pedido sempre passa, para o formulário no mesmo site.
 */
export const PAINEL_ORIGENS_ENV = "AIONSCOPE_PAINEL_ORIGENS";

function canonizar(valor: string | null | undefined): URL | null {
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
  return url;
}

function origensConfiguradas() {
  const bruto = process.env[PAINEL_ORIGENS_ENV] ?? "";
  const lista = new Set<string>();
  for (const parte of bruto.split(",")) {
    const url = canonizar(parte);
    if (url) lista.add(url.origin);
  }
  return lista;
}

/** Host do pedido, ou uma origem da lista. Sem Origin e sem Referer, recusa. */
export function origemPainelPermitida(request: Request) {
  const bruto = request.headers.has("origin") ? request.headers.get("origin") : request.headers.get("referer");
  const informada = canonizar(bruto);
  if (!informada) return false;
  let pedido: URL;
  try {
    pedido = new URL(request.url);
  } catch {
    return false;
  }
  if (informada.host === pedido.host) return true;
  return origensConfiguradas().has(informada.origin);
}
