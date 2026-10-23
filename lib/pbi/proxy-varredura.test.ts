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
import { EXCECOES_RE_SUSPEITO_RS, campoSuspeito, RE_CAMPO_LINK, RE_CAMPO_PESSOA, RE_SUSPEITO_RS, RESOURCES_SO_COM_SESSAO, _avisosAllowlist, somenteAllowlist } from "./proxy-publico";
import { ALLOWLIST_PUBLICA } from "./allowlist-publica";
import * as proxy from "../../app/api/pbi/[resource]/route";

const MARCA = "R$ 4.321,09"; // valor fictício que nunca pode sair sem sessão
const PESSOA = "Pessoa Demo Sensivel";
function item(i: number) {
  return {
    Id: i, Tag: `HSJ-9000${i}`, Setor: "SETOR DEMO", Equipamento: "EQUIPAMENTO DEMO", CentroDeCusto: "CC DEMO", CentrosDeCusto: "CC DEMO", CustoX: MARCA, ValorCusto: MARCA, CentroDeCustoValor: MARCA, centrodecusto: MARCA, CENTRODECUSTO: MARCA, CentrosDeCustoIds: "NAO-DEVE-SAIR",
    Custo: MARCA, custo: MARCA, CUSTO_TOTAL: MARCA, Valor: MARCA, valor: MARCA, ValorTotal: MARCA, ValorMoeda: 4321.09,
    ValorPgto: 4321.09, CustoPrevisto: 4321.09, CustoRealizado: 4321.09, ValorDeSubstituicao: MARCA, ValorDeAquisicao: MARCA,
    ValorQualquerNovo: MARCA, PrecoUnitario: MARCA, preço: MARCA,
    Responsavel: PESSOA, Requisitante: PESSOA, TecnicoResolvedor: PESSOA, AbertaPor: PESSOA, MatriculaResponsavel: "900001",
    MatriculaResolvedor: "900002", SolicitanteNome: PESSOA, usuario: PESSOA,
    LinkAnexo: "https://gt.invalid/api/v1/files/1/bytoken/TOKENFICTICIO",
    Parcelas: [{ Numero: 1, ValorPgto: MARCA, Detalhe: { Valor: MARCA, Responsavel: PESSOA, Obs: "ok" } }],
    Itens: [[{ custoUnit: MARCA, Nome: "ITEM DEMO" }]],
    // Campos NOVOS fora de qualquer lista (o PBI pode passar a mandar amanhã):
    VlrNovo: MARCA, TotalParcela: MARCA, PrecoX: MARCA, CampoNovoQualquer: "NAO-DEVE-SAIR",
    // Campos da allowlist de vários resources (conteúdo fictício):
    OS: `20990000${i}`, Status: "ATIVO", Fabricante: "FABRICANTE DEMO", Modelo: "MODELO DEMO", Empresa: "EMPRESA DEMO",
    Descricao: "DESCRICAO DEMO", DisponibilidadeMensal: [{ Mes: 1, Disponibilidade: 99.5, ValorMes: MARCA, Responsavel: PESSOA }],
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
  // Como o Next: a URL chega crua (com %xx) e o param da rota chega decodificado.
  let param = bruto;
  try { param = decodeURIComponent(bruto); } catch { /* fica cru */ }
  const r = await proxy.GET(new NextRequest(`http://local/api/pbi/${bruto}?periodo=AnoAtual`, { headers: cookie ? { cookie } : {} }), {
    params: Promise.resolve({ resource: param }),
  });
  return { r, txt: await r.text() };
}
function chaves(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => chaves(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); chaves(x, out); }
  return out;
}
/** Grafias diferentes do nome exato: todas têm de dar 404 sem chamar o PBI (B1, ciclo 5). */
const variacoes = (r: string) => [r.toUpperCase(), ` ${r} `, `%20${r}%20`, r[0].toUpperCase() + r.slice(1), encodeURIComponent(` ${r.toUpperCase()}`), "%" + r.charCodeAt(0).toString(16) + r.slice(1), r.split("").map((c) => "%" + c.charCodeAt(0).toString(16)).join(""), `${r}%20`, `${r}%00`];
const TODOS = Object.keys(PBI_ENDPOINTS) as PbiResource[];

test("B1: grafia diferente da chave exata (EQUIPAMENTOS, %20equipamentos%20, %65quipamentos…) → 404 sem chamar o PBI, com e sem sessão", async () => {
  for (const v of ["EQUIPAMENTOS", "%20equipamentos%20", "%65quipamentos", " equipamentos", "Equipamentos"]) {
    for (const ck of [undefined, SESSAO()]) {
      const { r, txt } = await chamar(v, ck);
      assert.equal(r.status, 404, v);
      assert.equal(txt.includes("4.321,09"), false, v);
    }
  }
  for (const res of TODOS) for (const v of variacoes(res)) {
    const { r } = await chamar(v);
    assert.equal(r.status, 404, `${res} como ${JSON.stringify(v)}`);
  }
  assert.equal(chamadasUpstream, 0);
});

test("sem sessão: nenhum resource devolve campo em R$, nome de pessoa nem LinkAnexo bytoken", async () => {
  let verificados = 0;
  for (const res of TODOS) {
    for (const v of [res]) {
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
      assert.equal(ks.some((k) => campoSuspeito(k)), false, `${ctx}: ${ks.filter((k) => campoSuspeito(k))}`);
      assert.equal(ks.some((k) => RE_CAMPO_PESSOA.test(k) || RE_CAMPO_LINK.test(k)), false, ctx);
      assert.equal(txt.includes("NAO-DEVE-SAIR"), false, `${ctx}: campo novo fora da lista`);
      if (j.data) {
        const lista = new Set(ALLOWLIST_PUBLICA[res] ?? []);
        const fora = ks.filter((k) => !lista.has(k));
        assert.deepEqual(fora, [], `${ctx}: só allowlist`);
        if (lista.has("Tag")) assert.ok(ks.includes("Tag"), `${ctx}: campos da allowlist continuam`);
      }
      verificados++;
    }
  }
  assert.equal(verificados, TODOS.length);
});

test("contratos e anexos-* sem sessão: 401 sem chamar o PBI", async () => {
  for (const res of RESOURCES_SO_COM_SESSAO) {
    for (const v of [res]) {
      const { r } = await chamar(v);
      assert.equal(r.status, 401, v);
    }
  }
  assert.equal(chamadasUpstream, 0);
});

test("resource desconhecido/malformado → 404 sem chamar o PBI e sem ecoar o nome", async () => {
  for (const v of ["equipamentos2", "../contratos", "constructor", "__proto__", "toString", "equipamentos/x", "%E0%A4%A", "", "contratos%00", "os analitico", "%2e%2e", "%2e%2e%2fcontratos", "..%2fequipamentos", "equipamentos%2f..", ".%2e/os-analitico"]) {
    const { r, txt } = await chamar(v, SESSAO());
    assert.equal(r.status, 404, JSON.stringify(v));
    if (v.length > 3) assert.equal(txt.includes(v), false, JSON.stringify(v));
  }
  assert.equal(chamadasUpstream, 0);
});

test("com sessão: resposta idêntica ao upstream em todos os resources (inclusive contratos/anexos)", async () => {
  for (const res of TODOS) {
    for (const v of [res]) {
      const { r, txt } = await chamar(v, SESSAO());
      assert.equal(r.status, 200, v);
      const j = JSON.parse(txt) as { data: unknown };
      assert.deepEqual(j.data, FIXTURE, v);
      assert.equal((j as { parcialSemSessao?: unknown }).parcialSemSessao, undefined, v);
      assert.equal(r.headers.get("cache-control"), "private, no-store", v);
    }
  }
});

test("allowlists do código não contêm campo suspeito (R$/pessoa/link)", () => {
  for (const [res, lista] of Object.entries(ALLOWLIST_PUBLICA)) {
    for (const c of lista ?? []) {
      assert.equal((RE_SUSPEITO_RS.test(c) && !EXCECOES_RE_SUSPEITO_RS.has(c)) || RE_CAMPO_PESSOA.test(c) || RE_CAMPO_LINK.test(c), false, `${res}.${c}`);
    }
  }
});

test("runtime: campo suspeito que entrar na allowlist por engano sai e registra aviso", () => {
  const r = somenteAllowlist("equipamentos", { ok: true, data: [{ Tag: "HSJ-90001", VlrNovo: MARCA, TotalParcela: MARCA }] }, false, ["Tag", "VlrNovo", "TotalParcela"]);
  assert.deepEqual((r as { data: unknown }).data, [{ Tag: "HSJ-90001" }]);
  const avisos = _avisosAllowlist();
  assert.ok(avisos.includes("equipamentos:VlrNovo") && avisos.includes("equipamentos:TotalParcela"), String(avisos));
});

test("cache no mesmo processo: com sessão primeiro, depois sem sessão — sem vazamento, mesma chave", async () => {
  for (const res of TODOS.filter((x) => !RESOURCES_SO_COM_SESSAO.includes(x))) {
    const a = await chamar(res, SESSAO());
    assert.ok(a.txt.includes("4.321,09"), `${res}: com sessão vem completo`);
    const b = await chamar(res);
    assert.equal(b.txt.includes("4.321,09") || b.txt.includes(PESSOA) || b.txt.includes("NAO-DEVE-SAIR"), false, `${res}: sem sessão depois`);
    assert.equal(b.r.headers.get("cache-control"), "private, no-store");
    assert.equal(b.r.headers.get("vary"), "Cookie");
  }
});

test("rota é dinâmica e sem fetch/route cache do Next", () => {
  assert.equal(proxy.dynamic, "force-dynamic");
  assert.equal(proxy.revalidate, 0);
  assert.equal(proxy.fetchCache, "force-no-store");
});

test("exceção exata: CentroDeCusto/CentrosDeCusto passam sem sessão; variações continuam cortadas", async () => {
  assert.deepEqual([...EXCECOES_RE_SUSPEITO_RS].sort(), ["CentroDeCusto", "CentrosDeCusto"]);
  for (const v of ["CustoX", "ValorCusto", "CentroDeCustoValor", "centrodecusto", "CENTRODECUSTO", "CentroDeCusto ", "CentrosDeCustoIds", "CentroDeCustos"]) {
    assert.equal(campoSuspeito(v), true, v);
  }
  assert.equal(campoSuspeito("CentroDeCusto"), false);
  for (const [res, campo] of [["equipamentos", "CentroDeCusto"], ["os-analitico", "CentroDeCusto"], ["cronograma", "CentroDeCusto"], ["disp-equipamento", "CentrosDeCusto"], ["disp-equipamento-mes", "CentrosDeCusto"]] as const) {
    const { txt } = await chamar(res);
    const j = JSON.parse(txt);
    const itens = (j as { data: Array<Record<string, unknown>> }).data;
    assert.equal(itens[0][campo], "CC DEMO", `${res}.${campo}`);
    for (const v of ["CustoX", "ValorCusto", "CentroDeCustoValor", "centrodecusto", "CENTRODECUSTO", "CentrosDeCustoIds"]) assert.equal(v in itens[0], false, `${res}.${v}`);
    assert.equal(txt.includes("4.321,09"), false, res);
  }
});

test("oficina sem sessão: 401 com a mensagem do card Entrar", async () => {
  const { r, txt } = await chamar("oficina");
  const j = JSON.parse(txt);
  assert.equal(r.status, 401);
  assert.match(String((j as { message?: string }).message), /senha de administrador/i);
});
