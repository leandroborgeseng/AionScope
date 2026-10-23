import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { COOKIE_SESSAO_CONTRATOS, criarTokenSessao } from "./contratos-sessao";
import { LIMITE_EVIDENCIA_BYTES, statusEvidencias } from "../treinamentos/evidencias";
import * as pdf from "../../app/api/treinamentos/evidencias/[ano]/route";
import * as upload from "../../app/api/treinamentos/evidencias/upload/route";
import * as status from "../../app/api/treinamentos/evidencias/status/route";

// Ambiente fictício: diretório temporário, senha/segredo/token de teste e PDFs inventados (repo público).
let dir = "";
const envAntes = { ...process.env };
const TOKEN = "token-ficticio-de-teste";
const PDF_FICTICIO = Buffer.concat([Buffer.from("%PDF-1.4\n% lista fictícia\n"), Buffer.alloc(300, 0x20)]);
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "aion-evid-get-"));
  writeFileSync(path.join(dir, "2026_lista_presenca_bomba_infusao.pdf"), PDF_FICTICIO);
});
after(() => {
  process.env = envAntes;
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  process.env.CONTRATOS_ADMIN_PASSWORD = "senha-ficticia-de-teste";
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.TREINAMENTOS_EVIDENCIAS_PATH = dir;
  process.env.TREINAMENTOS_EVIDENCIAS_TOKEN = TOKEN;
});

const SESSAO = () => `${COOKIE_SESSAO_CONTRATOS}=${criarTokenSessao()}`;
const ctx = (ano = "2026") => ({ params: Promise.resolve({ ano }) });
const get = (headers: Record<string, string> = {}, q = "") =>
  pdf.GET(new Request(`http://local/api/treinamentos/evidencias/2026${q}`, { headers }), ctx());

async function semDados401(r: Response) {
  assert.equal(r.status, 401);
  assert.notEqual(r.headers.get("content-type"), "application/pdf");
  const j = (await r.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(j).sort(), ["message", "ok"]);
}

test("A4 GET evidencias/[ano] sem sessão → 401 com token válido em qualquer forma", async () => {
  await semDados401(await get());
  await semDados401(await get({ authorization: `Bearer ${TOKEN}` }));
  await semDados401(await get({}, `?token=${TOKEN}`));
  await semDados401(await get({ cookie: `treinamentos_evidencias=${TOKEN}` }));
  await semDados401(await get({ cookie: `${COOKIE_SESSAO_CONTRATOS}=forjado.1` }));
});

test("A4 GET sem token configurado e sem sessão → 401 (antes servia o PDF a qualquer um)", async () => {
  delete process.env.TREINAMENTOS_EVIDENCIAS_TOKEN;
  await semDados401(await get());
});

test("A4 GET com sessão: sem token → 401; com token → 200 PDF; sem token configurado → 200", async () => {
  assert.equal((await get({ cookie: SESSAO() })).status, 401);
  const ok = await get({ cookie: `${SESSAO()}; treinamentos_evidencias=${TOKEN}` });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await ok.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
  delete process.env.TREINAMENTOS_EVIDENCIAS_TOKEN;
  assert.equal((await get({ cookie: SESSAO() })).status, 200);
});

test("A3 status sem caminho do servidor; liberado só com sessão", async () => {
  delete process.env.TREINAMENTOS_EVIDENCIAS_TOKEN;
  const anon = await (await status.GET(new Request("http://local/api/treinamentos/evidencias/status"))).json();
  const txt = JSON.stringify(anon);
  assert.equal(txt.includes(dir), false);
  assert.equal(/"diretorio"/.test(txt), false);
  assert.equal((anon as { liberado: boolean }).liberado, false);
  const s = statusEvidencias(new Request("http://local/x", { headers: { cookie: SESSAO() } }));
  assert.equal(s.liberado, true);
  assert.equal(s.sessao, true);
});

function reqUpload(bytes: Buffer, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("ano", "2025");
  form.set("arquivo", new File([new Uint8Array(bytes)], "lista-ficticia.pdf", { type: "application/pdf" }));
  return new Request("http://local/api/treinamentos/evidencias/upload", {
    method: "POST",
    headers: { cookie: `${SESSAO()}; treinamentos_evidencias=${TOKEN}`, ...extra },
    body: form,
  });
}

test("A1 upload acima de 20 MB → 413 e nada gravado; exatamente 20 MB → 200", async () => {
  const antes = readdirSync(dir).sort();
  const grande = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(LIMITE_EVIDENCIA_BYTES - 3, 0x20)]);
  const r = await upload.POST(reqUpload(grande));
  assert.equal(r.status, 413);
  assert.match(((await r.json()) as { erro: string }).erro, /20 MB/);
  assert.deepEqual(readdirSync(dir).sort(), antes);
  const limite = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(LIMITE_EVIDENCIA_BYTES - 4, 0x20)]);
  assert.equal((await upload.POST(reqUpload(limite))).status, 200);
});

test("A1 Content-Length declarado acima do limite → 413 antes de ler o corpo", async () => {
  const r = await upload.POST(
    new Request("http://local/api/treinamentos/evidencias/upload", {
      method: "POST",
      headers: { cookie: `${SESSAO()}; treinamentos_evidencias=${TOKEN}`, "content-length": String(60 * 1024 * 1024) },
      body: "x",
    }),
  );
  assert.equal(r.status, 413);
});

test("A3 resposta do upload sem 'destino' nem caminho do servidor", async () => {
  const r = await upload.POST(reqUpload(PDF_FICTICIO));
  assert.equal(r.status, 200);
  const txt = JSON.stringify(await r.json());
  assert.equal(txt.includes("destino"), false);
  assert.equal(txt.includes(dir), false);
  assert.equal(txt.includes("/data"), false);
});
