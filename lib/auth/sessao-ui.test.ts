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

test("A1: voltar recusa caractere de controle, espaço e barra invertida (open redirect)", () => {
  const ruins = [
    "https://evil.example", "//evil.example", "/\\evil", "\\\\evil.example", "sala", "",
    "http:evil.example", "javascript:alert(1)", "///evil.example", "/\\/evil.example", " /sala", "\t//evil.example",
    "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/ /evil.example", "/\x00/evil", "/\x7f/evil",
  ];
  for (const ruim of ruins) assert.equal(voltarSeguro(ruim), null, JSON.stringify(ruim));
  for (const cod of ["%09", "%0A", "%0D", "%0a", "%0d", "%00", "%20", "%5C"]) {
    const decodificado = new URLSearchParams(`voltar=/${cod}/evil.example`).get("voltar");
    assert.equal(voltarSeguro(decodificado), null, cod);
  }
  assert.equal(voltarSeguro("/sala/pedidos?x=1#a"), "/sala/pedidos?x=1#a");
  assert.equal(voltarSeguro("/sala", "https://app.example"), "/sala");
  assert.equal(hrefLoginAdmin("/\t/evil.example"), "/cadastros/contratos");
});
