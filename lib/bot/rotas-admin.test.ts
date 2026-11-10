import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "@/lib/auth/contratos-sessao";
import { MSG_TELEFONE_APROVADO } from "@/lib/bot/mensagens";
import { closeDbForTests, getDb } from "@/lib/db/client";
import * as colecao from "../../app/api/cadastros/bot-usuarios/route";
import * as conflitos from "../../app/api/cadastros/bot-usuarios/conflitos/route";
import * as item from "../../app/api/cadastros/bot-usuarios/[id]/route";
import * as trilha from "../../app/api/cadastros/bot-usuarios/[id]/auditoria/route";

const URL_LISTA = "http://local/api/cadastros/bot-usuarios";
const URL_CONFLITO = "http://local/api/cadastros/bot-usuarios/conflitos";
const TEL = "+55 11 90000-0001";
const TEL_DIGITO = "5511900000001";
const EMAIL = "ana.zzteste@exemplo.invalid";
const MSG_401 = JSON.stringify({ ok: false, message: "Entre com a senha de administrador." });

let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "bot-rotas-"));
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
  getDb().exec("DELETE FROM bot_auditoria; DELETE FROM bot_usuario;");
});

const logado = () => ({ cookie: `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}` });

function corpo(telefone: string) {
  return JSON.stringify({
    nome: "Ana Exemplo",
    papel: "Compras",
    telefone,
    email: EMAIL,
    setor: "UTI ZZTESTE",
    outros_setores: "Plantao ZZTESTE",
  });
}

test("rotas admin recusam chamada sem sessão, igual para número novo e já cadastrado", async () => {
  const gravado = await colecao.POST(new Request(URL_LISTA, { method: "POST", headers: logado(), body: corpo(TEL) }));
  assert.equal(gravado.status, 201);

  const novo = await colecao.POST(new Request(URL_LISTA, { method: "POST", body: corpo("+55 11 90000-0002") }));
  const existente = await colecao.POST(new Request(URL_LISTA, { method: "POST", body: corpo(TEL) }));
  const textoNovo = await novo.text();
  const textoExistente = await existente.text();
  assert.equal(novo.status, 401);
  assert.equal(existente.status, 401);
  assert.equal(textoNovo, MSG_401);
  assert.equal(textoExistente, MSG_401);
  assert.equal(textoNovo.includes("já existe"), false);
  assert.equal(textoExistente.includes(TEL_DIGITO), false);
  assert.deepEqual(getDb().prepare("SELECT COUNT(*) n FROM bot_usuario").get(), { n: 1 });

  const consulta = await conflitos.GET(new Request(`${URL_CONFLITO}?telefone=${encodeURIComponent(TEL)}`));
  assert.equal(await consulta.text(), MSG_401);

  const forjado = await colecao.GET(
    new Request(URL_LISTA, { headers: { cookie: `${COOKIE_SESSAO_CONTRATOS}=9999999999.forjadoforjadoforjadoforjado` } }),
  );
  assert.equal(await forjado.text(), MSG_401);

  const id = "11111111-1111-4111-8111-111111111111";
  const leitura = await item.GET(new Request(`${URL_LISTA}/${id}`), { params: Promise.resolve({ id }) });
  const acao = await item.PATCH(new Request(`${URL_LISTA}/${id}`, { method: "PATCH", body: '{"acao":"aprovar"}' }), {
    params: Promise.resolve({ id }),
  });
  const auditoria = await trilha.GET(new Request(`${URL_LISTA}/${id}/auditoria`), { params: Promise.resolve({ id }) });
  assert.equal(leitura.status, 401);
  assert.equal(acao.status, 401);
  assert.equal(auditoria.status, 401);
  assert.equal(await leitura.text(), MSG_401);
  assert.equal(await acao.text(), MSG_401);
  assert.equal(await auditoria.text(), MSG_401);
});

test("com sessão: conflito, máscara e aprovação que não pisa em número já aprovado", async () => {
  const primeiro = await colecao.POST(new Request(URL_LISTA, { method: "POST", headers: logado(), body: corpo(TEL) }));
  const segundo = await colecao.POST(
    new Request(URL_LISTA, { method: "POST", headers: logado(), body: corpo("+55 11 0000-0001") }),
  );
  assert.equal(primeiro.status, 201);
  assert.equal(segundo.status, 201);
  const a = (await primeiro.json()) as { data: { id: string; telefone_mascarado: string; email_mascarado: string } };
  const b = (await segundo.json()) as { data: { id: string } };
  assert.equal(a.data.telefone_mascarado, "+55 11 •••••-0001");
  assert.equal(a.data.email_mascarado, "a•••@e•••");

  const lista = await (await colecao.GET(new Request(URL_LISTA, { headers: logado() }))).text();
  assert.equal(lista.includes(EMAIL), false);
  assert.equal(lista.includes(TEL_DIGITO), false);
  assert.equal(lista.includes("900000001"), false);

  const conflito = await conflitos.GET(
    new Request(`${URL_CONFLITO}?telefone=${encodeURIComponent("11 90000-0001")}`, { headers: logado() }),
  );
  assert.equal(conflito.status, 200);
  const conflitoJson = await conflito.json();
  assert.equal(conflitoJson.data.pendentes.length, 2);
  assert.equal(conflitoJson.data.aprovados.length, 0);
  assert.equal(JSON.stringify(conflitoJson).includes(TEL_DIGITO), false);

  const ok = await item.PATCH(new Request(`${URL_LISTA}/${a.data.id}`, { method: "PATCH", headers: logado(), body: '{"acao":"aprovar"}' }), {
    params: Promise.resolve({ id: a.data.id }),
  });
  assert.equal(ok.status, 200);
  const negado = await item.PATCH(
    new Request(`${URL_LISTA}/${b.data.id}`, { method: "PATCH", headers: logado(), body: '{"acao":"aprovar"}' }),
    { params: Promise.resolve({ id: b.data.id }) },
  );
  assert.equal(negado.status, 409);
  const erro = await negado.json();
  assert.equal(erro.message, MSG_TELEFONE_APROVADO);
  assert.equal(JSON.stringify(erro).includes(TEL_DIGITO), false);

  const eventos = await trilha.GET(new Request(`${URL_LISTA}/${a.data.id}/auditoria`, { headers: logado() }), {
    params: Promise.resolve({ id: a.data.id }),
  });
  const eventosJson = await eventos.json();
  const serial = JSON.stringify(eventosJson);
  assert.equal(eventos.status, 200);
  assert.equal(serial.includes(TEL_DIGITO), false);
  assert.equal(serial.includes(EMAIL), false);
  assert.equal(serial.includes("UTI ZZTESTE"), false);
  assert.equal(serial.includes("Plantao ZZTESTE"), false);
});

test("este PR não publica tela nem rota do bot", () => {
  assert.equal(existsSync("app/api/bot"), false);
  assert.equal(existsSync("app/admin/bot-usuarios"), false);
});
