/**
 * Sessão do login único do site.
 * Só Web Crypto (middleware no Edge). Não importar `node:crypto` nem SQLite.
 * A senha não entra no cookie: o payload leva um HMAC da credencial, então
 * trocar usuário ou senha invalida sessões já emitidas.
 */
export const PAINEL_USUARIO_ENV = "AIONSCOPE_PAINEL_USUARIO";
export const PAINEL_SENHA_ENV = "AIONSCOPE_PAINEL_SENHA";
export const SESSION_SECRET_ENV = "SESSION_SECRET";
export const COOKIE_SESSAO_PAINEL = "aion_painel_sessao";
export const SECRET_MIN = 32;
export const SESSAO_PAINEL_S = 90 * 24 * 60 * 60;
/** Reemite o cookie depois de mais de um dia desde a emissão. */
export const RENOVACAO_PAINEL_S = 24 * 60 * 60;
const VERSAO = 1;
const ROTULO_CREDENCIAL = "aionscope-painel-credencial-v1";

function usuarioConfigurado() {
  return (process.env[PAINEL_USUARIO_ENV] ?? "").trim();
}

function senhaConfigurada() {
  return (process.env[PAINEL_SENHA_ENV] ?? "").trim();
}

function segredoConfigurado() {
  return process.env[SESSION_SECRET_ENV] ?? "";
}

/** Usuário, senha e SESSION_SECRET (mínimo 32) presentes. Senão o painel não abre. */
export function painelConfigurado() {
  return usuarioConfigurado().length > 0 && senhaConfigurada().length > 0 && segredoConfigurado().length >= SECRET_MIN;
}

function bytesParaBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlParaBytes(texto: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(texto)) return null;
  const pad = texto.length % 4 === 0 ? "" : "=".repeat(4 - (texto.length % 4));
  try {
    const bin = atob(texto.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    if (bytesParaBase64Url(out) !== texto) return null;
    return out;
  } catch {
    return null;
  }
}

function iguais(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function chaveHmac(segredo: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function hmac(segredo: string, dados: string) {
  const chave = await chaveHmac(segredo);
  const sig = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(dados));
  return new Uint8Array(sig);
}

/** Impressão da credencial atual. Muda quando usuário ou senha mudam. */
export async function impressaoCredencial() {
  if (!painelConfigurado()) return null;
  const mac = await hmac(segredoConfigurado(), `${ROTULO_CREDENCIAL}\0${usuarioConfigurado()}\0${senhaConfigurada()}`);
  return bytesParaBase64Url(mac);
}

export function cookiePainel(token: string, maxAge = SESSAO_PAINEL_S) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_SESSAO_PAINEL}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function cookiePainelApagar() {
  return cookiePainel("", 0);
}

export function lerCookie(request: Request, nome: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    if (parte.slice(0, i).trim() !== nome) continue;
    const valor = parte.slice(i + 1).trim();
    try {
      return decodeURIComponent(valor);
    } catch {
      return null;
    }
  }
  return null;
}

type Payload = { v: number; iat: number; exp: number; c: string };

function payloadDe(token: string): { corpo: string; payload: Payload } | null {
  if (token.length > 4096) return null;
  const ponto = token.indexOf(".");
  if (ponto <= 0 || ponto !== token.lastIndexOf(".")) return null;
  const corpo = token.slice(0, ponto);
  const sig = token.slice(ponto + 1);
  if (!corpo || !sig) return null;
  const bytes = base64UrlParaBytes(corpo);
  if (!bytes) return null;
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const bruto = json as Record<string, unknown>;
  const { v, iat, exp, c } = bruto;
  if (v !== VERSAO || typeof c !== "string" || !Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)) return null;
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(c)) return null;
  return { corpo: `${corpo}.${sig}`, payload: { v, iat: iat as number, exp: exp as number, c } };
}

async function assinaturaConfere(token: string) {
  const ponto = token.indexOf(".");
  const corpo = token.slice(0, ponto);
  const sig = base64UrlParaBytes(token.slice(ponto + 1));
  if (!sig || sig.length !== 32) return false;
  const chave = await chaveHmac(segredoConfigurado());
  const copia = new Uint8Array(sig);
  return crypto.subtle.verify("HMAC", chave, copia, new TextEncoder().encode(corpo));
}

export type SessaoPainel =
  | { ok: true; renovar: boolean; iat: number }
  | { ok: false; renovar: false; iat: null };

export async function lerSessaoPainel(token: string | null | undefined, agoraMs = Date.now()): Promise<SessaoPainel> {
  const negada: SessaoPainel = { ok: false, renovar: false, iat: null };
  if (!painelConfigurado() || !token) return negada;
  const lido = payloadDe(token);
  if (!lido) return negada;
  if (!(await assinaturaConfere(token))) return negada;
  const agoraS = Math.floor(agoraMs / 1000);
  const { iat, exp, c } = lido.payload;
  if (iat > agoraS + 60) return negada;
  if (exp <= agoraS) return negada;
  if (exp > iat + SESSAO_PAINEL_S) return negada;
  if (exp <= iat) return negada;
  const atual = await impressaoCredencial();
  const informado = base64UrlParaBytes(c);
  const esperado = atual ? base64UrlParaBytes(atual) : null;
  if (!informado || !esperado || !iguais(informado, esperado)) return negada;
  return { ok: true, renovar: agoraS - iat > RENOVACAO_PAINEL_S, iat };
}

export async function emitirSessaoPainel(agoraMs = Date.now()) {
  if (!painelConfigurado()) return null;
  const c = await impressaoCredencial();
  if (!c) return null;
  const iat = Math.floor(agoraMs / 1000);
  const exp = iat + SESSAO_PAINEL_S;
  const json = JSON.stringify({ v: VERSAO, iat, exp, c });
  const corpo = bytesParaBase64Url(new TextEncoder().encode(json));
  const sig = bytesParaBase64Url(await hmac(segredoConfigurado(), corpo));
  return `${corpo}.${sig}`;
}
