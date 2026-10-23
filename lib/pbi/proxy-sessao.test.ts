import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";

// Ambiente fictício: banco temporário, GlobalThings falso (fetch mockado) e credenciais de teste.
const dir = mkdtempSync(path.join(os.tmpdir(), "pbi-proxy-sessao-"));
process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
process.env.PBI_BASE_URL = "http://gt.invalid";
for (const t of ["EQUIPAMENTOS", "OS_ANALITICO", "CRONOGRAMA"]) process.env[`PBI_TOKEN_${t}`] = "tok-test";

import { closeDbForTests } from "@/lib/db/client";
import { __setFetchForTests, invalidarCachePbi } from "./client";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "@/lib/auth/contratos-sessao";
import * as proxy from "../../app/api/pbi/[resource]/route";

// Fixture fictícia (HSJ-9xxxx, fabricante/setor DEMO, valores inventados).
const EQUIP = [
  { Id: 1, Tag: "HSJ-90001", Equipamento: "MONITOR DEMO", Setor: "SETOR DEMO A", Fabricante: "FABRICANTE DEMO", Status: "ATIVO", ValorDeSubstituicao: "1.234,56", ValorDeAquisicao: "999,00" },
  { Id: 2, Tag: "HSJ-90002", Equipamento: "BOMBA DEMO", Setor: "SETOR DEMO B", Fabricante: "FABRICANTE DEMO", Status: "ATIVO", ValorDeSubstituicao: "7.654,32", ValorDeAquisicao: "0,00" },
];
let chamadas = 0;
__setFetchForTests((async () => {
  chamadas++;
  return new Response(JSON.stringify(EQUIP), { status: 200 });
}) as typeof fetch);

const envAntes = { ...process.env };
after(() => {
  __setFetchForTests(null);
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  process.env.CONTRATOS_ADMIN_PASSWORD = "senha-ficticia-de-teste";
  process.env.SESSION_SECRET = "s".repeat(40);
  invalidarCachePbi();
  chamadas = 0;
});

const QS = "apenasAtivos=false&incluirCustoSubstituicao=true";
const SESSAO = () => `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`;
async function chamar(resource: string, cookie?: string, qs = QS) {
  const r = await proxy.GET(new NextRequest(`http://local/api/pbi/${resource}?${qs}`, { headers: cookie ? { cookie } : {} }), {
    params: Promise.resolve({ resource }),
  });
  return { r, txt: await r.text() };
}

test("sem sessão: equipamentos sem ValorDeSubstituicao/ValorDeAquisicao; resto intacto", async () => {
  const { r, txt } = await chamar("equipamentos");
  assert.equal(r.status, 200);
  const j = JSON.parse(txt) as { ok: boolean; data: Record<string, unknown>[]; camposOcultos: string[] };
  assert.equal(j.ok, true);
  assert.equal(j.data.length, 2);
  for (const e of j.data) {
    assert.equal("ValorDeSubstituicao" in e, false);
    assert.equal("ValorDeAquisicao" in e, false);
  }
  assert.deepEqual(j.data.map((e) => e.Tag), ["HSJ-90001", "HSJ-90002"]);
  assert.equal(j.data[0].Setor, "SETOR DEMO A");
  assert.deepEqual(j.camposOcultos, ["ValorDeSubstituicao", "ValorDeAquisicao"]);
  for (const v of ["1.234,56", "999,00", "7.654,32"]) assert.equal(txt.includes(v), false, v);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(r.headers.get("vary"), "Cookie");
});

test("com sessão: resposta completa, igual ao upstream", async () => {
  const { r, txt } = await chamar("equipamentos", SESSAO());
  assert.equal(r.status, 200);
  const j = JSON.parse(txt) as { data: unknown[]; camposOcultos?: unknown };
  assert.deepEqual(j.data, EQUIP);
  assert.equal(j.camposOcultos, undefined);
});

test("cache resource:querystring: completo em cache não vaza sem sessão (com→sem→com, mesma chave)", async () => {
  const a = await chamar("equipamentos", SESSAO());
  assert.ok(a.txt.includes("1.234,56"));
  const b = await chamar("equipamentos");
  assert.equal(b.txt.includes("1.234,56"), false, "sem sessão após cache cheio");
  assert.equal((JSON.parse(b.txt) as { data: Record<string, unknown>[] }).data.some((e) => "ValorDeSubstituicao" in e), false);
  const c = await chamar("equipamentos", SESSAO());
  assert.ok(c.txt.includes("1.234,56"), "objeto do cache não foi alterado pelo corte");
  assert.ok(chamadas <= 1, "no máximo uma ida ao upstream: as três saem da mesma chave de cache");
});

test("sessão inválida/forjada conta como sem sessão", async () => {
  const { txt } = await chamar("equipamentos", `${COOKIE_SESSAO_CONTRATOS}=forjado.123`);
  assert.equal(txt.includes("1.234,56"), false);
  assert.equal((JSON.parse(txt) as { data: Record<string, unknown>[] }).data.some((e) => "ValorDeSubstituicao" in e), false);
});

test("outros recursos não são alterados por este PR (sem sessão)", async () => {
  const { txt } = await chamar("cronograma", undefined, "periodo=AnoAtual");
  const j = JSON.parse(txt) as { data: unknown[] };
  assert.deepEqual(j.data, EQUIP, "cronograma passa como veio (fora do escopo M1)");
});
