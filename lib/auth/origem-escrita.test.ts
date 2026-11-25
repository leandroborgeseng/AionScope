import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { MSG_ORIGEM_NEGADA } from "@/lib/bot/origem";
import { closeDbForTests } from "../db/client";
import { __setFetchForTests, invalidarCachePbi } from "../pbi/client";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "./contratos-sessao";
import * as compras from "../../app/api/sala/compras/route";
import * as registros from "../../app/api/sala/registros/route";
import * as contratos from "../../app/api/cadastros/contratos/route";
import * as parque from "../../app/api/cadastros/parque/route";
import * as desbloquear from "../../app/api/treinamentos/evidencias/desbloquear/route";

const ORIGEM = "https://painel.exemplo.test";
const EVIL = "https://evil.example";
let dir = "";
const envAntes = { ...process.env };

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-origem-escrita-"));
  process.env.DATABASE_PATH = path.join(dir, "teste.sqlite");
  closeDbForTests();
});
after(() => {
  __setFetchForTests(null);
  closeDbForTests();
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  process.env.CONTRATOS_ADMIN_PASSWORD = "senha-ficticia-de-teste";
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.AIONSCOPE_ORIGENS_PERMITIDAS = ORIGEM;
  process.env.TREINAMENTOS_EVIDENCIAS_TOKEN = "token-ficticio-de-teste";
  process.env.PBI_BASE_URL = "http://gt.invalid";
  process.env.PBI_TOKEN_EQUIPAMENTOS = "tok-teste";
  invalidarCachePbi();
  __setFetchForTests((async () => new Response("[]", { status: 200 })) as typeof fetch);
});

const cookie = () => `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`;

function pedido(url: string, origin: string, body: unknown, comCookie = true) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(comCookie ? { cookie: cookie() } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function origemNegada(res: Response) {
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { ok: false, message: MSG_ORIGEM_NEGADA });
}

test("escritas do painel: origem estranha 403, origem permitida passa", async () => {
  const feriado = { tipo: "feriado", data: "2026-12-25", nome: "Feriado DEMO" };
  await origemNegada(await registros.POST(pedido("http://local/api/sala/registros", EVIL, feriado)));
  assert.equal((await registros.POST(pedido("http://local/api/sala/registros", ORIGEM, feriado))).status, 200);

  const compra = { acao: "criar", item: "ITEM DEMO" };
  await origemNegada(await compras.POST(pedido("http://local/api/sala/compras", EVIL, compra)));
  assert.equal((await compras.POST(pedido("http://local/api/sala/compras", ORIGEM, compra))).status, 200);

  const contrato = {
    fornecedor: "ACME",
    equipamento: "BOMBA DEMO",
    tipo: "MANUTENCAO",
    valorMensal: 10,
    inicio: "2026-01-01",
    fim: "2027-01-01",
  };
  await origemNegada(await contratos.POST(pedido("http://local/api/cadastros/contratos", EVIL, contrato)));
  assert.equal((await contratos.POST(pedido("http://local/api/cadastros/contratos", ORIGEM, contrato))).status, 201);

  await origemNegada(await parque.POST(pedido("http://local/api/cadastros/parque", EVIL, {})));
  assert.equal((await parque.POST(pedido("http://local/api/cadastros/parque", ORIGEM, {}))).status, 200);

  const token = { token: "token-ficticio-de-teste" };
  await origemNegada(await desbloquear.POST(pedido("http://local/api/treinamentos/evidencias/desbloquear", EVIL, token)));
  const ok = await desbloquear.POST(pedido("http://local/api/treinamentos/evidencias/desbloquear", ORIGEM, token));
  assert.equal(ok.status, 200);

  const semCookie = await registros.POST(pedido("http://local/api/sala/registros", EVIL, feriado, false));
  assert.equal(semCookie.status, 401);
});
