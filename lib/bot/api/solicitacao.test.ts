import assert from "node:assert/strict";
import { test } from "node:test";
import { prepararSolicitacao } from "./solicitacao";

test("solicitação normaliza espaço, mascara CPF, telefone e e-mail e corta em 280", () => {
  const mascarado = prepararSolicitacao(
    "Paciente   Exemplo ZZ  123.456.789-09  12345678909  zz@exemplo.invalid  +55 11 98888-7777  (11) 97777-6666",
  );
  assert.equal(mascarado.includes("  "), false);
  assert.equal(mascarado.includes("Paciente Exemplo ZZ"), true);
  assert.equal(mascarado.includes("123.456.789-09"), false);
  assert.equal(mascarado.includes("12345678909"), false);
  assert.equal(mascarado.includes("@"), false);
  assert.equal(mascarado.includes("98888"), false);
  assert.equal(mascarado.includes("97777"), false);
  assert.equal(mascarado.includes("[cpf]"), true);
  assert.equal(mascarado.includes("[e-mail]"), true);
  assert.equal(mascarado.includes("[telefone]"), true);

  const longo = prepararSolicitacao(`${"B".repeat(270)} 123.456.789-09 ${"C".repeat(40)}`);
  assert.equal(longo.length, 280);
  assert.equal(longo.includes("123.456"), false);
  assert.equal(longo.startsWith("B"), true);
});
