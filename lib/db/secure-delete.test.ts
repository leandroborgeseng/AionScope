import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { excluirUsuario, criarUsuario } from "@/lib/bot/usuarios";
import { closeDbForTests, getDb } from "@/lib/db/client";

const MARCADOR = "Bruno QA m7kQ2p";

let dir = "";
const envAntes = process.env.DATABASE_PATH;

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "lgpd-wal-"));
  process.env.DATABASE_PATH = path.join(dir, "app.sqlite");
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  if (envAntes === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = envAntes;
  rmSync(dir, { recursive: true, force: true });
});

function contem(arquivo: string) {
  if (!existsSync(arquivo)) return false;
  return readFileSync(arquivo).includes(Buffer.from(MARCADOR, "utf8"));
}

test("exclusão zera o marcador no arquivo principal e no WAL", () => {
  const db = getDb();
  assert.equal(db.pragma("secure_delete", { simple: true }), 1);

  const criado = criarUsuario({
    nome: MARCADOR,
    papel: "Compras",
    telefone: "+55 11 98888-0001",
  });
  assert.equal(criado.ok, true);
  if (!criado.ok) return;

  const arquivo = process.env.DATABASE_PATH ?? "";
  const wal = `${arquivo}-wal`;
  db.pragma("wal_checkpoint(TRUNCATE)");
  assert.equal(contem(arquivo), true, "o marcador precisa estar no arquivo antes da exclusão");

  const exclusao = excluirUsuario(criado.data.id);
  assert.equal(exclusao.ok, true);
  assert.equal(contem(arquivo), false);
  assert.equal(contem(wal), false);
});
