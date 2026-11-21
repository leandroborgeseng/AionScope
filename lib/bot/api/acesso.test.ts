import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { PAPEIS_BOT_ENV } from "../papeis";
import { papelAssistencial, papelGestao } from "./acesso";

afterEach(() => {
  delete process.env[PAPEIS_BOT_ENV];
});

test("papéis padrão: assistência travada e gestão solta", () => {
  assert.equal(papelAssistencial("Chefia de Enfermagem"), true);
  assert.equal(papelAssistencial("solicitante assistencial"), true);
  assert.equal(papelAssistencial("Compras"), false);
  assert.equal(papelGestao("Diretoria/Gestão"), true);
  assert.equal(papelGestao("Manutenção"), true);
  assert.equal(papelGestao("Chefia de Enfermagem"), false);
  assert.equal(papelGestao("Compras"), false);
});

test("renomear a lista inteira, no mesmo tamanho, preserva o lugar de cada papel", () => {
  process.env[PAPEIS_BOT_ENV] = "Gestao ZZ, Chefia ZZ, Compras ZZ, Oficina ZZ, Solicitante ZZ";
  assert.equal(papelGestao("Gestao ZZ"), true);
  assert.equal(papelGestao("Oficina ZZ"), true);
  assert.equal(papelAssistencial("Chefia ZZ"), true);
  assert.equal(papelAssistencial("Solicitante ZZ"), true);
  assert.equal(papelGestao("Compras ZZ"), false);
  assert.equal(papelAssistencial("Compras ZZ"), false);
  assert.equal(papelAssistencial("Chefia de Enfermagem"), true);
  assert.equal(papelGestao("Manutenção"), true);
});

test("nome fora da lista não vira setor livre: fecha como assistência", () => {
  process.env[PAPEIS_BOT_ENV] = "Papel ZZTESTE";
  assert.equal(papelGestao("Papel ZZTESTE"), false);
  assert.equal(papelAssistencial("Papel ZZTESTE"), true);
  assert.equal(papelAssistencial("Chefia de Enfermagem"), true);
  assert.equal(papelGestao("Diretoria/Gestão"), true);
  assert.equal(papelAssistencial("Compras"), false);
});
