/**
 * Respostas da API do bot. Campos saem de uma allowlist montada na projeção,
 * nunca de um filtro que apaga o que sobrar.
 */
import { createHash } from "node:crypto";
import { registrarConsultaApi } from "@/lib/bot/auditoria";
import { identificarRemetente } from "@/lib/bot/usuarios";
import { mascararTelefone, normalizarTelefone } from "@/lib/bot/telefone";
import { consultarSituacao } from "./usuario";
import { botIdAtual, bearerConfere, tokenConfigurado } from "./token";
import { chaveLimite, consumirLimiteApi } from "./limite";
import { anotarRecusaAuth } from "./recusa";

export function json(status: number, body: unknown, headers?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store", ...headers },
  });
}

export function hashConsulta(url: URL) {
  const pares = [...url.searchParams.entries()].sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return createHash("sha256").update(`${url.pathname}?${pares.map(([k, v]) => `${k}=${v}`).join("&")}`).digest("hex");
}

function mascararSeCanonico(telefone: string | null) {
  const canonico = normalizarTelefone(telefone);
  return canonico ? mascararTelefone(canonico) : null;
}

function idSePossivel(telefone: string | null) {
  try {
    return identificarRemetente(telefone).usuarioId;
  } catch {
    return null;
  }
}

function auditar(request: Request, status: number, usuarioId: string | null, inicio: number) {
  try {
    const url = new URL(request.url);
    registrarConsultaApi({
      usuarioId,
      botId: botIdAtual(),
      rota: url.pathname.slice(0, 180),
      queryHash: hashConsulta(url),
      telefoneMascarado: mascararSeCanonico(request.headers.get("x-bot-telefone")),
      status,
      latenciaMs: Math.max(0, Math.round(performance.now() - inicio)),
    });
  } catch {
    /* a trilha não substitui a resposta */
  }
}

const MSG_INDISPONIVEL = "Cópia indisponível.";
const MSG_EXPIRADA = "Cópia com mais de 7 dias e a última atualização falhou.";

export function copiaIndisponivel(motivo: "ausente" | "expirada", extra?: { fetchedAt: string; idadeSegundos: number }) {
  if (motivo === "expirada" && extra) {
    return json(503, { ok: false, message: MSG_EXPIRADA, fetchedAt: extra.fetchedAt, idadeSegundos: extra.idadeSegundos });
  }
  return json(503, { ok: false, message: MSG_INDISPONIVEL });
}

export async function atenderGet(request: Request, executar: (usuarioId: string) => Promise<Response> | Response) {
  const inicio = performance.now();
  let status = 500;
  let usuarioId: string | null = null;
  let trilha = true;
  const telefone = request.headers.get("x-bot-telefone");
  try {
    if (!tokenConfigurado()) {
      status = 503;
      trilha = false;
      anotarRecusaAuth(503);
      return json(503, { ok: false, message: "API desativada." });
    }
    if (!bearerConfere(request)) {
      status = 401;
      trilha = false;
      anotarRecusaAuth(401);
      return json(401, { ok: false });
    }
    const identificado = identificarRemetente(telefone);
    usuarioId = identificado.usuarioId;
    if (!identificado.ok) {
      status = 403;
      return json(403, { ok: false });
    }
    const apresentado = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const limite = consumirLimiteApi([
      chaveLimite("token", apresentado),
      chaveLimite("pessoa", identificado.usuarioId),
    ]);
    if (!limite.permitido) {
      status = 429;
      return json(429, { ok: false }, { "retry-after": String(limite.retryAfter) });
    }
    const resposta = await executar(identificado.usuarioId);
    status = resposta.status;
    return resposta;
  } catch {
    status = 500;
    return json(500, { ok: false });
  } finally {
    if (trilha) auditar(request, status, usuarioId, inicio);
  }
}

/**
 * Única rota que devolve a situação real de um telefone não aprovado.
 * Sem Bearer continua 401. Sem telefone normalizável continua 403.
 */
export function atenderSituacao(request: Request) {
  const inicio = performance.now();
  let status = 500;
  let usuarioId: string | null = null;
  let trilha = true;
  const telefone = request.headers.get("x-bot-telefone");
  try {
    if (!tokenConfigurado()) {
      status = 503;
      trilha = false;
      anotarRecusaAuth(503);
      return json(503, { ok: false, message: "API desativada." });
    }
    if (!bearerConfere(request)) {
      status = 401;
      trilha = false;
      anotarRecusaAuth(401);
      return json(401, { ok: false });
    }
    const ficha = consultarSituacao(telefone);
    if (!ficha) {
      status = 403;
      return json(403, { ok: false });
    }
    usuarioId = ficha.usuarioId;
    const apresentado = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const chaves = [chaveLimite("token", apresentado)];
    if (ficha.usuarioId) chaves.push(chaveLimite("pessoa", ficha.usuarioId));
    const limite = consumirLimiteApi(chaves);
    if (!limite.permitido) {
      status = 429;
      return json(429, { ok: false }, { "retry-after": String(limite.retryAfter) });
    }
    status = 200;
    return json(200, ficha.corpo);
  } catch {
    status = 500;
    return json(500, { ok: false });
  } finally {
    if (trilha) auditar(request, status, usuarioId, inicio);
  }
}

export function atenderFechado(request: Request) {
  const inicio = performance.now();
  const telefone = request.headers.get("x-bot-telefone");
  auditar(request, 405, idSePossivel(telefone), inicio);
  return json(405, { ok: false }, { allow: "GET" });
}

export function metodosFechados() {
  const fechar = (request: Request) => atenderFechado(request);
  return { POST: fechar, PUT: fechar, PATCH: fechar, DELETE: fechar };
}
