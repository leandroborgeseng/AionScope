import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { closeDbForTests } from "../db/client";
import {
  ANEXO_TAMANHO_MAX,
  gravarAnexoOrdem,
  listarAnexosOrdem,
  obterAnexo,
  removerAnexoOrdem,
  resolveAnexosRoot,
  validarArquivoAnexo,
} from "./anexos";
import { upsertOrdemCompra } from "./store";
import { parseOrdemCompra } from "./validate";

const dir = path.join(os.tmpdir(), `aion-oc-anexo-${process.pid}-${Date.now()}`);
let dbPath = "";

function parsed(body: Record<string, unknown>) {
  const r = parseOrdemCompra(body);
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("parse");
  return r.data;
}

/** PNG 1×1 mínimo. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

before(() => {
  mkdirSync(dir, { recursive: true });
  dbPath = path.join(dir, "t.sqlite");
  process.env.DATABASE_PATH = dbPath;
  process.env.ORDENS_COMPRA_ANEXOS_PATH = path.join(dir, "anexos");
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  rmSync(dir, { recursive: true, force: true });
});

test("validarArquivoAnexo aceita PNG e rejeita MIME inválido / tamanho", () => {
  const ok = validarArquivoAnexo({
    nome: "foto.png",
    contentType: "image/png",
    bytes: PNG_1X1,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("fail");
  assert.equal(ok.mime, "image/png");

  const bad = validarArquivoAnexo({
    nome: "x.exe",
    contentType: "application/octet-stream",
    bytes: Buffer.from("MZ"),
  });
  assert.equal(bad.ok, false);

  const grande = validarArquivoAnexo({
    nome: "big.png",
    contentType: "image/png",
    bytes: Buffer.alloc(ANEXO_TAMANHO_MAX + 1, 0),
  });
  assert.equal(grande.ok, false);
});

test("gravar / listar / remover anexo não altera upsert da OC", () => {
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-ANX-1",
      status: "solicitado",
      fornecedor: "Anexo SA",
      valor_total: "1.00",
    }),
  );

  const root = resolveAnexosRoot();
  assert.ok(root.includes("anexos"));

  const criado = gravarAnexoOrdem({
    numero_ordem: "OC-ANX-1",
    nome: "solicitacao.png",
    contentType: "image/png",
    bytes: PNG_1X1,
    fonte: "manual",
  });
  assert.equal(criado.ok, true);
  if (!criado.ok) throw new Error("fail");
  assert.equal(criado.anexo.fonte, "manual");
  assert.equal(criado.anexo.content_type, "image/png");
  assert.ok(criado.anexo.url.includes("/anexos/"));

  const lista = listarAnexosOrdem("OC-ANX-1");
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, criado.anexo.id);

  const obtido = obterAnexo("OC-ANX-1", criado.anexo.id);
  assert.ok(obtido);
  assert.equal(obtido?.caminho_relativo.includes("OC-ANX-1"), true);

  // Re-upsert do robô não apaga anexos
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-ANX-1",
      status: "ordem_gerada",
      fornecedor: "Anexo SA",
      valor_total: "2.00",
    }),
  );
  assert.equal(listarAnexosOrdem("OC-ANX-1").length, 1);

  const robot = gravarAnexoOrdem({
    numero_ordem: "OC-ANX-1",
    nome: "email.pdf",
    contentType: "application/pdf",
    bytes: Buffer.from("%PDF-1.4 minimal"),
    fonte: "email_robot",
    email_message_id: "msg-1",
    descricao: "PDF do e-mail",
  });
  assert.equal(robot.ok, true);
  if (!robot.ok) throw new Error("fail");
  assert.equal(robot.anexo.descricao, "PDF do e-mail");
  assert.equal(listarAnexosOrdem("OC-ANX-1").length, 2);

  const comAnexos = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-ANX-1",
      status: "ordem_gerada",
      fornecedor: "Anexo SA",
    }),
  ).ordem;
  assert.ok(comAnexos.anexos.length >= 2);

  const rem = removerAnexoOrdem("OC-ANX-1", criado.anexo.id);
  assert.equal(rem.ok, true);
  assert.equal(listarAnexosOrdem("OC-ANX-1").length, 1);
});
