import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { closeDbForTests } from "./client";
import * as health from "../../app/api/v1/health/route";

let dir = "";
const envAntes = { ...process.env };
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-health-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  closeDbForTests();
});
after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

test("GET /api/v1/health?stamp=1 não grava nada no volume nem devolve stamp", async () => {
  // Linha de base: o health comum (sem stamp). O diagnóstico já testa escrita com um probe (pré-existente).
  await health.GET(new Request("http://local/api/v1/health?persistencia=1"));
  const antes = readdirSync(dir).sort();
  for (const q of ["?stamp=1", "?persistencia=1&stamp=1"]) {
    const r = await health.GET(new Request(`http://local/api/v1/health${q}`));
    assert.equal(r.status, 200);
    assert.equal(JSON.stringify(await r.json()).includes('"stamp"'), false, q);
  }
  assert.equal(existsSync(path.join(dir, ".aionscope-volume-stamp")), false);
  assert.deepEqual(readdirSync(dir).sort(), antes, "?stamp=1 não cria nenhum arquivo além do health comum");
});

test("health comum segue com persistencia_ok e ephemeral", async () => {
  const corpo = JSON.stringify(await (await health.GET(new Request("http://local/api/v1/health"))).json());
  assert.match(corpo, /"persistencia_ok":(true|false)/);
  assert.match(corpo, /"ephemeral":(true|false)/);
});
