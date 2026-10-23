import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { closeDbForTests } from "../db/client";
import * as rota from "../../app/api/indicadores/custo-manutencao-parque/resumo/route";

let dir = "";
const envAntes = { ...process.env };
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-resumo-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  // sem credenciais da GlobalThings: a rota não pode quebrar nem inventar número
  delete process.env.PBI_BASE_URL;
  delete process.env.PBI_API_KEY;
  closeDbForTests();
});
after(() => {
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

test("rota pública de resumo (demo) → 200, só %/status, sem R$", async () => {
  const r = await rota.GET(new Request("http://local/api/indicadores/custo-manutencao-parque/resumo?demo=indicadores"));
  assert.equal(r.status, 200);
  const corpo = await r.text();
  assert.doesNotMatch(corpo, /R\$/);
  const j = JSON.parse(corpo);
  assert.equal(j.data.valorPrincipal, "2,60%");
  assert.equal(j.data.status, "dentro");
});

test("rota pública sem sessão e sem API → responde sem R$ e sem 0% inventado", async () => {
  const r = await rota.GET(new Request("http://local/api/indicadores/custo-manutencao-parque/resumo"));
  const corpo = await r.text();
  assert.doesNotMatch(corpo, /R\$/);
  if (r.status === 200) {
    const j = JSON.parse(corpo);
    assert.notEqual(j.data.valorPrincipal, "0,00%");
  }
});
