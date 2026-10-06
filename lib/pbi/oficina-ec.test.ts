import assert from "node:assert/strict";
import test from "node:test";
import {
  isOficinaEngenhariaClinica,
  normalizeOficina,
  OFICINAS_EC_ALLOWLIST,
  OFICINAS_EC_DENYLIST,
} from "./oficina-ec";

test("normalizeOficina remove acento e uppercases", () => {
  assert.equal(normalizeOficina("  Engenharia Clínica  "), "ENGENHARIA CLINICA");
  assert.equal(normalizeOficina("Calibração de Equipamentos"), "CALIBRACAO DE EQUIPAMENTOS");
});

test("aceita ENGENHARIA CLÍNICA e variantes de casing/acento", () => {
  assert.equal(isOficinaEngenhariaClinica("ENGENHARIA CLÍNICA"), true);
  assert.equal(isOficinaEngenhariaClinica("Engenharia Clínica"), true);
  assert.equal(isOficinaEngenhariaClinica("engenharia clinica"), true);
  assert.equal(isOficinaEngenhariaClinica("  Engenharia Clínica  "), true);
});

test("aceita alias EC", () => {
  assert.equal(isOficinaEngenhariaClinica("EC"), true);
  assert.equal(isOficinaEngenhariaClinica("ec"), true);
});

test("aceita oficinas especializadas EC da allowlist", () => {
  for (const nome of OFICINAS_EC_ALLOWLIST) {
    assert.equal(isOficinaEngenhariaClinica(nome), true, nome);
  }
  assert.equal(isOficinaEngenhariaClinica("Calibração de Equipamentos"), true);
  assert.equal(isOficinaEngenhariaClinica("SEGURANÇA ELÉTRICA"), true);
  assert.equal(isOficinaEngenhariaClinica("PREVENTIVA EQUIPAMENTOS"), true);
  assert.equal(isOficinaEngenhariaClinica("INSTRUMENTAL"), true);
  assert.equal(isOficinaEngenhariaClinica("MOVIMENTAÇÃO EQUIPAMENTOS"), true);
  assert.equal(isOficinaEngenhariaClinica("ELETRÔNICA"), true);
});

test("rejeita Oficina Geral e variantes", () => {
  assert.equal(isOficinaEngenhariaClinica("OFICINA GERAL"), false);
  assert.equal(isOficinaEngenhariaClinica("Oficina Geral"), false);
  assert.equal(isOficinaEngenhariaClinica("oficina geral"), false);
  assert.equal(isOficinaEngenhariaClinica("  Oficina Geral  "), false);
  assert.equal(isOficinaEngenhariaClinica("GERAL"), false);
  for (const nome of OFICINAS_EC_DENYLIST) {
    assert.equal(isOficinaEngenhariaClinica(nome), false, nome);
  }
});

test("rejeita oficinas prediais / manutenção geral da amostra", () => {
  const rejeitadas = [
    "REFRIGERAÇÃO",
    "CIVIL/ OBRAS",
    "PREVENTIVAS (MANUTENÇÃO)",
    "TAPEÇARIA",
    "TELAS MOSQUITEIRAS",
    "ANTECIPAÇÃO DOS SERVIÇOS (MANUTENÇÃO)",
  ];
  for (const nome of rejeitadas) {
    assert.equal(isOficinaEngenhariaClinica(nome), false, nome);
  }
});

test("rejeita vazio, null e substring frouxa", () => {
  assert.equal(isOficinaEngenhariaClinica(""), false);
  assert.equal(isOficinaEngenhariaClinica(null), false);
  assert.equal(isOficinaEngenhariaClinica(undefined), false);
  // Não é equals: não aceitar só porque contém "ENGENHARIA" ou "CLINICA".
  assert.equal(isOficinaEngenhariaClinica("ENGENHARIA CIVIL"), false);
  assert.equal(isOficinaEngenhariaClinica("OFICINA ENGENHARIA CLINICA"), false);
  assert.equal(isOficinaEngenhariaClinica("MANUTENCAO GERAL"), false);
});

test("allowlist não inclui OFICINA GERAL", () => {
  assert.equal(
    (OFICINAS_EC_ALLOWLIST as readonly string[]).includes("OFICINA GERAL"),
    false,
  );
});
