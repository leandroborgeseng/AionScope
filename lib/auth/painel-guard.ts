/**
 * Allowlist explícita do site. O que não está aqui exige a sessão do painel.
 * Páginas sem sessão: 302 para /login. APIs sem sessão: 401. Sem a credencial
 * configurada, a API responde 503 e a página cai no login (que mostra indisponível).
 */
import { NextResponse } from "next/server";
import { voltarSeguro } from "@/lib/auth/sessao-ui";
import {
  COOKIE_SESSAO_PAINEL,
  cookiePainel,
  emitirSessaoPainel,
  lerCookie,
  lerSessaoPainel,
  painelConfigurado,
} from "@/lib/auth/painel-sessao";

/** Token do convite: o mesmo formato que `buscarConviteAberto` aceita. Um segmento só. */
const TOKEN_CONVITE = /^[A-Za-z0-9_-]{20,200}$/;

export const ROTAS_EXATAS = [
  "/login",
  "/api/v1/health",
  "/api/v1/painel/login",
  "/api/v1/painel/logout",
] as const;

/** Arquivos de `public/` e o favicon de `app/favicon.ico`. Sem dado confidencial. */
export const ARQUIVOS_PUBLICOS = [
  "/favicon.ico",
  "/aion-logo.png",
  "/aion-mark.png",
  "/file.svg",
  "/globe.svg",
  "/next.svg",
  "/vercel.svg",
  "/window.svg",
  "/vendor/niimbot.js",
] as const;

const MSG_401 = "Não autenticado.";
const MSG_503 = "Login indisponível.";

export function normalizarCaminho(bruto: string) {
  if (typeof bruto !== "string" || bruto.length === 0 || bruto.length > 2048) return null;
  if (bruto.includes("?") || bruto.includes("#")) return null;
  let path = bruto;
  for (let i = 0; i < 2 && /%[0-9a-fA-F]{2}/.test(path); i++) {
    try {
      const dec = decodeURIComponent(path);
      if (dec === path) break;
      path = dec;
    } catch {
      return null;
    }
  }
  if (!path.startsWith("/")) return null;
  if (path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path)) return null;
  const partes: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (partes.length === 0) return null;
      partes.pop();
      continue;
    }
    partes.push(seg);
  }
  return `/${partes.join("/")}`;
}

function conviteLiberado(caminho: string) {
  const match = /^\/convite\/([^/]+)$/.exec(caminho);
  return Boolean(match && TOKEN_CONVITE.test(match[1]!));
}

function ordensLiberada(caminho: string) {
  return caminho === "/api/v1/ordens-compra" || caminho.startsWith("/api/v1/ordens-compra/");
}

function estaticoLiberado(caminho: string) {
  return caminho.startsWith("/_next/static/") || caminho === "/_next/image" || caminho.startsWith("/_next/image/");
}

export function rotaLiberada(caminho: string) {
  if ((ROTAS_EXATAS as readonly string[]).includes(caminho)) return true;
  if ((ARQUIVOS_PUBLICOS as readonly string[]).includes(caminho)) return true;
  if (estaticoLiberado(caminho)) return true;
  if (conviteLiberado(caminho)) return true;
  if (ordensLiberada(caminho)) return true;
  return false;
}

export function ehApi(caminho: string) {
  return caminho === "/api" || caminho.startsWith("/api/");
}

/** Caminho interno para voltar depois do login. Recusa URL absoluta e protocolo relativo. */
export function destinoSeguro(valor: string | null | undefined) {
  const seguro = voltarSeguro(typeof valor === "string" ? valor : null);
  if (!seguro) return null;
  if (seguro === "/login" || seguro.startsWith("/login?") || seguro.startsWith("/login#")) return null;
  return seguro;
}

function locationLogin(caminho: string, search: string) {
  const next = destinoSeguro(`${caminho}${search}`);
  if (!next) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

function redirecionar(request: Request, location: string) {
  // O runtime Edge recusa Location relativo (Invalid URL). A origem é a do
  // próprio pedido, e `next` continua sendo só o caminho interno.
  const destino = new URL(location, request.url);
  const resposta = NextResponse.redirect(destino, 302);
  resposta.headers.set("Cache-Control", "private, no-store");
  return resposta;
}

function jsonFechado(status: 401 | 503, message: string) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function semCacheSePainel(caminho: string, resposta: NextResponse) {
  if (caminho === "/login" || caminho.startsWith("/api/v1/painel/")) {
    resposta.headers.set("Cache-Control", "private, no-store");
  }
  return resposta;
}

export async function decidirPainel(request: Request) {
  const url = new URL(request.url);
  const caminho = normalizarCaminho(url.pathname);
  if (!caminho) {
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") return jsonFechado(401, MSG_401);
    return redirecionar(request, "/login");
  }
  if (rotaLiberada(caminho)) return semCacheSePainel(caminho, NextResponse.next());

  const api = ehApi(caminho);
  if (!painelConfigurado()) {
    if (api) return jsonFechado(503, MSG_503);
    return redirecionar(request, locationLogin(caminho, url.search));
  }

  const sessao = await lerSessaoPainel(lerCookie(request, COOKIE_SESSAO_PAINEL));
  if (!sessao.ok) {
    if (api) return jsonFechado(401, MSG_401);
    return redirecionar(request, locationLogin(caminho, url.search));
  }

  const resposta = NextResponse.next();
  resposta.headers.set("Cache-Control", "private, no-store");
  if (sessao.renovar) {
    const novo = await emitirSessaoPainel();
    if (novo) resposta.headers.append("Set-Cookie", cookiePainel(novo));
  }
  return resposta;
}
