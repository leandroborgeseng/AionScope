import { credencialConfere } from "@/lib/auth/painel-credencial";
import { destinoSeguro } from "@/lib/auth/painel-guard";
import { ipLogin, limiteLogin, limparFalhasLogin, registrarFalhaLogin } from "@/lib/auth/painel-limite";
import { cookiePainel, emitirSessaoPainel, painelConfigurado } from "@/lib/auth/painel-sessao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMITE_CORPO = 4096;
const MSG_ERRO = "Usuário ou senha incorretos.";
const MSG_LIMITE = "Muitas tentativas. Tente de novo em alguns minutos.";
const MSG_INDISPONIVEL = "Login indisponível.";

function querJson(request: Request) {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

function json(status: number, message: string, extra?: { retryAfter?: number; cookie?: string; next?: string }) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
  });
  if (extra?.retryAfter) headers.set("Retry-After", String(extra.retryAfter));
  if (extra?.cookie) headers.set("Set-Cookie", extra.cookie);
  const body = extra?.next ? { ok: true, next: extra.next } : { ok: false, message };
  return new Response(JSON.stringify(body), { status, headers });
}

function voltar(next: string | null, erro: "1" | "limite") {
  const q = new URLSearchParams();
  q.set("erro", erro);
  if (next) q.set("next", next);
  return new Response(null, {
    status: 303,
    headers: { Location: `/login?${q}`, "Cache-Control": "private, no-store" },
  });
}

type Campos = { usuario: unknown; senha: unknown; next: unknown };

function camposDe(texto: string, jsonBody: boolean): Campos | null {
  if (jsonBody) {
    try {
      const body = JSON.parse(texto) as unknown;
      if (!body || typeof body !== "object" || Array.isArray(body)) return { usuario: "", senha: "", next: undefined };
      const o = body as Record<string, unknown>;
      return { usuario: o.usuario, senha: o.senha, next: o.next };
    } catch {
      return null;
    }
  }
  const params = new URLSearchParams(texto);
  return { usuario: params.get("usuario") ?? "", senha: params.get("senha") ?? "", next: params.get("next") };
}

export async function POST(request: Request) {
  const jsonBody = querJson(request);
  const nextInformado = destinoSeguro(
    new URL(request.url).searchParams.get("next"),
  );
  if (!painelConfigurado()) {
    if (jsonBody) return json(503, MSG_INDISPONIVEL);
    return new Response(null, {
      status: 303,
      headers: { Location: "/login", "Cache-Control": "private, no-store" },
    });
  }

  const anunciado = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(anunciado) && anunciado > LIMITE_CORPO) {
    return jsonBody ? json(400, MSG_ERRO) : voltar(nextInformado, "1");
  }

  let texto = "";
  try {
    texto = await request.text();
  } catch {
    return jsonBody ? json(400, MSG_ERRO) : voltar(nextInformado, "1");
  }
  if (texto.length > LIMITE_CORPO) return jsonBody ? json(400, MSG_ERRO) : voltar(nextInformado, "1");

  const campos = camposDe(texto, jsonBody);
  if (!campos) return jsonBody ? json(400, MSG_ERRO) : voltar(nextInformado, "1");

  const next = destinoSeguro(typeof campos.next === "string" ? campos.next : null) ?? nextInformado;
  const ip = ipLogin(request);
  const limite = limiteLogin(ip);
  if (limite.bloqueado) {
    if (jsonBody) return json(429, MSG_LIMITE, { retryAfter: limite.retryAfter });
    const volta = `/login?erro=limite${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Entrar</title><p>${MSG_LIMITE}</p><p><a href="${volta}">Voltar</a></p>`,
      {
        status: 429,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Retry-After": String(limite.retryAfter),
        },
      },
    );
  }

  if (!credencialConfere(campos.usuario, campos.senha)) {
    registrarFalhaLogin(ip);
    return jsonBody ? json(401, MSG_ERRO) : voltar(next, "1");
  }

  limparFalhasLogin(ip);
  const token = await emitirSessaoPainel();
  if (!token) return jsonBody ? json(503, MSG_INDISPONIVEL) : voltar(null, "1");
  const destino = next ?? "/";
  const cookie = cookiePainel(token);
  if (jsonBody) return json(200, "", { cookie, next: destino });
  return new Response(null, {
    status: 303,
    headers: { Location: destino, "Cache-Control": "private, no-store", "Set-Cookie": cookie },
  });
}
