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

test("inverter a ordem da lista não dá visão de gestão à chefia", () => {
  process.env[PAPEIS_BOT_ENV] = [
    "Chefia de Enfermagem",
    "Solicitante assistencial",
    "Compras",
    "Manutenção",
    "Diretoria/Gestão",
  ].join(", ");
  assert.equal(papelGestao("Chefia de Enfermagem"), false);
  assert.equal(papelAssistencial("Chefia de Enfermagem"), true);
  assert.equal(papelGestao("Solicitante assistencial"), false);
  assert.equal(papelAssistencial("Solicitante assistencial"), true);
  assert.equal(papelGestao("Diretoria/Gestão"), true);
  assert.equal(papelGestao("Manutenção"), true);
  assert.equal(papelGestao("Compras"), false);
  assert.equal(papelAssistencial("Compras"), false);
});

test("nome fora da lista canônica não vira gestão", () => {
  process.env[PAPEIS_BOT_ENV] = "Gestao ZZ, Chefia ZZ, Compras ZZ, Oficina ZZ, Solicitante ZZ";
  assert.equal(papelGestao("Gestao ZZ"), false);
  assert.equal(papelGestao("Oficina ZZ"), false);
  assert.equal(papelAssistencial("Gestao ZZ"), true);
  assert.equal(papelAssistencial("Chefia ZZ"), true);
  assert.equal(papelGestao("Papel ZZTESTE"), false);
  assert.equal(papelAssistencial("Papel ZZTESTE"), true);
  assert.equal(papelGestao("Diretoria/Gestão"), true);
  assert.equal(papelGestao("Chefia de Enfermagem"), false);
  assert.equal(papelAssistencial("Compras"), false);
});
