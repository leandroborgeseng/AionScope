import { getDb } from "@/lib/db/client";
import { buscarConviteAberto, cabecalhosConvite, cookieCsrfConvite, novoCsrfConvite } from "@/lib/bot/convite";
import { ipParaLimite, consumirLimite } from "@/lib/bot/convite-limite";
import { paginaFormulario, paginaInativa } from "@/lib/bot/convite-pagina";
import { csrfConviteConfere, origemConvitePermitida, receberPreCadastro } from "@/lib/bot/convite-publico";
import { MSG_CONVITE_AGORA, MSG_JSON } from "@/lib/bot/mensagens";
import { papeisBot } from "@/lib/bot/papeis";
import { listarSetoresAtivos } from "@/lib/bot/setores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

const LIMITE_CORPO = 20_000;

function json(status: number, message: string, retryAfter?: number) {
  const headers = cabecalhosConvite({ "Content-Type": "application/json; charset=utf-8" });
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return new Response(JSON.stringify({ ok: status >= 200 && status < 300, message }), { status, headers });
}

export async function GET(_request: Request, context: Ctx) {
  const { token } = await context.params;
  const csrf = novoCsrfConvite();
  const headers = cabecalhosConvite({ "Content-Type": "text/html; charset=utf-8" });
  headers.append("Set-Cookie", cookieCsrfConvite(csrf));
  const aberto = buscarConviteAberto(token);
  const html = aberto
    ? paginaFormulario({ csrf, setores: listarSetoresAtivos(getDb()), papeis: papeisBot() })
    : paginaInativa();
  return new Response(html, { status: 200, headers });
}

export async function HEAD(request: Request, context: Ctx) {
  const resposta = await GET(request, context);
  return new Response(null, { status: resposta.status, headers: resposta.headers });
}

export async function POST(request: Request, context: Ctx) {
  const limiteIp = consumirLimite("ip", ipParaLimite(request));
  if (!limiteIp.permitido) return json(429, MSG_CONVITE_AGORA, limiteIp.retryAfter);
  if (!origemConvitePermitida(request)) return json(403, MSG_CONVITE_AGORA);

  const anunciado = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(anunciado) && anunciado > LIMITE_CORPO) return json(400, MSG_JSON);
  let texto = "";
  try {
    texto = await request.text();
  } catch {
    return json(400, MSG_JSON);
  }
  if (texto.length > LIMITE_CORPO) return json(400, MSG_JSON);
  let body: unknown;
  try {
    body = JSON.parse(texto) as unknown;
  } catch {
    return json(400, MSG_JSON);
  }
  if (!csrfConviteConfere(request, body && typeof body === "object" && !Array.isArray(body) ? (body as { csrf?: unknown }).csrf : null)) {
    return json(403, MSG_CONVITE_AGORA);
  }

  const { token } = await context.params;
  try {
    const resultado = receberPreCadastro(token, body);
    if (!resultado.ok) return json(resultado.status, resultado.message, resultado.retryAfter);
    return json(200, resultado.message);
  } catch {
    return json(500, MSG_CONVITE_AGORA);
  }
}
