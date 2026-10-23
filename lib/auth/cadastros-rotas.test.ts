import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { closeDbForTests } from "../db/client";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "./contratos-sessao";
import * as parque from "../../app/api/cadastros/parque/route";
import * as contratos from "../../app/api/cadastros/contratos/route";
import * as snapshot from "../../app/api/sala/snapshot/route";

// Ambiente fictício: banco temporário e credenciais de teste (repo público).
let dir = "";
const envAntes = { ...process.env };
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-auth-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
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

const URL_P = "http://local/api/cadastros/parque";
const URL_C = "http://local/api/cadastros/contratos";
const logado = () => ({ cookie: `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}` });

async function semValores(res: Response) {
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ["message", "ok"]);
  assert.equal(body.ok, false);
  assert.doesNotMatch(JSON.stringify(body), /\d|sqlite|\//);
}

test("A1: GET /api/cadastros/parque sem sessão → 401 sem valores", async () => {
  await semValores(await parque.GET(new Request(URL_P)));
});

test("A1: POST /api/cadastros/parque sem sessão → 401 (não consulta a API)", async () => {
  await semValores(await parque.POST(new Request(URL_P, { method: "POST", body: "{}" })));
});

test("A1: cookie forjado → 401", async () => {
  await semValores(await parque.GET(new Request(URL_P, { headers: { cookie: `${COOKIE_SESSAO_CONTRATOS}=9999999999.forjadoforjadoforjadoforjado` } })));
});

test("A2: GET /api/cadastros/parque com sessão → 200 com o conteúdo, sem caminho do banco", async () => {
  const res = await parque.GET(new Request(URL_P, { headers: logado() }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  for (const k of ["valorEfetivo", "fonteEfetiva", "historico", "mensal", "regra"]) assert.ok(k in body.data, k);
  assert.equal("databasePath" in body.data, false);
  assert.doesNotMatch(JSON.stringify(body), /teste\.sqlite|aion-auth-/);
});

test("A3: GET /api/cadastros/contratos sem sessão → 401; com sessão → 200", async () => {
  await semValores(await contratos.GET(new Request(URL_C)));
  const res = await contratos.GET(new Request(URL_C, { headers: logado() }));
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).data));
});

test("A4: Sala aberta sem sessão — /api/sala/snapshot (demo) → 200", async () => {
  const res = await snapshot.GET(new NextRequest("http://local/api/sala/snapshot?demo=1"));
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).sequencia));
});
