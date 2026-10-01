import assert from "node:assert/strict";
import test from "node:test";
import {
  extrairCamposPedido,
  extrairOs,
  extrairSc,
  situacaoCompra,
} from "./parse-email";

test("extrai OS do assunto padrão", () => {
  assert.equal(
    extrairOs("[OS 202609588] Solicitação de compra – Placa – Bisturi HSJ-01174"),
    "202609588",
  );
});

test("SEM OS não inventa número", () => {
  assert.equal(extrairOs("[SEM OS] Solicitação de compra – Peça avulsa"), null);
});

test("extrai SC em formatos comuns", () => {
  assert.equal(extrairSc("SC: 48213"), "48213");
  assert.equal(extrairSc("SC nº 48213"), "48213");
  assert.equal(extrairSc("SC-48213"), "48213");
  assert.equal(extrairSc("Solicitação de compra 48213"), "48213");
});

test("extrai campos do corpo modelo", () => {
  const campos = extrairCamposPedido(
    "[OS 202609588] Solicitação de compra – Placa de potência – Bisturi elétrico HSJ-01174",
    `OS: 202609588
Equipamento: Bisturi elétrico · TAG HSJ-01174
Setor: Centro Cirúrgico 10A
Item(ns):
  1. Placa de potência · ref. fabricante XXXX · qtd 1
Urgência: Alta`,
  );
  assert.equal(campos.os, "202609588");
  assert.equal(campos.tag, "HSJ-01174");
  assert.equal(campos.setor, "Centro Cirúrgico 10A");
  assert.match(campos.item ?? "", /Placa de potência/);
  assert.match(campos.equipamento ?? "", /Bisturi/);
});

test("situação cobra Manutenção sem SC após prazo", () => {
  const enviado = new Date(2026, 8, 1);
  const agora = new Date(2026, 8, 5);
  assert.equal(
    situacaoCompra({ os: "1", enviadoEm: enviado, scNumero: null, scEm: null, entregueEm: null, agora }),
    "cobrar Manutenção",
  );
});

test("situação aguarda entrega com SC recente", () => {
  const enviado = new Date(2026, 8, 1);
  const scEm = new Date(2026, 8, 2);
  const agora = new Date(2026, 8, 5);
  assert.equal(
    situacaoCompra({
      os: "1",
      enviadoEm: enviado,
      scNumero: "48213",
      scEm,
      entregueEm: null,
      agora,
    }),
    "aguarda entrega",
  );
});
