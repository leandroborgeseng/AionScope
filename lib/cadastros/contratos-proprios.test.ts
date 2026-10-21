import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hojeBRT,
  labelTipo,
  MSG_FIM_ANTES_INICIO,
  situacaoVigencia,
  totaisPorTipo,
  validarContrato,
} from "./contratos-proprios";

const base = { nome: "", fornecedor: "SIEMENS", equipamento: "TOMOGRAFO", tipo: "MANUTENCAO", valorMensal: 100, inicio: "2026-01-01", fim: "2027-01-01" };

test("válido gera nome equipamento – fornecedor", () => {
  const v = validarContrato(base);
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.data.nome, "TOMOGRAFO – SIEMENS");
    assert.equal(v.data.tipo, "MANUTENCAO");
  }
});

test("rejeita valor vazio, zero, negativo e texto", () => {
  for (const valorMensal of ["", null, 0, -1, "abc"] as unknown as number[]) {
    const v = validarContrato({ ...base, valorMensal });
    assert.equal(v.ok, false, String(valorMensal));
    if (!v.ok) assert.ok(v.erros.valorMensal);
  }
});

test("aceita valor pt-BR 1.234,56", () => {
  const v = validarContrato({ ...base, valorMensal: "1.234,56" as unknown as number });
  assert.ok(v.ok && v.data.valorMensal === 1234.56);
});

test("rejeita tipo inválido ou vazio (D3: obrigatório ao criar/editar)", () => {
  for (const tipo of ["", null, "SERVICO", "outro"]) {
    const v = validarContrato({ ...base, tipo });
    assert.equal(v.ok, false);
    if (!v.ok) assert.ok(v.erros.tipo);
  }
  assert.ok(validarContrato({ ...base, tipo: "Locação" }).ok);
});

test("rejeita fornecedor vazio e início vazio/inválido", () => {
  const a = validarContrato({ ...base, fornecedor: " " });
  assert.ok(!a.ok && a.erros.fornecedor);
  const b = validarContrato({ ...base, inicio: "" });
  assert.ok(!b.ok && b.erros.inicio);
  const c = validarContrato({ ...base, inicio: "2026-02-30" });
  assert.ok(!c.ok && c.erros.inicio);
});

test("fim antes do início bloqueia; fim = início permitido", () => {
  const v = validarContrato({ ...base, inicio: "2026-05-02", fim: "2026-05-01" });
  assert.ok(!v.ok && v.erros.fim === MSG_FIM_ANTES_INICIO);
  assert.ok(validarContrato({ ...base, inicio: "2026-05-02", fim: "2026-05-02" }).ok);
});

test("vigência: fim inclusivo em BRT", () => {
  const c = { inicio: "2026-01-01", fim: "2027-01-01" };
  assert.equal(situacaoVigencia(c, "2027-01-01"), "Vigente");
  assert.equal(situacaoVigencia(c, "2027-01-02"), "Vencido");
  assert.equal(situacaoVigencia(c, "2025-12-31"), "A iniciar");
  // 02/01/2027 01:00 UTC ainda é 01/01/2027 22:00 em BRT → Vigente
  assert.equal(hojeBRT(new Date("2027-01-02T01:00:00Z")), "2027-01-01");
  assert.equal(situacaoVigencia(c, hojeBRT(new Date("2027-01-02T01:00:00Z"))), "Vigente");
  assert.equal(situacaoVigencia(c, hojeBRT(new Date("2027-01-02T03:00:00Z"))), "Vencido");
});

test("sem tipo aparece como 'Sem tipo' e totais separam Locação", () => {
  assert.equal(labelTipo(null), "Sem tipo");
  assert.equal(labelTipo("LOCACAO"), "Locação");
  const t = totaisPorTipo([
    { id: "1", nome: "a", valorMensal: 10.1, ativo: true, tipo: "MANUTENCAO" },
    { id: "2", nome: "b", valorMensal: 20.2, ativo: true, tipo: "LOCACAO" },
    { id: "3", nome: "c", valorMensal: 1, ativo: true, tipo: null },
  ]);
  assert.equal(t.LOCACAO.valor, 20.2);
  assert.equal(t.SEM_TIPO.qtde, 1);
  assert.equal(t.TOTAL.valor, 31.3);
});

test("A2: valor 0, -1 e vazio (string do formulário) rejeitados como na API", () => {
  for (const valorMensal of ["0", "-1", "", "  ", "0,00", "-1,50"]) {
    const v = validarContrato({ ...base, valorMensal: valorMensal as unknown as number });
    assert.ok(!v.ok && v.erros.valorMensal, JSON.stringify(valorMensal));
  }
  assert.ok(validarContrato({ ...base, valorMensal: "0,01" as unknown as number }).ok);
});
