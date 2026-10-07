import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { describe, it } from "node:test";
import { calcularPainel, chavePessoa, faixaReciclagem } from "./calcular";
import type { ParticipanteTreinamento } from "./types";

const DATA = path.join(process.cwd(), "data", "treinamentos");

function carregar(): ParticipanteTreinamento[] {
  return JSON.parse(readFileSync(path.join(DATA, "treinamentos.json"), "utf8")) as ParticipanteTreinamento[];
}

describe("calcularPainel — bombas B. Braun", () => {
  it("bate os KPIs de referência (434 / 294 / 47,7%)", () => {
    const painel = calcularPainel(carregar(), { atualizadoEm: "2026-10-06" });
    const a25 = painel.anos.find((a) => a.ano === 2025);
    const a26 = painel.anos.find((a) => a.ano === 2026);

    assert.equal(a25?.treinados, 434);
    assert.equal(a26?.treinados, 294);
    assert.equal(painel.variacao_treinados_pct, -32.3);
    assert.equal(painel.reciclados_atual, 207);
    assert.equal(painel.taxa_reciclagem_geral_pct, 47.7);
    assert.equal(painel.aptos_sem_reforco, 227);
    assert.equal(painel.novos_atual, 87);
    assert.equal(
      painel.setores.reduce((soma, s) => soma + s.novos_atual, 0),
      87,
    );
    assert.equal(a25?.horas_homem, 181);
    assert.equal(a26?.horas_homem, 147);
  });

  it("bate resumo_setores.json setor a setor", () => {
    const painel = calcularPainel(carregar());
    const ref = JSON.parse(readFileSync(path.join(DATA, "resumo_setores.json"), "utf8")) as Array<{
      setor: string;
      treinados_2025: number;
      reciclados_2026: number;
      taxa_reciclagem_pct: number;
      faixa: string;
    }>;

    assert.equal(painel.setores.length, ref.length);
    for (const esperado of ref) {
      const got = painel.setores.find((s) => s.setor === esperado.setor);
      assert.ok(got, `faltou setor ${esperado.setor}`);
      assert.equal(got.treinados_anterior, esperado.treinados_2025, esperado.setor);
      assert.equal(got.reciclados_atual, esperado.reciclados_2026, esperado.setor);
      assert.equal(got.taxa_reciclagem_pct, esperado.taxa_reciclagem_pct, esperado.setor);
      assert.equal(got.faixa, esperado.faixa, esperado.setor);
    }
  });

  it("desambigua matrícula repetida com nomes diferentes", () => {
    const lista = carregar().filter((p) => p.ano === 2025 && p.matricula === "21128852");
    assert.equal(lista.length, 2);
    const chaves = new Set(lista.map(chavePessoa));
    assert.equal(chaves.size, 2);
  });

  it("classifica faixas de reciclagem", () => {
    assert.equal(faixaReciclagem(60), "ok");
    assert.equal(faixaReciclagem(59.9), "atencao");
    assert.equal(faixaReciclagem(40), "atencao");
    assert.equal(faixaReciclagem(39.9), "critico");
  });
});
