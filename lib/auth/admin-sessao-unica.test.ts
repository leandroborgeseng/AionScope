import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { ORIGENS_PERMITIDAS_ENV } from "@/lib/bot/origem";
import { closeDbForTests, getDb } from "../db/client";
import * as bot from "../../app/api/cadastros/bot-usuarios/route";
import * as contratos from "../../app/api/cadastros/contratos/route";
import * as sessao from "../../app/api/cadastros/contratos/sessao/route";
import * as registros from "../../app/api/sala/registros/route";
import * as desbloquear from "../../app/api/treinamentos/evidencias/desbloquear/route";
import * as logoutRota from "../../app/api/v1/painel/logout/route";
import {
  COOKIE_SESSAO_CONTRATOS,
  cookieSessao,
  criarTokenSessao,
} from "./contratos-sessao";
import {
  COOKIE_SESSAO_PAINEL,
  GERACAO_PAINEL_ENV,
  TETO_ABSOLUTO_PAINEL_S,
  cookiePainel,
  cookiePainelApagar,
  emitirSessaoPainel,
} from "./painel-sessao";

const SENHA_CONTRATOS = "senha-ficticia-de-teste";
const SEGREDO = "s".repeat(40);
const ORIGEM = "https://painel.exemplo.test";
const GERACAO = "geracao-atual";
const URL_CONTRATOS = "http://local/api/cadastros/contratos";

let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-admin-unica-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.AIONSCOPE_PAINEL_USUARIO = "aion";
  process.env.AIONSCOPE_PAINEL_SENHA = "senha-painel-teste-xyz";
  process.env.SESSION_SECRET = SEGREDO;
  process.env.CONTRATOS_ADMIN_PASSWORD = SENHA_CONTRATOS;
  process.env[GERACAO_PAINEL_ENV] = GERACAO;
  process.env[ORIGENS_PERMITIDAS_ENV] = ORIGEM;
  process.env.TREINAMENTOS_EVIDENCIAS_TOKEN = "token-ficticio-de-teste";
  getDb().exec("DELETE FROM painel_sessao_revogacao");
});

function definirNodeEnv(valor: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (valor === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = valor;
}

async function emitirCenarios() {
  process.env[GERACAO_PAINEL_ENV] = "geracao-antiga";
  const geracaoAntiga = await emitirSessaoPainel();
  process.env[GERACAO_PAINEL_ENV] = GERACAO;
  const valida = await emitirSessaoPainel();
  const vencida = await emitirSessaoPainel(Date.now(), Date.now() - (TETO_ABSOLUTO_PAINEL_S + 60) * 1000);
  assert.ok(valida);
  assert.ok(vencida);
  assert.ok(geracaoAntiga);
  return { valida, vencida, geracaoAntiga };
}

function cookiePainelDe(token: string) {
  return `${COOKIE_SESSAO_PAINEL}=${token}`;
}

async function assertNegado(res: Response, onde: string) {
  assert.ok(res.status === 401 || res.status === 403, `${onde}: status ${res.status}`);
  const body = (await res.json()) as { ok?: boolean };
  assert.equal(body.ok, false, onde);
}

test("cadastros, sala, treinamentos e bot aceitam o painel e mantêm o cookie antigo", async () => {
  const { valida, vencida, geracaoAntiga } = await emitirCenarios();
  const painel = cookiePainelDe(valida);
  const teto = cookiePainelDe(vencida);
  const antiga = cookiePainelDe(geracaoAntiga);
  const contratosCookie = `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`;
  const adulterado = cookiePainelDe(valida.slice(0, -1) + (valida.endsWith("a") ? "b" : "a"));

  const getContratos = (cookie?: string) =>
    contratos.GET(new Request(URL_CONTRATOS, cookie ? { headers: { cookie } } : undefined));
  assert.equal((await getContratos(painel)).status, 200, "painel válida");
  await assertNegado(await getContratos(teto), "cadastros teto 8 h");
  await assertNegado(await getContratos(antiga), "cadastros geração antiga");
  await assertNegado(await getContratos(), "cadastros sem cookie");
  await assertNegado(await getContratos(adulterado), "cadastros assinatura");
  assert.equal((await getContratos(contratosCookie)).status, 200, "sessão antiga de contratos");

  const novo = {
    fornecedor: "ACME",
    equipamento: "BOMBA",
    tipo: "MANUTENCAO",
    valorMensal: 10,
    inicio: "2026-01-01",
    fim: "2027-01-01",
  };
  const postContrato = (cookie?: string, equipamento = "BOMBA") =>
    contratos.POST(
      new Request(URL_CONTRATOS, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGEM, ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ ...novo, equipamento }),
      }),
    );
  assert.equal((await postContrato(painel, "BOMBA PAINEL")).status, 201);
  await assertNegado(await postContrato(teto, "BOMBA TETO"), "escrita cadastros teto");
  await assertNegado(await postContrato(antiga, "BOMBA GERACAO"), "escrita cadastros geração");
  await assertNegado(await postContrato(undefined, "BOMBA NENHUM"), "escrita cadastros sem cookie");
  assert.equal((await postContrato(contratosCookie, "BOMBA CONTRATOS")).status, 201);

  const lerSessao = async (cookie?: string) => {
    const res = await sessao.GET(
      new Request(`${URL_CONTRATOS}/sessao`, cookie ? { headers: { cookie } } : undefined),
    );
    const body = (await res.json()) as { data: { autenticado: boolean } };
    return body.data.autenticado;
  };
  assert.equal(await lerSessao(painel), true);
  assert.equal(await lerSessao(teto), false);
  assert.equal(await lerSessao(antiga), false);
  assert.equal(await lerSessao(), false);
  assert.equal(await lerSessao(contratosCookie), true);

  const postSala = (cookie?: string) =>
    registros.POST(
      new Request("http://local/api/sala/registros", {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGEM, ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ tipo: "feriado", data: "2026-12-25", nome: "Feriado DEMO" }),
      }),
    );
  const salaOk = await postSala(painel);
  assert.ok(salaOk.status === 200 || salaOk.status === 201, `sala status ${salaOk.status}`);
  await assertNegado(await postSala(teto), "sala teto");
  await assertNegado(await postSala(antiga), "sala geração");
  await assertNegado(await postSala(), "sala sem cookie");

  const postTreino = (cookie?: string) =>
    desbloquear.POST(
      new Request("http://local/api/treinamentos/evidencias/desbloquear", {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGEM, ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ token: "token-ficticio-de-teste" }),
      }),
    );
  assert.equal((await postTreino(painel)).status, 200);
  await assertNegado(await postTreino(teto), "treinamentos teto");
  await assertNegado(await postTreino(antiga), "treinamentos geração");
  await assertNegado(await postTreino(), "treinamentos sem cookie");

  const postBot = (cookie: string | undefined, telefone: string) =>
    bot.POST(
      new Request("http://local/api/cadastros/bot-usuarios", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGEM,
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({
          nome: "Ana Exemplo",
          papel: "Compras",
          telefone,
          email: "ana.zzteste@exemplo.invalid",
          setor: "UTI ZZTESTE",
        }),
      }),
    );
  assert.equal((await postBot(painel, "+55 11 90000-0101")).status, 201);
  await assertNegado(await postBot(teto, "+55 11 90000-0102"), "bot teto");
  await assertNegado(await postBot(antiga, "+55 11 90000-0103"), "bot geração");
  await assertNegado(await postBot(undefined, "+55 11 90000-0104"), "bot sem cookie");
  assert.equal((await postBot(contratosCookie, "+55 11 90000-0105")).status, 201);
});

function atributosSemIdade(cookie: string) {
  return cookie
    .split(";")
    .slice(1)
    .map((parte) => parte.trim())
    .filter((parte) => !parte.startsWith("Max-Age="))
    .sort();
}

test("logout do painel limpa os dois cookies com path, domain e secure iguais", async () => {
  const semOrigem = await logoutRota.POST(new Request("http://local/api/v1/painel/logout", { method: "POST" }));
  assert.equal(semOrigem.status, 403);
  assert.equal(semOrigem.headers.getSetCookie().length, 0);

  const antes = process.env.NODE_ENV;
  const pedir = () =>
    logoutRota.POST(
      new Request("http://local/api/v1/painel/logout", { method: "POST", headers: { origin: "http://local" } }),
    );

  definirNodeEnv("production");
  const prod = await pedir();
  assert.equal(prod.status, 303);
  assert.equal(prod.headers.get("location"), "/login");
  const cookiesProd = prod.headers.getSetCookie();
  assert.deepEqual(cookiesProd, [cookiePainelApagar(), cookieSessao("", 0)]);
  assert.deepEqual(atributosSemIdade(cookiePainelApagar()), atributosSemIdade(cookiePainel("tok")));
  assert.deepEqual(atributosSemIdade(cookieSessao("", 0)), atributosSemIdade(cookieSessao("tok")));
  for (const cookie of cookiesProd) {
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /Secure/);
    assert.equal(/Domain=/i.test(cookie), false);
    assert.match(cookie, /Max-Age=0/);
  }

  definirNodeEnv("test");
  const teste = await pedir();
  const cookiesTeste = teste.headers.getSetCookie();
  assert.deepEqual(cookiesTeste, [cookiePainelApagar(), cookieSessao("", 0)]);
  for (const cookie of cookiesTeste) assert.equal(cookie.includes("Secure"), false);
  definirNodeEnv(antes);
});

test("sair do admin e o logout invalidam o cookie do painel copiado", async () => {
  const { valida } = await emitirCenarios();
  const cookie = cookiePainelDe(valida);
  assert.equal((await contratos.GET(new Request(URL_CONTRATOS, { headers: { cookie } }))).status, 200);

  const semOrigem = await sessao.DELETE(
    new Request(`${URL_CONTRATOS}/sessao`, { method: "DELETE", headers: { cookie } }),
  );
  assert.equal(semOrigem.status, 403);
  assert.equal(semOrigem.headers.getSetCookie().length, 0);
  assert.equal((await contratos.GET(new Request(URL_CONTRATOS, { headers: { cookie } }))).status, 200);

  const sair = await sessao.DELETE(
    new Request(`${URL_CONTRATOS}/sessao`, { method: "DELETE", headers: { cookie, origin: "http://local" } }),
  );
  assert.equal(sair.status, 200);
  const cookies = sair.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[0] ?? "", new RegExp(`^${COOKIE_SESSAO_PAINEL}=;`));
  assert.match(cookies[1] ?? "", new RegExp(`^${COOKIE_SESSAO_CONTRATOS}=;`));
  for (const item of cookies) {
    assert.match(item, /Path=\//);
    assert.match(item, /HttpOnly/);
    assert.match(item, /SameSite=Lax/);
    assert.match(item, /Max-Age=0/);
    assert.equal(/Domain=/i.test(item), false);
  }
  assert.equal((await contratos.GET(new Request(URL_CONTRATOS, { headers: { cookie } }))).status, 401);

  const outra = await emitirSessaoPainel();
  assert.ok(outra);
  const cookieNova = cookiePainelDe(outra);
  assert.equal((await contratos.GET(new Request(URL_CONTRATOS, { headers: { cookie: cookieNova } }))).status, 200);
  const logout = await logoutRota.POST(
    new Request("http://local/api/v1/painel/logout", { method: "POST", headers: { origin: "http://local" } }),
  );
  assert.equal(logout.status, 303);
  assert.equal((await contratos.GET(new Request(URL_CONTRATOS, { headers: { cookie: cookieNova } }))).status, 401);
});
