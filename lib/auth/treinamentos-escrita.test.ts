import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "./contratos-sessao";
import * as desbloquear from "../../app/api/treinamentos/evidencias/desbloquear/route";
import * as upload from "../../app/api/treinamentos/evidencias/upload/route";

// Ambiente fictício: diretório temporário, senha/segredo/token de teste e um PDF inventado (repo público).
let dir = "";
const envAntes = { ...process.env };
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-trein-escrita-"));
});
after(() => {
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  process.env.CONTRATOS_ADMIN_PASSWORD = "senha-ficticia-de-teste";
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.TREINAMENTOS_EVIDENCIAS_PATH = dir;
  process.env.TREINAMENTOS_EVIDENCIAS_TOKEN = "token-ficticio-de-teste";
});

const B = "http://local/api/treinamentos/evidencias";
const SESSAO = () => `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`;
const PDF_FICTICIO = Buffer.concat([Buffer.from("%PDF-1.4\n% lista fictícia de teste\n"), Buffer.alloc(200, 0x20)]);

function reqDesbloquear(cookie?: string, token = "token-ficticio-de-teste") {
  return new Request(`${B}/desbloquear`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ token }),
  });
}
function reqUpload(cookie?: string) {
  const form = new FormData();
  form.set("ano", "2026");
  form.set("arquivo", new File([PDF_FICTICIO], "lista-ficticia.pdf", { type: "application/pdf" }));
  return new Request(`${B}/upload`, { method: "POST", headers: cookie ? { cookie } : {}, body: form });
}

async function semDados(r: Response) {
  assert.equal(r.status, 401);
  const j = (await r.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(j).sort(), ["message", "ok"]);
  assert.equal(j.ok, false);
  assert.equal(r.headers.get("set-cookie"), null, "não grava cookie de evidências");
}

test("POST desbloquear sem sessão de admin → 401 (mesmo com token certo)", async () => {
  await semDados(await desbloquear.POST(reqDesbloquear()));
});

test("POST desbloquear sem sessão e sem token configurado → 401 (antes liberava)", async () => {
  delete process.env.TREINAMENTOS_EVIDENCIAS_TOKEN;
  await semDados(await desbloquear.POST(reqDesbloquear()));
});

test("POST desbloquear com sessão vencida/inválida → 401", async () => {
  await semDados(await desbloquear.POST(reqDesbloquear(`${COOKIE_SESSAO_CONTRATOS}=invalido.123`)));
});

test("POST desbloquear com sessão: token certo → 200 + cookie; token errado → 401 do token", async () => {
  const ok = await desbloquear.POST(reqDesbloquear(SESSAO()));
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("set-cookie") ?? "", /treinamentos_evidencias=/);
  const errado = await desbloquear.POST(reqDesbloquear(SESSAO(), "outro-token"));
  assert.equal(errado.status, 401);
  assert.equal(((await errado.json()) as { erro?: string }).erro, "token inválido");
});

test("POST upload sem sessão → 401 e nada gravado (com e sem token de evidências)", async () => {
  await semDados(await upload.POST(reqUpload(`treinamentos_evidencias=token-ficticio-de-teste`)));
  delete process.env.TREINAMENTOS_EVIDENCIAS_TOKEN;
  await semDados(await upload.POST(reqUpload()));
  assert.deepEqual(existsSync(dir) ? readdirSync(dir) : [], []);
});

test("POST upload com sessão + token → 200 e PDF fictício gravado; com sessão sem token → 401 do token", async () => {
  const semToken = await upload.POST(reqUpload(SESSAO()));
  assert.equal(semToken.status, 401);
  assert.deepEqual(readdirSync(dir), []);
  const r = await upload.POST(reqUpload(`${SESSAO()}; treinamentos_evidencias=token-ficticio-de-teste`));
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(readdirSync(dir).length, 1);
});
