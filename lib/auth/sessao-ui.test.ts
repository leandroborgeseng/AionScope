import assert from "node:assert/strict";
import { test } from "node:test";
import { MSG_SESSAO_EXPIRADA, hrefLoginAdmin, mensagemErroEscrita, voltarSeguro } from "./sessao-ui";

test("link de login leva de volta à página de origem", () => {
  assert.equal(hrefLoginAdmin("/sala/pedidos"), "/cadastros/contratos?voltar=%2Fsala%2Fpedidos");
  assert.equal(hrefLoginAdmin("/sala/ordens-compra?status=aberta"), "/cadastros/contratos?voltar=%2Fsala%2Fordens-compra%3Fstatus%3Daberta");
});

test("voltar só aceita caminho interno (sem open redirect)", () => {
  assert.equal(voltarSeguro("/sala"), "/sala");
  for (const ruim of ["https://evil.example", "//evil.example", "/\\evil", "sala", "", null, undefined]) assert.equal(voltarSeguro(ruim), null);
  assert.equal(hrefLoginAdmin("https://evil.example"), "/cadastros/contratos");
});

test("401 no meio da edição vira 'Sessão expirada'", () => {
  assert.equal(mensagemErroEscrita(401, "qualquer"), MSG_SESSAO_EXPIRADA);
  assert.equal(mensagemErroEscrita(400, "Campo X inválido"), "Campo X inválido");
  assert.equal(mensagemErroEscrita(500, null, "Falha ao gravar pedido."), "Falha ao gravar pedido.");
});
