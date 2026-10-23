import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";

// M1 ciclo 2: varredura de TODOS os resources sem sessão, com grafias variadas.
// Fixture fictícia (HSJ-9xxxx, "Pessoa Demo", valores inventados) com campos em R$ em várias formas,
// aninhados e com nomes de pessoas. GlobalThings falso (fetch mockado); banco temporário.
const dir = mkdtempSync(path.join(os.tmpdir(), "pbi-proxy-varredura-"));
process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
process.env.PBI_BASE_URL = "http://gt.invalid";
import { PBI_ENDPOINTS, type PbiResource } from "./catalog";
for (const e of Object.values(PBI_ENDPOINTS)) process.env[e.tokenEnv] = "tok-test";

import { closeDbForTests } from "@/lib/db/client";
import { __setFetchForTests, invalidarCachePbi } from "./client";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "@/lib/auth/contratos-sessao";
import { RE_CAMPO_PESSOA, RE_CAMPO_RS, RESOURCES_SO_COM_SESSAO } from "./proxy-publico";
import * as proxy from "../../app/api/pbi/[resource]/route";

const MARCA = "R$ 4.321,09"; // valor fictício que nunca pode sair sem sessão
const PESSOA = "Pessoa Demo Sensivel";
function item(i: number) {
  return {
    Id: i, Tag: `HSJ-9000${i}`, Setor: "SETOR DEMO", Equipamento: "EQUIPAMENTO DEMO", CentroDeCusto: "CC DEMO",
    Custo: MARCA, custo: MARCA, CUSTO_TOTAL: MARCA, Valor: MARCA, valor: MARCA, ValorTotal: MARCA, ValorMoeda: 4321.09,
    ValorPgto: 4321.09, CustoPrevisto: 4321.09, CustoRealizado: 4321.09, ValorDeSubstituicao: MARCA, ValorDeAquisicao: MARCA,
    ValorQualquerNovo: MARCA, PrecoUnitario: MARCA, preço: MARCA,
    Responsavel: PESSOA, Requisitante: PESSOA, TecnicoResolvedor: PESSOA, AbertaPor: PESSOA, MatriculaResponsavel: "900001",
    MatriculaResolvedor: "900002", SolicitanteNome: PESSOA, usuario: PESSOA,
    LinkAnexo: "https://gt.invalid/api/v1/files/1/bytoken/TOKENFICTICIO",
    Parcelas: [{ Numero: 1, ValorPgto: MARCA, Detalhe: { Valor: MARCA, Responsavel: PESSOA, Obs: "ok" } }],
    Itens: [[{ custoUnit: MARCA, Nome: "ITEM DEMO" }]],
  };
}
const FIXTURE = [item(1), item(2)];
let chamadasUpstream = 0;
__setFetchForTests((async () => {
  chamadasUpstream++;
  return new Response(JSON.stringify(FIXTURE), { status: 200 });
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
  chamadasUpstream = 0;
});

const SESSAO = () => `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`;
async function chamar(bruto: string, cookie?: string) {
  const r = await proxy.GET(new NextRequest(`http://local/api/pbi/x?periodo=AnoAtual`, { headers: cookie ? { cookie } : {} }), {
    params: Promise.resolve({ resource: bruto }),
  });
  return { r, txt: await r.text() };
}
function chaves(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => chaves(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); chaves(x, out); }
  return out;
}
const variacoes = (r: string) => [r, r.toUpperCase(), ` ${r} `, r[0].toUpperCase() + r.slice(1), encodeURIComponent(` ${r.toUpperCase()}`)];
const TODOS = Object.keys(PBI_ENDPOINTS) as PbiResource[];

test("sem sessão: nenhum resource (em qualquer grafia) devolve campo em R$, nome de pessoa nem LinkAnexo bytoken", async () => {
  let verificados = 0;
  for (const res of TODOS) {
    for (const v of variacoes(res)) {
      const { r, txt } = await chamar(v);
      const ctx = `${res} como ${JSON.stringify(v)}`;
      if (RESOURCES_SO_COM_SESSAO.includes(res)) {
        assert.equal(r.status, 401, ctx);
      } else {
        assert.notEqual(r.status, 404, ctx);
      }
      assert.equal(txt.includes("4.321,09"), false, ctx);
      assert.equal(txt.includes("4321.09"), false, ctx);
      assert.equal(txt.includes(PESSOA), false, ctx);
      assert.equal(txt.includes("bytoken"), false, ctx);
      const j = JSON.parse(txt) as { data?: unknown };
      const ks = chaves(j.data);
      assert.equal(ks.some((k) => RE_CAMPO_RS.test(k)), false, `${ctx}: ${ks.filter((k) => RE_CAMPO_RS.test(k))}`);
      assert.equal(ks.some((k) => RE_CAMPO_PESSOA.test(k)), false, ctx);
      if (j.data) assert.ok(ks.includes("Tag") && ks.includes("Setor") && ks.includes("CentroDeCusto"), `${ctx}: resto intacto`);
      verificados++;
    }
  }
  assert.equal(verificados, TODOS.length * 5);
});

test("contratos e anexos-* sem sessão: 401 sem chamar o PBI", async () => {
  for (const res of RESOURCES_SO_COM_SESSAO) {
    for (const v of variacoes(res)) {
      const { r } = await chamar(v);
      assert.equal(r.status, 401, v);
    }
  }
  assert.equal(chamadasUpstream, 0);
});

test("resource desconhecido/malformado → 404 sem chamar o PBI e sem ecoar o nome", async () => {
  for (const v of ["equipamentos2", "../contratos", "constructor", "__proto__", "toString", "equipamentos/x", "%E0%A4%A", "", "contratos%00", "os analitico"]) {
    const { r, txt } = await chamar(v, SESSAO());
    assert.equal(r.status, 404, JSON.stringify(v));
    if (v.length > 3) assert.equal(txt.includes(v), false, JSON.stringify(v));
  }
  assert.equal(chamadasUpstream, 0);
});

test("com sessão: resposta idêntica ao upstream em todos os resources (inclusive contratos/anexos)", async () => {
  for (const res of TODOS) {
    for (const v of [res, res.toUpperCase()]) {
      const { r, txt } = await chamar(v, SESSAO());
      assert.equal(r.status, 200, v);
      const j = JSON.parse(txt) as { data: unknown; camposOcultos?: unknown };
      assert.deepEqual(j.data, FIXTURE, v);
      assert.equal(j.camposOcultos, undefined, v);
    }
  }
});
