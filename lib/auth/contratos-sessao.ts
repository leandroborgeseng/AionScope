/**
 * Sessão de escrita do cadastro de contratos (D1 opção b).
 * - Senha única de admin em CONTRATOS_ADMIN_PASSWORD; cookie assinado (HMAC-SHA256) com SESSION_SECRET.
 * - Sem as duas variáveis (ou segredo curto), o login é recusado e a escrita fica sempre 401.
 * - A senha nunca é registrada em log nem devolvida em resposta.
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const CONTRATOS_ADMIN_PASSWORD_ENV = "CONTRATOS_ADMIN_PASSWORD";
export const SESSION_SECRET_ENV = "SESSION_SECRET";
export const COOKIE_SESSAO_CONTRATOS = "aion_contratos_sessao";
export const SESSAO_DURACAO_S = 8 * 60 * 60;
const SECRET_MIN = 32;
const ESCOPO = "contratos:escrita";

function senhaConfigurada() {
  return process.env[CONTRATOS_ADMIN_PASSWORD_ENV] ?? "";
}
function segredoConfigurado() {
  return process.env[SESSION_SECRET_ENV] ?? "";
}

export function authContratosConfigurada() {
  return senhaConfigurada().length > 0 && segredoConfigurado().length >= SECRET_MIN;
}

function iguais(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function senhaConfere(senha: unknown) {
  if (!authContratosConfigurada() || typeof senha !== "string" || !senha) return false;
  const h = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return iguais(h(senha), h(senhaConfigurada()));
}

function assinar(exp: number) {
  return createHmac("sha256", segredoConfigurado()).update(`${ESCOPO}:${exp}`).digest("base64url");
}

export function criarTokenSessao(agoraMs = Date.now()) {
  const exp = Math.floor(agoraMs / 1000) + SESSAO_DURACAO_S;
  return `${exp}.${assinar(exp)}`;
}

export function tokenSessaoValido(token: string | null | undefined, agoraMs = Date.now()) {
  if (!authContratosConfigurada() || !token) return false;
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{20,})$/.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp * 1000 <= agoraMs) return false;
  return iguais(Buffer.from(m[2]), Buffer.from(assinar(exp)));
}

export function lerCookie(request: Request, nome: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

export function sessaoContratosValida(request: Request) {
  return tokenSessaoValido(lerCookie(request, COOKIE_SESSAO_CONTRATOS));
}

export function cookieSessao(token: string, maxAge = SESSAO_DURACAO_S) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_SESSAO_CONTRATOS}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** null = autorizado; senão a resposta 401. */
export function exigirSessaoContratos(request: Request): Response | null {
  if (sessaoContratosValida(request)) return null;
  return Response.json(
    { ok: false, message: "Entre com a senha de administrador para alterar contratos." },
    { status: 401 },
  );
}

/**
 * IP para o limite de tentativas: só o ÚLTIMO item do X-Forwarded-For (o que o proxy de borda anexou);
 * os itens anteriores vêm do cliente e podem ser forjados. Sem XFF: x-real-ip; senão "conexao".
 * Não há teto global de falhas (decisão do TL): só o limite por IP.
 */
export function ipDe(request: Request) {
  const ultimo = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .pop();
  return ultimo || request.headers.get("x-real-ip")?.trim() || "conexao";
}

// Limite simples de tentativas (em memória, por IP): 5 falhas a cada 15 min.
const falhas = new Map<string, { n: number; ate: number }>();
export function loginBloqueado(ip: string, agora = Date.now()) {
  const f = falhas.get(ip);
  return Boolean(f && f.ate > agora && f.n >= 5);
}
export function registrarFalha(ip: string, agora = Date.now()) {
  const f = falhas.get(ip);
  if (!f || f.ate <= agora) falhas.set(ip, { n: 1, ate: agora + 15 * 60_000 });
  else f.n += 1;
}
export function limparFalhas(ip: string) {
  falhas.delete(ip);
}
