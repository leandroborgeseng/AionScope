import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { closeDbForTests, getDb } from "../client";
import { aplicarMigration015BotUsuario } from "./015_bot_usuario";
import { aplicarMigration016BotEntrega } from "./016_bot_entrega";
import { aplicarMigration017BotConvite } from "./017_bot_convite";
import {
  analisarCsvSetores,
  contarSetores,
  importarSetoresCsv,
  lerCsvSetoresEffort,
  SETORES_EXPORTADO_EM,
} from "@/lib/bot/setores";

const ANA = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Ana Exemplo",
  papel: "Compras",
  telefone: "+5511900000001",
  email: "ana@aion.local",
  setor: "UTI ZZTESTE",
  criado: "2026-11-10T12:00:00.000Z",
};

function banco() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
  db.pragma("foreign_keys = ON");
  return db;
}

function inserirAna(db: Database.Database) {
  db.prepare(
    `INSERT INTO bot_usuario (
      id, nome, papel, telefone_e164, situacao, dono, email, setor, outros_setores,
      criado_em, atualizado_em
    ) VALUES (
      @id, @nome, @papel, @telefone, 'pendente', 'dpo', @email, @setor, 'Plantao ZZTESTE',
      @criado, @criado
    )`,
  ).run({
    id: ANA.id,
    nome: ANA.nome,
    papel: ANA.papel,
    telefone: ANA.telefone,
    email: ANA.email,
    setor: ANA.setor,
    criado: ANA.criado,
  });
}

test("CSV do Effort: 154 setores e 148 ativos; codigo é texto", () => {
  const setores = analisarCsvSetores(lerCsvSetoresEffort());
  assert.equal(setores.length, 154);
  assert.equal(setores.filter((setor) => setor.ativo).length, 148);
  assert.equal(setores.filter((setor) => !setor.ativo).length, 6);
  const codigo = setores.find((setor) => setor.codigo === "55D");
  assert.ok(codigo);
  assert.equal(typeof codigo?.codigo, "string");
  assert.equal(setores.some((setor) => setor.nome.includes("Ana") || setor.nome.includes("@")), false);
});

test("017 duas vezes sobre dados da 015: idempotente, só aditiva, não mexe na Ana", () => {
  const db = banco();
  aplicarMigration015BotUsuario(db);
  aplicarMigration016BotEntrega(db);
  inserirAna(db);
  const antes = db.prepare("SELECT * FROM bot_usuario WHERE id = ?").get(ANA.id) as Record<string, unknown>;

  aplicarMigration017BotConvite(db);
  aplicarMigration017BotConvite(db);

  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '017_bot_convite'").get() as { n: number };
  assert.equal(n.n, 1);
  const pessoas = db.prepare("SELECT COUNT(*) n FROM bot_usuario").get() as { n: number };
  assert.equal(pessoas.n, 1);
  const depois = db.prepare("SELECT * FROM bot_usuario WHERE id = ?").get(ANA.id) as Record<string, unknown>;
  assert.equal(depois.nome, antes.nome);
  assert.equal(depois.telefone_e164, antes.telefone_e164);
  assert.equal(depois.email, antes.email);
  assert.equal(depois.papel, antes.papel);
  assert.equal(depois.setor, antes.setor);
  assert.equal(depois.situacao, "pendente");
  assert.equal(depois.funcao_declarada, null);
  assert.equal(depois.descricao_funcao, null);
  assert.equal(depois.convite_id, null);
  assert.equal(depois.ciencia_em, null);
  assert.equal(JSON.stringify(depois).includes("900000001"), true);

  const contagem = contarSetores(db);
  assert.equal(contagem.total, 154);
  assert.equal(contagem.ativos, 148);
  const exportado = db.prepare("SELECT DISTINCT exportado_em FROM bot_setor").all() as Array<{ exportado_em: string }>;
  assert.deepEqual(exportado, [{ exportado_em: SETORES_EXPORTADO_EM }]);
  const almox = db.prepare("SELECT codigo, ativo FROM bot_setor WHERE codigo = '55D'").get() as { codigo: string; ativo: number };
  assert.deepEqual(almox, { codigo: "55D", ativo: 1 });
  db.close();
});

test("reimportar atualiza a data e não apaga vínculo", () => {
  const db = banco();
  aplicarMigration015BotUsuario(db);
  aplicarMigration016BotEntrega(db);
  aplicarMigration017BotConvite(db);
  inserirAna(db);
  db.prepare("INSERT INTO bot_usuario_setor (usuario_id, setor_codigo) VALUES (?, '55D')").run(ANA.id);
  const csv = lerCsvSetoresEffort().replace('"55D","ALMOXARIFADO AION"', '"55D","ALMOXARIFADO AION ZZ"');
  const outraData = "2026-12-01T10:00:00.000-03:00";
  importarSetoresCsv(db, csv, outraData);
  importarSetoresCsv(db, csv, outraData);

  const vinculo = db.prepare("SELECT COUNT(*) n FROM bot_usuario_setor WHERE usuario_id = ?").get(ANA.id) as { n: number };
  assert.equal(vinculo.n, 1);
  const setor = db.prepare("SELECT nome, exportado_em FROM bot_setor WHERE codigo = '55D'").get() as {
    nome: string;
    exportado_em: string;
  };
  assert.equal(setor.nome, "ALMOXARIFADO AION ZZ");
  assert.equal(setor.exportado_em, outraData);
  const contagem = contarSetores(db);
  assert.equal(contagem.total, 154);
  assert.equal(contagem.ativos, 148);
  const pessoa = db.prepare("SELECT nome, telefone_e164, email FROM bot_usuario WHERE id = ?").get(ANA.id) as {
    nome: string;
    telefone_e164: string;
    email: string;
  };
  assert.equal(pessoa.nome, ANA.nome);
  assert.equal(pessoa.telefone_e164, ANA.telefone);
  assert.equal(pessoa.email, ANA.email);
  db.close();
});

test("getDb aplica 017 uma vez", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m017-"));
  const antigo = process.env.DATABASE_PATH;
  try {
    process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
    closeDbForTests();
    const db = getDb();
    getDb();
    const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '017_bot_convite'").get() as { n: number };
    assert.equal(n.n, 1);
    const contagem = contarSetores(db);
    assert.equal(contagem.total, 154);
    assert.equal(contagem.ativos, 148);
  } finally {
    closeDbForTests();
    if (antigo === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = antigo;
    rmSync(dir, { recursive: true, force: true });
  }
});
