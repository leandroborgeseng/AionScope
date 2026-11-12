import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { criarTokenSessao } from "@/lib/auth/contratos-sessao";
import {
  ARQUIVOS_PUBLICOS,
  destinoSeguro,
  ehApi,
  normalizarCaminho,
  ROTAS_EXATAS,
  rotaLiberada,
} from "@/lib/auth/painel-guard";
import { credencialConfere } from "@/lib/auth/painel-credencial";
import { JANELA_LOGIN_MS, limiteLogin, registrarFalhaLogin } from "@/lib/auth/painel-limite";
import {
  COOKIE_SESSAO_PAINEL,
  RENOVACAO_PAINEL_S,
  SESSAO_PAINEL_S,
  cookiePainel,
  emitirSessaoPainel,
  lerSessaoPainel,
  painelConfigurado,
} from "@/lib/auth/painel-sessao";
import { TRUST_CF_CONNECTING_IP, consumirLimite } from "@/lib/bot/convite-limite";
import { closeDbForTests, getDb } from "@/lib/db/client";
import { middleware } from "../../middleware";
import { TelaLogin } from "../../app/login/tela-login";
import * as loginRota from "../../app/api/v1/painel/login/route";
import * as logoutRota from "../../app/api/v1/painel/logout/route";
import * as healthRota from "../../app/api/v1/health/route";
import * as ordensRota from "../../app/api/v1/ordens-compra/route";
import * as conviteRota from "../../app/convite/[token]/route";
import * as contratosRota from "../../app/api/cadastros/contratos/route";

const USUARIO = "painel-teste";
const SENHA = "senha-painel-teste-xyz";
const SEGREDO = "s".repeat(40);
const MSG_401 = JSON.stringify({ ok: false, message: "Não autenticado." });
const MSG_503 = JSON.stringify({ ok: false, message: "Login indisponível." });
const MSG_ERRADO = JSON.stringify({ ok: false, message: "Usuário ou senha incorretos." });

let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "painel-"));
  process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.AIONSCOPE_PAINEL_USUARIO = USUARIO;
  process.env.AIONSCOPE_PAINEL_SENHA = SENHA;
  process.env.SESSION_SECRET = SEGREDO;
  process.env.CONTRATOS_ADMIN_PASSWORD = "senha-admin-teste";
  process.env[TRUST_CF_CONNECTING_IP] = "false";
  delete process.env.ORDENS_COMPRA_API_KEY;
  getDb().exec("DELETE FROM bot_convite_limite");
});

function pedido(rota: string, cookie?: string) {
  return new NextRequest(`http://local${rota}`, cookie ? { headers: { cookie } } : undefined);
}

async function entrar(body: unknown, headers?: Record<string, string>) {
  return loginRota.POST(
    new Request("http://local/api/v1/painel/login", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function cookieDe(resposta: Response) {
  return resposta.headers.get("set-cookie") ?? "";
}

function definirNodeEnv(valor: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (valor === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = valor;
}

test("allowlist literal: rotas exatas e arquivos públicos", () => {
  assert.deepEqual(
    [...ROTAS_EXATAS],
    ["/login", "/api/v1/health", "/api/v1/painel/login", "/api/v1/painel/logout"],
  );
  assert.deepEqual(
    [...ARQUIVOS_PUBLICOS],
    [
      "/favicon.ico",
      "/aion-logo.png",
      "/aion-mark.png",
      "/file.svg",
      "/globe.svg",
      "/next.svg",
      "/vercel.svg",
      "/window.svg",
      "/vendor/niimbot.js",
    ],
  );
  const publicos: string[] = [];
  const andar = (pasta: string, prefixo: string) => {
    for (const nome of readdirSync(pasta)) {
      const abs = path.join(pasta, nome);
      const url = `${prefixo}/${nome}`;
      if (statSync(abs).isDirectory()) andar(abs, url);
      else publicos.push(url);
    }
  };
  andar("public", "");
  assert.deepEqual(
    publicos.sort(),
    ARQUIVOS_PUBLICOS.filter((item) => item !== "/favicon.ico").sort(),
  );
  assert.equal(existsSync("app/favicon.ico"), true);
  assert.equal(existsSync("app/api/bot"), false);
});

test("normalização não libera prefixo nem caminho codificado", () => {
  const token = "a".repeat(43);
  assert.equal(rotaLiberada(`/convite/${token}`), true);
  assert.equal(rotaLiberada("/convite"), false);
  assert.equal(rotaLiberada("/conviteadmin"), false);
  assert.equal(rotaLiberada("/convite/curto"), false);
  assert.equal(rotaLiberada(`/convite/${token}/extra`), false);
  assert.equal(normalizarCaminho(`/convite/${token}/`), `/convite/${token}`);
  assert.equal(normalizarCaminho("/convite/%2e%2e"), "/");
  assert.equal(normalizarCaminho("/api/v1/health/"), "/api/v1/health");
  assert.equal(rotaLiberada("/api/v1/ordens-compra"), true);
  assert.equal(rotaLiberada("/api/v1/ordens-compra/lote"), true);
  assert.equal(rotaLiberada("/api/v1/ordens-compra-extra"), false);
  assert.equal(rotaLiberada("/api/sala/ordens-compra"), false);
  assert.equal(rotaLiberada("/api/v1/health"), true);
  assert.equal(rotaLiberada("/api/v1/healthcheck"), false);
  assert.equal(rotaLiberada("/_next/static/chunk.js"), true);
  assert.equal(rotaLiberada("/_next/data/build/sala.json"), false);
  assert.equal(normalizarCaminho("/convite/foo/../admin"), "/convite/admin");
  assert.equal(rotaLiberada("/convite/admin"), false);
});

function rotasDoApp() {
  const achados: string[] = [];
  const andar = (pasta: string) => {
    for (const nome of readdirSync(pasta)) {
      const abs = path.join(pasta, nome);
      if (statSync(abs).isDirectory()) andar(abs);
      else if (nome === "page.tsx" || nome === "route.ts") {
        const rel = path.relative("app", abs).split(path.sep).join("/");
        const sem = rel.replace(/\/(page|route)\.tsx?$/, "").replace(/^(page|route)\.tsx?$/, "");
        achados.push(sem === "" ? "/" : `/${sem}`);
      }
    }
  };
  andar("app");
  return achados.sort();
}

function amostra(rota: string) {
  if (rota === "/convite/[token]") return `/convite/${"c".repeat(43)}`;
  return rota.replace(/\[[^\]]+\]/g, "exemplo");
}

test("cada rota do app, sem cookie, segue a allowlist", async () => {
  const rotas = rotasDoApp();
  assert.ok(rotas.includes("/login"));
  assert.ok(rotas.includes("/convite/[token]"));
  assert.ok(rotas.includes("/api/v1/health"));
  assert.ok(rotas.includes("/api/v1/ordens-compra"));
  assert.ok(rotas.includes("/api/sala/ordens-compra"));
  for (const rota of rotas) {
    const url = amostra(rota);
    const caminho = normalizarCaminho(url);
    assert.ok(caminho, rota);
    const resposta = await middleware(pedido(url));
    if (rotaLiberada(caminho)) {
      assert.equal(resposta.status, 200, url);
      assert.equal(resposta.headers.get("location"), null, url);
    } else if (ehApi(caminho)) {
      assert.equal(resposta.status, 401, url);
      assert.equal(await resposta.text(), MSG_401, url);
    } else {
      assert.equal(resposta.status, 302, url);
      const loc = new URL(resposta.headers.get("location") ?? "");
      assert.equal(loc.origin, "http://local", url);
      assert.equal(loc.pathname, "/login", url);
      assert.match(loc.searchParams.get("next") ?? "", /^\//, url);
    }
  }
});

test("página protegida sem cookie redireciona; API responde 401", async () => {
  const pagina = await middleware(pedido("/sala/pedidos?status=aberta"));
  assert.equal(pagina.status, 302);
  const loc = new URL(pagina.headers.get("location") ?? "");
  assert.equal(loc.origin, "http://local");
  assert.equal(loc.pathname, "/login");
  assert.equal(loc.searchParams.get("next"), "/sala/pedidos?status=aberta");

  const api = await middleware(pedido("/api/sala/snapshot"));
  assert.equal(api.status, 401);
  assert.equal(await api.text(), MSG_401);
});

test("convite e health seguem acessíveis sem cookie", async () => {
  const token = "d".repeat(43);
  const convite = await middleware(pedido(`/convite/${token}`));
  assert.equal(convite.status, 200);
  const html = await conviteRota.GET(new Request(`http://local/convite/${token}`), {
    params: Promise.resolve({ token }),
  });
  assert.equal(html.status, 200);

  const healthGate = await middleware(pedido("/api/v1/health"));
  assert.equal(healthGate.status, 200);
  const health = await healthRota.GET(new Request("http://local/api/v1/health"));
  assert.equal(health.status, 200);
});

test("cookie expirado ou com assinatura adulterada não abre", async () => {
  const expirado = await emitirSessaoPainel(Date.now() - (SESSAO_PAINEL_S + 86_400) * 1000);
  assert.ok(expirado);
  assert.equal((await lerSessaoPainel(expirado)).ok, false);
  const negado = await middleware(pedido("/sala", `${COOKIE_SESSAO_PAINEL}=${expirado}`));
  assert.equal(negado.status, 302);

  const valido = await emitirSessaoPainel();
  assert.ok(valido);
  const ponto = valido.lastIndexOf(".");
  const meio = ponto + 1 + Math.floor((valido.length - ponto) / 2);
  const troca = valido[meio] === "A" ? "B" : "A";
  const adulterado = `${valido.slice(0, meio)}${troca}${valido.slice(meio + 1)}`;
  assert.notEqual(adulterado, valido);
  assert.equal((await lerSessaoPainel(adulterado)).ok, false);
  const api = await middleware(pedido("/api/sala/snapshot", `${COOKIE_SESSAO_PAINEL}=${adulterado}`));
  assert.equal(api.status, 401);
});

test("trocar a senha invalida a sessão antiga", async () => {
  const token = await emitirSessaoPainel();
  assert.equal((await lerSessaoPainel(token)).ok, true);
  process.env.AIONSCOPE_PAINEL_SENHA = "outra-senha-de-teste";
  assert.equal((await lerSessaoPainel(token)).ok, false);
});

test("sem usuário, senha ou SESSION_SECRET o painel fica fechado", async () => {
  for (const nome of ["AIONSCOPE_PAINEL_USUARIO", "AIONSCOPE_PAINEL_SENHA", "SESSION_SECRET"]) {
    const anterior = process.env[nome];
    delete process.env[nome];
    assert.equal(painelConfigurado(), false, nome);
    const pagina = await middleware(pedido("/indicadores"));
    assert.equal(pagina.status, 302, nome);
    assert.match(pagina.headers.get("location") ?? "", /^http:\/\/local\/login(?:\?|$)/, nome);
    const api = await middleware(pedido("/api/pbi/lookups"));
    assert.equal(api.status, 503, nome);
    assert.equal(await api.text(), MSG_503, nome);
    const login = await entrar({ usuario: USUARIO, senha: SENHA });
    assert.equal(login.status, 503, nome);
    assert.equal(cookieDe(login), "", nome);
    assert.equal(await login.text(), MSG_503, nome);
    process.env[nome] = anterior;
  }
  process.env.SESSION_SECRET = "curto";
  assert.equal(painelConfigurado(), false);
  assert.equal((await middleware(pedido("/api/sala/snapshot"))).status, 503);
});

test("login correto emite cookie com as flags; login errado é genérico", async () => {
  const ok = await entrar({ usuario: USUARIO, senha: SENHA, next: "/sala/pedidos" });
  assert.equal(ok.status, 200);
  const corpo = await ok.json();
  assert.equal(corpo.next, "/sala/pedidos");
  const set = cookieDe(ok);
  assert.match(set, new RegExp(`^${COOKIE_SESSAO_PAINEL}=[^;]+`));
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  assert.match(set, /Path=\//);
  assert.match(set, new RegExp(`Max-Age=${SESSAO_PAINEL_S}`));
  assert.equal(/;\s*Secure/i.test(set), false);
  assert.equal(set.includes(SENHA), false);
  const token = set.split(";")[0]?.slice(COOKIE_SESSAO_PAINEL.length + 1);
  assert.equal((await lerSessaoPainel(token)).ok, true);

  const antes = process.env.NODE_ENV;
  definirNodeEnv("production");
  try {
    const prod = await entrar({ usuario: `  ${USUARIO}  `, senha: SENHA });
    assert.match(cookieDe(prod), /;\s*Secure/);
  } finally {
    definirNodeEnv(antes);
  }

  const usuarioErrado = await entrar({ usuario: "outra-pessoa", senha: SENHA });
  const senhaErrada = await entrar({ usuario: USUARIO, senha: "senha-diferente-de-teste" });
  assert.equal(usuarioErrado.status, 401);
  assert.equal(senhaErrada.status, 401);
  const textoUsuario = await usuarioErrado.text();
  const textoSenha = await senhaErrada.text();
  assert.equal(textoUsuario, MSG_ERRADO);
  assert.equal(textoSenha, MSG_ERRADO);
  assert.equal(textoUsuario.includes(SENHA), false);
  assert.equal(textoUsuario.includes(USUARIO), false);
  assert.equal(cookieDe(usuarioErrado), "");
});

test("next externo é ignorado", async () => {
  for (const ruim of ["https://evil.example", "//evil.example", "/\\evil", "sala", "", "/login", "/login?next=/sala"]) {
    assert.equal(destinoSeguro(ruim), null, JSON.stringify(ruim));
    const resposta = await entrar({ usuario: USUARIO, senha: SENHA, next: ruim });
    assert.equal(resposta.status, 200);
    const corpo = (await resposta.json()) as { next: string };
    assert.equal(corpo.next, "/", JSON.stringify(ruim));
    assert.equal(JSON.stringify(corpo).includes("evil"), false);
  }
  const form = await loginRota.POST(
    new Request("http://local/api/v1/painel/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ usuario: USUARIO, senha: SENHA, next: "https://evil.example" }),
    }),
  );
  assert.equal(form.status, 303);
  assert.equal(form.headers.get("location"), "/");
  assert.match(cookieDe(form), /HttpOnly/);
});

test("login errado repetido responde 429 com Retry-After", async () => {
  const headers = { "x-forwarded-for": "10.0.0.4, 198.51.100.20" };
  for (let i = 0; i < 5; i++) {
    const falha = await entrar({ usuario: USUARIO, senha: "errada" }, headers);
    assert.equal(falha.status, 401, String(i));
  }
  const bloqueado = await entrar({ usuario: USUARIO, senha: SENHA }, headers);
  assert.equal(bloqueado.status, 429);
  const retry = Number(bloqueado.headers.get("retry-after"));
  assert.equal(Number.isInteger(retry) && retry > 0, true);
  assert.equal(cookieDe(bloqueado), "");
  const texto = await bloqueado.text();
  assert.equal(texto.includes(SENHA), false);

  const outro = await entrar({ usuario: USUARIO, senha: SENHA }, { "x-forwarded-for": "10.0.0.4, 198.51.100.21" });
  assert.equal(outro.status, 200);
});

test("CF-Connecting-IP só conta com TRUST_CF_CONNECTING_IP=true", async () => {
  process.env[TRUST_CF_CONNECTING_IP] = "false";
  for (let i = 0; i < 5; i++) {
    await entrar({ usuario: USUARIO, senha: "errada" }, {
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "10.1.1.1, 198.51.100.30",
    });
  }
  const ignorado = await entrar({ usuario: USUARIO, senha: SENHA }, {
    "cf-connecting-ip": "203.0.113.9",
    "x-forwarded-for": "10.9.9.9, 198.51.100.31",
  });
  assert.equal(ignorado.status, 200);

  process.env[TRUST_CF_CONNECTING_IP] = "true";
  for (let i = 0; i < 5; i++) {
    await entrar({ usuario: USUARIO, senha: "errada" }, {
      "cf-connecting-ip": "203.0.113.50",
      "x-forwarded-for": "10.2.2.2, 198.51.100.40",
    });
  }
  const mesmoCf = await entrar({ usuario: USUARIO, senha: SENHA }, {
    "cf-connecting-ip": "203.0.113.50",
    "x-forwarded-for": "10.8.8.8, 198.51.100.99",
  });
  assert.equal(mesmoCf.status, 429);
});

test("falha de login não consome a cota do convite e a janela expira", () => {
  const ip = "conexao:198.51.100.77";
  const agora = 1_700_000_000_000;
  for (let i = 0; i < 5; i++) registrarFalhaLogin(ip, agora);
  assert.equal(limiteLogin(ip, agora + 1000).bloqueado, true);
  assert.equal(consumirLimite("ip", ip, agora).permitido, true);
  assert.equal(limiteLogin(ip, agora + JANELA_LOGIN_MS + 1).bloqueado, false);
});

test("renovação deslizante reemite depois de um dia e não antes", async () => {
  const base = 1_700_000_000_000;
  const token = await emitirSessaoPainel(base);
  assert.ok(token);
  assert.equal((await lerSessaoPainel(token, base + RENOVACAO_PAINEL_S * 1000)).renovar, false);
  assert.equal((await lerSessaoPainel(token, base + (RENOVACAO_PAINEL_S + 1) * 1000)).renovar, true);

  const recente = await emitirSessaoPainel(Date.now() - 60 * 60 * 1000);
  const parado = await middleware(pedido("/sala", `${COOKIE_SESSAO_PAINEL}=${recente}`));
  assert.equal(parado.status, 200);
  assert.equal(cookieDe(parado), "");

  const antigo = await emitirSessaoPainel(Date.now() - 2 * RENOVACAO_PAINEL_S * 1000);
  const renovado = await middleware(pedido("/sala", `${COOKIE_SESSAO_PAINEL}=${antigo}`));
  assert.equal(renovado.status, 200);
  const set = cookieDe(renovado);
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  const novo = set.split(";")[0]?.slice(COOKIE_SESSAO_PAINEL.length + 1);
  const sessao = await lerSessaoPainel(novo);
  assert.equal(sessao.ok, true);
  if (sessao.ok) assert.ok(sessao.iat > Math.floor((Date.now() - 2 * RENOVACAO_PAINEL_S * 1000) / 1000));
});

test("logout limpa o cookie", async () => {
  const resposta = await logoutRota.POST();
  assert.equal(resposta.status, 303);
  assert.equal(resposta.headers.get("location"), "/login");
  const set = cookieDe(resposta);
  assert.match(set, new RegExp(`^${COOKIE_SESSAO_PAINEL}=;`));
  assert.match(set, /Max-Age=0/);
  assert.match(set, /HttpOnly/);
  assert.match(set, /Path=\//);
  assert.match(set, /SameSite=Lax/);
  const depois = await middleware(pedido("/sala"));
  assert.equal(depois.status, 302);
});

test("ordens de compra seguem sem cookie e exigem a chave própria", async () => {
  process.env.ORDENS_COMPRA_API_KEY = "chave-ordens-teste";
  const url = "http://local/api/v1/ordens-compra";
  assert.equal((await middleware(pedido("/api/v1/ordens-compra"))).status, 200);
  assert.equal((await middleware(pedido("/api/v1/ordens-compra/lote"))).status, 200);
  assert.equal((await ordensRota.GET(new Request(url))).status, 401);
  const token = await emitirSessaoPainel();
  assert.equal((await ordensRota.GET(new Request(url, { headers: { cookie: `${COOKIE_SESSAO_PAINEL}=${token}` } }))).status, 401);
  assert.equal(
    (await ordensRota.GET(new Request(url, { headers: { authorization: "Bearer chave-ordens-teste" } }))).status,
    200,
  );
  assert.equal((await middleware(pedido("/api/sala/ordens-compra"))).status, 401);
});

test("a sessão do painel não substitui a senha de admin das escritas", async () => {
  const painel = await emitirSessaoPainel();
  const semAdmin = await contratosRota.POST(
    new Request("http://local/api/cadastros/contratos", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${COOKIE_SESSAO_PAINEL}=${painel}` },
      body: "{}",
    }),
  );
  assert.equal(semAdmin.status, 401);

  const comAdmin = await contratosRota.POST(
    new Request("http://local/api/cadastros/contratos", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `aion_contratos_sessao=${criarTokenSessao()}`,
      },
      body: "{}",
    }),
  );
  assert.equal(comAdmin.status, 400);
});

test("comparação não estoura com senha de tamanho diferente", () => {
  assert.equal(credencialConfere(USUARIO, "x"), false);
  assert.equal(credencialConfere(USUARIO, SENHA), true);
  assert.equal(credencialConfere("outro", SENHA), false);
});

test("tela de login: logo, erro genérico e indisponível sem formulário", () => {
  const off = renderToStaticMarkup(TelaLogin({ disponivel: false, next: "/sala", erro: "1" }));
  assert.match(off, /alt="Aion Engenharia"/);
  assert.match(off, /src="\/aion-logo.png"/);
  assert.match(off, /Login indisponível/);
  assert.equal(off.includes("type=\"password\""), false);
  assert.equal(off.includes("name=\"usuario\""), false);

  const on = renderToStaticMarkup(TelaLogin({ disponivel: true, next: "/sala/pedidos", erro: "1" }));
  assert.match(on, /Usuário ou senha incorretos\./);
  assert.match(on, /name="usuario"/);
  assert.match(on, /type="password"/);
  assert.match(on, /name="next" value="\/sala\/pedidos"/);
  assert.match(on, /max-w-md/);
  assert.match(on, /w-full/);

  const externo = renderToStaticMarkup(
    TelaLogin({ disponivel: true, next: destinoSeguro("https://evil.example"), erro: undefined }),
  );
  assert.equal(externo.includes("evil.example"), false);
});

test("o layout tem o botão Sair e esconde o menu na tela de login", () => {
  const shell = readdirSync("components/shell");
  assert.ok(shell.includes("app-shell.tsx"));
  const fonte = readFileSync("components/shell/app-shell.tsx", "utf8");
  assert.match(fonte, /action="\/api\/v1\/painel\/logout"/);
  assert.match(fonte, /\bSair\b/);
  assert.match(fonte, /pathname === "\/login"/);
});

test("cookie helper de produção leva Secure e o de teste não", () => {
  const antes = process.env.NODE_ENV;
  definirNodeEnv("test");
  assert.equal(cookiePainel("abc").includes("Secure"), false);
  definirNodeEnv("production");
  assert.match(cookiePainel("abc"), /Secure/);
  assert.match(cookiePainel("", 0), /Max-Age=0/);
  assert.match(cookiePainel("", 0), /Secure/);
  definirNodeEnv(antes);
});
