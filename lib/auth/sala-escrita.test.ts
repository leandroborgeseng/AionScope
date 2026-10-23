import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { closeDbForTests } from "../db/client";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "./contratos-sessao";
import { MSG_LOGIN_SALA } from "./sala-escrita";
import * as compras from "../../app/api/sala/compras/route";
import * as ordens from "../../app/api/sala/ordens-compra/route";
import * as anexos from "../../app/api/sala/ordens-compra/[numero_ordem]/anexos/route";
import * as anexo from "../../app/api/sala/ordens-compra/[numero_ordem]/anexos/[id]/route";
import * as registros from "../../app/api/sala/registros/route";
import * as registro from "../../app/api/sala/registros/[tipo]/[id]/route";
import * as snapshot from "../../app/api/sala/snapshot/route";
import * as recorte from "../../app/api/sala/recorte/route";
import * as health from "../../app/api/v1/health/route";

// Ambiente fictício: banco temporário e credenciais de teste (repo público).
let dir = "";
const envAntes = { ...process.env };
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-sala-escrita-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  // F6: health lê treinamentos; nos testes, volume e semente em dir temporário vazio (nada em /data).
  process.env.TREINAMENTOS_DATA_PATH = path.join(dir, "treinamentos");
  process.env.TREINAMENTOS_SEED_PATH = path.join(dir, "semente-vazia");
  closeDbForTests();
});
after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  process.env.CONTRATOS_ADMIN_PASSWORD = "senha-ficticia-de-teste";
  process.env.SESSION_SECRET = "s".repeat(40);
});

const B = "http://local/api/sala";
const COOKIE = () => `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`;
const req = (url: string, method: string, body?: unknown, cookie?: string) =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctxOc = { params: Promise.resolve({ numero_ordem: "DEMO-1" }) };
const ctxAnexo = { params: Promise.resolve({ numero_ordem: "DEMO-1", id: "1" }) };
const ctxReg = { params: Promise.resolve({ tipo: "feriado", id: "demo" }) };

type Escrita = [string, (c?: string) => Promise<Response>];
const escritas: Escrita[] = [
  ["POST /api/sala/compras", (c) => compras.POST(req(`${B}/compras`, "POST", {}, c))],
  ["PATCH /api/sala/ordens-compra", (c) => ordens.PATCH(req(`${B}/ordens-compra`, "PATCH", {}, c))],
  ["POST /api/sala/ordens-compra/[n]/anexos", (c) => anexos.POST(req(`${B}/ordens-compra/DEMO-1/anexos`, "POST", {}, c), ctxOc)],
  ["DELETE /api/sala/ordens-compra/[n]/anexos/[id]", (c) => anexo.DELETE(req(`${B}/ordens-compra/DEMO-1/anexos/1`, "DELETE", undefined, c), ctxAnexo)],
  ["POST /api/sala/registros", (c) => registros.POST(req(`${B}/registros`, "POST", { tipo: "desconhecido" }, c))],
  ["DELETE /api/sala/registros/[tipo]/[id]", (c) => registro.DELETE(req(`${B}/registros/feriado/demo`, "DELETE", undefined, c), ctxReg)],
];

for (const [nome, chamar] of escritas) {
  test(`${nome} sem sessão → 401 com mensagem de login, sem dados`, async () => {
    const r = await chamar();
    assert.equal(r.status, 401);
    const body = await r.json();
    assert.deepEqual(body, { ok: false, message: MSG_LOGIN_SALA });
  });
  test(`${nome} com sessão → passa do guard (não 401)`, async () => {
    const r = await chamar(COOKIE());
    assert.notEqual(r.status, 401);
  });
  test(`${nome} com cookie forjado → 401`, async () => {
    const r = await chamar(`${COOKIE_SESSAO_CONTRATOS}=9999999999.forjadoforjadoforjadoforjado`);
    assert.equal(r.status, 401);
  });
}

test("registro de feriado fictício logado → 200 (escrita funciona)", async () => {
  const r = await registros.POST(req(`${B}/registros`, "POST", { tipo: "feriado", data: "2026-12-25", descricao: "Feriado DEMO" }, COOKIE()));
  assert.ok(r.status === 200 || r.status === 201, `status ${r.status}`);
});

test("GETs da Sala seguem abertos sem sessão (a TV só lê)", async () => {
  assert.equal((await snapshot.GET(new NextRequest(`${B}/snapshot?demo=1`))).status, 200);
  assert.equal((await recorte.GET(new NextRequest(`${B}/recorte?demo=drill&id=agora:total`))).status !== 401, true);
  assert.equal((await registros.GET()).status, 200);
  assert.equal((await ordens.GET(new Request(`${B}/ordens-compra`))).status, 200);
  assert.equal((await anexos.GET(new Request(`${B}/ordens-compra/DEMO-1/anexos`), ctxOc)).status !== 401, true);
});

test("D4: /api/v1/health mantém persistencia_ok e ephemeral, sem caminho do banco", async () => {
  const basico = await (await health.GET(new Request("http://local/api/v1/health"))).json();
  const corpoB = JSON.stringify(basico);
  assert.match(corpoB, /"persistencia_ok":(true|false)/);
  assert.match(corpoB, /"ephemeral":(true|false)/);
  const verbose = await (await health.GET(new Request("http://local/api/v1/health?persistencia=1"))).json();
  const corpoV = JSON.stringify(verbose);
  for (const k of ["databasePath", "databaseFile", "anexosRoot", "evidenciasDir", "railwayVolumeMount", "databasePathEnv"]) {
    assert.equal(corpoV.includes(`"${k}"`), false, k);
  }
  assert.equal(corpoV.includes(dir), false, "sem o diretório do banco");
  assert.equal(corpoV.includes("teste.sqlite"), false);
  assert.match(corpoV, /"ok":(true|false)/);
  assert.match(corpoV, /"ephemeral":(true|false)/);
});

test("GET /api/sala/compras?sync=1 sem sessão → 401; sem sync segue aberto", async () => {
  const r = await compras.GET(new Request(`${B}/compras?sync=1`));
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { ok: false, message: MSG_LOGIN_SALA });
  assert.equal((await compras.GET(new Request(`${B}/compras`))).status, 200);
});
