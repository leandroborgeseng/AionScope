import assert from "node:assert/strict";
import { test } from "node:test";
import { mascararTelefone, normalizarTelefone } from "./telefone";

const CANONICO = "+5511900000001";

const GRAFIAS = [
  "+55 11 90000-0001",
  "55 11 90000-0001",
  "5511900000001",
  "11 90000-0001",
  "(11) 90000-0001",
  "011900000001",
  "+55 (11) 90000-0001",
  "11900000001",
  "+55 11 0000-0001",
  "551100000001",
  "11 0000-0001",
  "(11) 0000-0001",
  "01100000001",
];

test("com e sem +55, com e sem nono dígito, normalizam para o mesmo E.164", () => {
  for (const grafia of GRAFIAS) {
    assert.equal(normalizarTelefone(grafia), CANONICO, grafia);
  }
});

test("número diferente e fixo não colidem com o celular sintético", () => {
  assert.equal(normalizarTelefone("+55 11 90000-0002"), "+5511900000002");
  assert.notEqual(normalizarTelefone("+55 11 90000-0002"), CANONICO);
  assert.equal(normalizarTelefone("+55 11 3000-0001"), "+551130000001");
  assert.equal(normalizarTelefone("+55 11 93000-0001"), "+5511930000001");
  assert.notEqual(normalizarTelefone("+55 11 3000-0001"), normalizarTelefone("+55 11 93000-0001"));
});

test("mal formatado é recusado e não vira cadastro", () => {
  for (const entrada of [
    "",
    "   ",
    "abc",
    "123",
    "+1 202 555 0199",
    "+55 10 90000-0001",
    "11 90000",
    "+55 11 80000-0001",
    "11900000001 ramal 9",
    "++55 11 90000-0001",
    null,
    5511900000001,
    "+55 11 90000-0001<script>",
  ]) {
    assert.equal(normalizarTelefone(entrada), null, String(entrada));
  }
});

test("máscara mostra só o DDD e os quatro finais", () => {
  assert.equal(mascararTelefone(CANONICO), "+55 11 •••••-0001");
  assert.equal(mascararTelefone(CANONICO).includes("90000"), false);
  assert.equal(mascararTelefone("nao-e-telefone"), "+55 •• ••••-••••");
});
