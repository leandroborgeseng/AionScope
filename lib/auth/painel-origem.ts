/**
 * CSRF do login único. Origin presente tem prioridade; Referer só entra
 * se o header Origin não veio. A resposta não ecoa a origem recebida.
 * A origem informada passa se coincidir com o primeiro `X-Forwarded-Proto`
 * mais o primeiro `X-Forwarded-Host`, com o Host (ou o host do pedido) e o
 * proto (`X-Forwarded-Proto` ou o do pedido), ou com um item de
 * `AIONSCOPE_PAINEL_ORIGENS` (esquema + host + porta, vírgula).
 * O host é comparado sem distinção de maiúsculas e a porta 80/443 sai.
 * Sem Origin e sem Referer, recusa.
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

function primeiro(valor: string | null): string {
  if (!valor) return "";
  return (valor.split(",")[0] ?? "").trim();
}

/** Esquema + host, com o host em minúsculas e a porta padrão omitida. */
function origemHttp(proto: string, host: string): string | null {
  const esquema = proto.trim().toLowerCase();
  const nome = host.trim();
  if ((esquema !== "http" && esquema !== "https") || !nome) return null;
  return canonizar(`${esquema}://${nome}`)?.origin ?? null;
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

/** Host do pedido, cabeçalhos do proxy, ou uma origem da lista. Sem Origin e sem Referer, recusa. */
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
  const origem = informada.origin;
  const protoEnc = primeiro(request.headers.get("x-forwarded-proto"));
  const hostEnc = primeiro(request.headers.get("x-forwarded-host"));
  if (hostEnc && protoEnc && origemHttp(protoEnc, hostEnc) === origem) return true;

  const proto = protoEnc || pedido.protocol.slice(0, -1);
  const hosts = [primeiro(request.headers.get("host")), pedido.host];
  for (const host of hosts) {
    if (host && origemHttp(proto, host) === origem) return true;
  }
  return origensConfiguradas().has(origem);
}
