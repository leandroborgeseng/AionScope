import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { closeDbForTests } from "../db/client";
import {
  COOKIE_SESSAO_CONTRATOS,
  criarTokenSessao,
  limparFalhas,
  tokenSessaoValido,
} from "./contratos-sessao";
import * as rotaLista from "../../app/api/cadastros/contratos/route";
import * as rotaItem from "../../app/api/cadastros/contratos/[id]/route";
import * as rotaSessao from "../../app/api/cadastros/contratos/sessao/route";
import * as rotaOrdens from "../../app/api/v1/ordens-compra/route";

const SENHA = "senha-de-teste-local";
const SEGREDO = "s".repeat(40);
let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "contratos-api-"));
  process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
  closeDbForTests();
});
after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  process.env.CONTRATOS_ADMIN_PASSWORD = SENHA;
  process.env.SESSION_SECRET = SEGREDO;
  for (const ip of ["conexao", "9.9.9.9", "8.8.8.8", "7.7.7.7"]) limparFalhas(ip);
});

const URL_BASE = "http://local/api/cadastros/contratos";
const json = (method: string, body: unknown, cookie?: string) =>
  new Request(URL_BASE, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const novo = { fornecedor: "ACME", equipamento: "BOMBA", tipo: "MANUTENCAO", valorMensal: 10, inicio: "2026-01-01", fim: "2027-01-01" };

async function login(senha = SENHA) {
  const r = await rotaSessao.POST(json("POST", { senha }));
  const set = r.headers.get("set-cookie") ?? "";
  return { status: r.status, cookie: set.split(";")[0] };
}

test("token: assinatura, expiração e adulteração", () => {
  const t = criarTokenSessao(0);
  assert.equal(tokenSessaoValido(t, 1000), true);
  assert.equal(tokenSessaoValido(t, 9 * 3600 * 1000), false);
  assert.equal(tokenSessaoValido(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")), 1000), false);
  process.env.SESSION_SECRET = "o".repeat(40);
  assert.equal(tokenSessaoValido(t, 1000), false, "outro segredo invalida");
});

test("escrita e leitura sem sessão = 401 (GET/POST/PATCH/DELETE)", async () => {
  assert.equal((await rotaLista.POST(json("POST", novo))).status, 401);
  assert.equal((await rotaItem.PATCH(json("PATCH", { ativo: false }), ctx("x"))).status, 401);
  assert.equal((await rotaItem.DELETE(json("DELETE", {}), ctx("x"))).status, 401);
  assert.equal((await rotaLista.POST(json("POST", novo, `${COOKIE_SESSAO_CONTRATOS}=lixo.abcdefghijklmnopqrstuvwxyz`))).status, 401);
  assert.equal((await rotaLista.GET(new Request(URL_BASE))).status, 401);
});

test("sem envs: login recusado e escrita sempre 401", async () => {
  const { cookie } = await login();
  delete process.env.CONTRATOS_ADMIN_PASSWORD;
  assert.equal((await login()).status, 401);
  assert.equal((await rotaLista.POST(json("POST", novo, cookie))).status, 401);
  process.env.CONTRATOS_ADMIN_PASSWORD = SENHA;
  process.env.SESSION_SECRET = "curto";
  assert.equal((await login()).status, 401, "segredo curto também recusa");
});

test("senha errada = 401 e não vaza a senha; 5 falhas = 429", async () => {
  const r = await rotaSessao.POST(json("POST", { senha: "errada" }));
  assert.equal(r.status, 401);
  assert.ok(!(await r.text()).includes(SENHA));
  for (let i = 0; i < 4; i++) await rotaSessao.POST(json("POST", { senha: "errada" }));
  assert.equal((await rotaSessao.POST(json("POST", { senha: SENHA }))).status, 429);
});

test("CRUD com sessão: cria, valida, edita, inativa sem apagar", async () => {
  const { status, cookie } = await login();
  assert.equal(status, 200);
  const c = await rotaLista.POST(json("POST", novo, cookie));
  assert.equal(c.status, 201);
  const criado = (await c.json()).data;

  const inval = await rotaLista.POST(json("POST", { ...novo, valorMensal: -1, tipo: "X", fim: "2025-01-01" }, cookie));
  assert.equal(inval.status, 400);
  const e = (await inval.json()).erros;
  assert.ok(e.valorMensal && e.tipo && e.fim);

  const ed = await rotaItem.PATCH(json("PATCH", { fim: "2026-06-30" }, cookie), ctx(criado.id));
  assert.equal(ed.status, 200);
  assert.equal((await ed.json()).data.fim, "2026-06-30");

  const fimRuim = await rotaItem.PATCH(json("PATCH", { fim: "2025-12-31" }, cookie), ctx(criado.id));
  assert.equal(fimRuim.status, 400);

  assert.equal((await rotaItem.DELETE(json("DELETE", {}, cookie), ctx(criado.id))).status, 200);
  const lista = (await (await rotaLista.GET(new Request(URL_BASE, { headers: { cookie } }))).json()).data as Array<{ id: string; ativo: boolean }>;
  const ainda = lista.find((x) => x.id === criado.id);
  assert.ok(ainda, "continua no banco");
  assert.equal(ainda!.ativo, false);

  const re = await rotaItem.PATCH(json("PATCH", { ativo: true }, cookie), ctx(criado.id));
  assert.equal((await re.json()).data.ativo, true);
  assert.equal((await rotaItem.PATCH(json("PATCH", { ativo: true }, cookie), ctx("nao-existe"))).status, 404);
});

test("regressão: Bearer das ordens de compra segue igual (com e sem token)", async () => {
  process.env.ORDENS_COMPRA_API_KEY = "chave-ordens-teste";
  const url = "http://local/api/v1/ordens-compra";
  assert.equal((await rotaOrdens.GET(new Request(url))).status, 401);
  assert.equal((await rotaOrdens.GET(new Request(url, { headers: { authorization: "Bearer errada" } }))).status, 401);
  const { cookie } = await login();
  assert.equal((await rotaOrdens.GET(new Request(url, { headers: { cookie } }))).status, 401, "sessão de contratos não abre ordens");
  assert.equal((await rotaOrdens.GET(new Request(url, { headers: { authorization: "Bearer chave-ordens-teste" } }))).status, 200);
});

const loginXff = (senha: string, xff?: string) =>
  rotaSessao.POST(
    new Request(`${URL_BASE}/sessao`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(xff ? { "x-forwarded-for": xff } : {}) },
      body: JSON.stringify({ senha }),
    }),
  );

test("A1: trocar o 1º IP do XFF não zera o limite; 6ª tentativa = 429", async () => {
  for (let i = 1; i <= 5; i++) assert.equal((await loginXff("errada", `10.0.0.${i}, 9.9.9.9`)).status, 401);
  assert.equal((await loginXff(SENHA, "10.0.0.99, 9.9.9.9")).status, 429);
});

test("A1: sem header X-Forwarded-For o login funciona", async () => {
  const r = await loginXff(SENHA);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("set-cookie")?.startsWith(COOKIE_SESSAO_CONTRATOS));
});

test("A1: dois IPs diferentes no fim do XFF não se bloqueiam", async () => {
  for (let i = 0; i < 5; i++) await loginXff("errada", "1.1.1.1, 8.8.8.8");
  assert.equal((await loginXff(SENHA, "1.1.1.1, 8.8.8.8")).status, 429);
  assert.equal((await loginXff(SENHA, "1.1.1.1, 7.7.7.7")).status, 200);
});
