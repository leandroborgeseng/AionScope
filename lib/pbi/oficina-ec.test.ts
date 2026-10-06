import assert from "node:assert/strict";
import test from "node:test";
import {
  isOficinaEngenhariaClinica,
  normalizeOficina,
  OFICINAS_EC_ALLOWLIST,
  OFICINAS_EC_DENYLIST,
  OFICINAS_EC_PATTERNS,
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
  assert.equal(isOficinaEngenhariaClinica("OFICINA ENGENHARIA CLINICA"), true);
});

test("aceita eng. clinica e alias EC (exato)", () => {
  assert.equal(isOficinaEngenhariaClinica("ENG. CLINICA"), true);
  assert.equal(isOficinaEngenhariaClinica("eng clinica"), true);
  assert.equal(isOficinaEngenhariaClinica("EC"), true);
  assert.equal(isOficinaEngenhariaClinica("ec"), true);
  // Não casar "EC" dentro de palavra aleatória
  assert.equal(isOficinaEngenhariaClinica("TECNICO"), false);
  assert.equal(isOficinaEngenhariaClinica("REC"), false);
});

test("aceita calibração / preventiva / TSE e variantes", () => {
  assert.equal(isOficinaEngenhariaClinica("Calibração"), true);
  assert.equal(isOficinaEngenhariaClinica("CALIBRACAO"), true);
  assert.equal(isOficinaEngenhariaClinica("Calibração de Equipamentos"), true);
  assert.equal(isOficinaEngenhariaClinica("PREVENTIVA"), true);
  assert.equal(isOficinaEngenhariaClinica("PREVENTIVA EQUIPAMENTOS"), true);
  assert.equal(isOficinaEngenhariaClinica("Preventiva Equipamentos Médicos"), true);
  assert.equal(isOficinaEngenhariaClinica("TSE"), true);
  assert.equal(isOficinaEngenhariaClinica("tse"), true);
  assert.equal(isOficinaEngenhariaClinica("SEGURANÇA ELÉTRICA"), true);
  assert.equal(isOficinaEngenhariaClinica("Teste de Segurança Elétrica"), true);
  assert.equal(isOficinaEngenhariaClinica("OFICINA TSE"), true);
});

test("aceita oficinas especializadas EC da allowlist canônica", () => {
  for (const nome of OFICINAS_EC_ALLOWLIST) {
    assert.equal(isOficinaEngenhariaClinica(nome), true, nome);
  }
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
  assert.equal(isOficinaEngenhariaClinica("MANUTENCAO GERAL"), false);
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
  // Não aceitar só porque contém "CLINICA" ou "ENGENHARIA" isolados
  assert.equal(isOficinaEngenhariaClinica("ENGENHARIA CIVIL"), false);
  assert.equal(isOficinaEngenhariaClinica("CLINICA MEDICA"), false);
  assert.equal(isOficinaEngenhariaClinica("MANUTENCAO GERAL"), false);
});

test("allowlist canônica não inclui OFICINA GERAL e tem padrões positivos", () => {
  assert.equal(
    (OFICINAS_EC_ALLOWLIST as readonly string[]).includes("OFICINA GERAL"),
    false,
  );
  assert.ok(OFICINAS_EC_PATTERNS.length >= 5);
});
