import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contratoContaNoIndicador,
  contratoSuspensoNoMes,
  diaAnterior,
  diaSeguinte,
  MSG_RETORNO_ANTES,
  rotuloSuspensao,
  validarSuspensao,
} from "./contratos-proprios";
import { buildCustoParqueAno } from "@/lib/pbi/custo-manutencao-parque";
import { apiSuportaCorrecao, listarMeses, planejar, totaisMensais, validarEntrada, type Entrada } from "./correcao-contratos";
import type { Contrato } from "./types";

// Valores e nomes fictícios (repo público).
const c = (id: string, valorMensal: number, extra: Partial<Contrato> = {}): Contrato => ({
  id, nome: `EQ${id} – F${id}`, fornecedor: `F${id}`, equipamento: `EQ${id}`, valorMensal,
  inicio: "2026-01-01", fim: null, ativo: true, tipo: "MANUTENCAO", inativadoEm: null, suspensoDe: null, suspensoAte: null, ...extra,
});
const base = () => [c("a", 100), c("b", 200), c("c", 300), c("d", 400), c("l", 999, { tipo: "LOCACAO" })];
const meses = { de: "2026-01", ate: "2027-12" };

test("suspensão: mês inteiro coberto sai; parcial conta; volta depois do fim", () => {
  const s = c("s", 10, { suspensoDe: "2026-07-01", suspensoAte: "2027-06-30" });
  assert.equal(contratoContaNoIndicador(s, 2026, 5), true); // jun/26
  assert.equal(contratoContaNoIndicador(s, 2026, 6), false); // jul/26
  assert.equal(contratoContaNoIndicador(s, 2027, 5), false); // jun/27
  assert.equal(contratoContaNoIndicador(s, 2027, 6), true); // jul/27
  const parcial = c("p", 10, { suspensoDe: "2026-07-15", suspensoAte: "2026-08-10" });
  assert.equal(contratoContaNoIndicador(parcial, 2026, 6), true);
  assert.equal(contratoContaNoIndicador(parcial, 2026, 7), true);
  const ago = c("q", 10, { suspensoDe: "2026-08-01", suspensoAte: "2026-08-31" });
  assert.equal(contratoContaNoIndicador(ago, 2026, 7), false);
});

test("suspensão considera vigência: mês com fim no meio e suspensão cobrindo o resto sai", () => {
  const x = c("x", 10, { fim: "2026-09-10", suspensoDe: "2026-09-01", suspensoAte: "2026-12-31" });
  assert.equal(contratoContaNoIndicador(x, 2026, 8), false);
});

test("sem suspensão a regra antiga não muda (inativado conta até o mês de inativado_em; sem data nunca)", () => {
  assert.equal(contratoContaNoIndicador(c("i", 10, { ativo: false, inativadoEm: "2026-03-31T23:59:59-03:00" }), 2026, 2), true);
  assert.equal(contratoContaNoIndicador(c("i", 10, { ativo: false, inativadoEm: "2026-03-31T23:59:59-03:00" }), 2026, 3), false);
  assert.equal(contratoContaNoIndicador(c("i", 10, { ativo: false, inativadoEm: null }), 2026, 0), false);
});

test("validarSuspensao e utilitários", () => {
  assert.deepEqual(validarSuspensao(null, null), { ok: true, de: null, ate: null });
  assert.equal(validarSuspensao("2026-07-01", "2026-06-30").ok, false);
  assert.equal(validarSuspensao("2026-07-01", null).ok, false);
  assert.equal(validarSuspensao("2026-02-30", "2026-03-01").ok, false);
  assert.equal(diaAnterior("2026-01-01"), "2025-12-31");
  assert.equal(diaAnterior("2026-03-01"), "2026-02-28");
  assert.equal(rotuloSuspensao({ suspensoDe: "2026-07-01", suspensoAte: "2027-06-30" }, "2026-10-22"), "Suspenso até jul/27");
  assert.equal(rotuloSuspensao({ suspensoDe: "2026-07-01", suspensoAte: "2027-06-30" }, "2027-07-01"), null);
  assert.equal(listarMeses("2026-11", "2027-02").map((m) => m.chave).join(","), "2026-11,2026-12,2027-01,2027-02");
});

test("validarEntrada recusa placeholders, op desconhecida e meses inválidos", () => {
  const r = validarEntrada({
    meses: { de: "2026-13", ate: "2026-01" },
    operacoes: [
      { op: "inativar", id: "<ID_X>", desde: "<PENDENTE>" },
      { op: "criar", contrato: { fornecedor: "F", tipo: "MANUTENCAO", valorMensal: 1, inicio: "PENDENTE" } },
      { op: "apagar", id: "a" },
    ],
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.erros.length, 4);
    assert.ok(r.erros.some((e) => e.includes("id, desde")));
    assert.ok(r.erros.some((e) => e.includes("contrato.inicio")));
    assert.ok(r.erros.some((e) => e.includes("desconhecida")));
  }
});

test("planejar: descrição, troca, inativar desde início / desde mês, suspender, criar → totais", () => {
  const entrada: Entrada = {
    meses,
    operacoes: [
      { op: "descricao", id: "a", equipamento: "NOVO", conferir: { valorMensal: 100 } },
      { op: "descricao", id: "b", equipamento: "EQc" },
      { op: "descricao", id: "c", equipamento: "EQb" },
      { op: "inativar", id: "d", desde: "inicio" },
      { op: "inativar", id: "c", desde: "2026-04-01" },
      { op: "suspender", id: "b", de: "2026-07-01", ate: "2027-06-30" },
      { op: "criar", contrato: { nome: "", fornecedor: "FN", equipamento: "EQN", tipo: "MANUTENCAO", valorMensal: 50, inicio: "2026-05-01" } },
    ],
  };
  const v = validarEntrada(entrada);
  assert.ok(v.ok);
  const p = planejar(base(), entrada);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.passos.length, 7);
  assert.equal(p.passos[0].depois.nome, "NOVO – Fa");
  assert.deepEqual(p.passos[3].chamada.body, { ativo: false, contaAte: null });
  assert.deepEqual(p.passos[4].chamada.body, { ativo: false, contaAte: "2026-03-31" });
  assert.deepEqual(p.passos[5].chamada.body, { suspensoDe: "2026-07-01", suspensoAte: "2027-06-30" });
  assert.equal(p.passos[6].chamada.metodo, "POST");
  const t = Object.fromEntries(totaisMensais(p.final, meses.de, meses.ate).map((x) => [x.mes, x.valor]));
  assert.equal(t["2026-01"], 600); // a+b+c (d fora desde o início; locação nunca)
  assert.equal(t["2026-04"], 300); // c saiu em abril
  assert.equal(t["2026-05"], 350); // + novo
  assert.equal(t["2026-07"], 150); // b suspenso
  assert.equal(t["2027-07"], 350); // b volta
  const antes = Object.fromEntries(totaisMensais(base(), meses.de, meses.ate).map((x) => [x.mes, x.valor]));
  assert.equal(antes["2026-05"], 1000);
});

test("planejar recusa id inexistente e conferência divergente (nada é aplicado)", () => {
  const p = planejar(base(), { meses, operacoes: [{ op: "inativar", id: "zz", desde: "inicio" }, { op: "descricao", id: "a", equipamento: "X", conferir: { valorMensal: 101 } }] });
  assert.equal(p.ok, false);
  if (!p.ok) assert.equal(p.erros.length, 2);
});

test("A7/A2: suspenso no mês, validação de datas e retorno", () => {
  const g = c("g", 10, { suspensoDe: "2026-07-01", suspensoAte: "2027-06-30" });
  assert.equal(contratoSuspensoNoMes(g, 2026, 6), true);
  assert.equal(contratoSuspensoNoMes(g, 2026, 5), false);
  assert.equal(contratoSuspensoNoMes(g, 2027, 6), false);
  assert.equal(contratoSuspensoNoMes(c("l", 1, { tipo: "LOCACAO", suspensoDe: "2026-07-01", suspensoAte: "2027-06-30" }), 2026, 6), false);
  assert.equal(validarSuspensao("2026-07-01", "2026-06-30").ok, false);
  const r = validarSuspensao("2026-07-01", "2026-06-30");
  assert.equal(r.ok ? "" : r.erro, MSG_RETORNO_ANTES);
  assert.equal(diaSeguinte("2027-06-30"), "2027-07-01");
});

test("S1/A2/A3: indicador separa suspensos (fora do custo) e volta no retorno", () => {
  const contratos = [c("a", 100), c("g", 40, { suspensoDe: "2026-07-01", suspensoAte: "2027-06-30" })];
  const meses26 = Array.from({ length: 12 }, (_, m) => ({ year: 2026, month: m, key: `2026-${m}`, label: `m${m}` }));
  const ano = buildCustoParqueAno({ year: 2026, months: meses26, contratos, gastoMonths: [], valorParque: 1000, avulsosDisponiveis: true });
  assert.equal(ano.months[5].contratos, 140);
  assert.equal(ano.months[5].suspensosNoMes.length, 0);
  assert.equal(ano.months[6].contratos, 100);
  assert.equal(ano.months[6].suspensosNoMes.length, 1);
  assert.equal(ano.months[6].suspensosValor, 40);
  const meses27 = Array.from({ length: 12 }, (_, m) => ({ year: 2027, month: m, key: `2027-${m}`, label: `m${m}` }));
  const a27 = buildCustoParqueAno({ year: 2027, months: meses27, contratos, gastoMonths: [], valorParque: 1000, avulsosDisponiveis: true });
  assert.equal(a27.months[5].contratos, 100);
  assert.equal(a27.months[6].contratos, 140);
  assert.equal(a27.months[6].suspensosNoMes.length, 0);
});

test("A9: --apply recusa API sem os campos da 013", () => {
  const antigos = base().map(({ suspensoDe: _a, suspensoAte: _b, ...r }) => (void _a, void _b, r as Contrato));
  assert.equal(apiSuportaCorrecao(antigos), false);
  assert.equal(apiSuportaCorrecao([]), false);
  assert.equal(apiSuportaCorrecao(base()), true);
});

test("planejar: criar ignora duplicado com aviso (reexecução após apply)", () => {
  const criar = { op: "criar" as const, contrato: { nome: "", fornecedor: "Fornecedor Novo", equipamento: "EQN", tipo: "MANUTENCAO" as const, valorMensal: 50, inicio: "2026-01-01" } };
  const jaAplicado = [c("a", 100), c("n", 50, { fornecedor: "FORNECEDOR  NOVO" })];
  const r = planejar(jaAplicado, { meses, operacoes: [criar] });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.passos.length, 0);
    assert.equal(r.final.length, 2);
    assert.match(r.avisos[0], /já existe contrato n/);
  }
  const v = planejar([c("n", 51, { fornecedor: "Fornecedor Novo" })], { meses, operacoes: [criar] });
  assert.ok(v.ok && v.passos.length === 1);
  const d = planejar([c("n", 50, { fornecedor: "Fornecedor Novo", inicio: "2026-02-01" })], { meses, operacoes: [criar] });
  assert.ok(d.ok && d.passos.length === 1);
  const dois = planejar([], { meses, operacoes: [criar, criar] });
  assert.ok(dois.ok && dois.passos.length === 1 && dois.avisos.length === 1);
});

test("conferir fornecedor: igualdade sem caixa/acento, nunca substring nem prefixo", () => {
  const op = (f: string) => ({ meses, operacoes: [{ op: "descricao" as const, id: "x", equipamento: "Z", conferir: { fornecedor: f } }] });
  assert.equal(planejar([c("x", 1, { fornecedor: "ENGENHARIA XYZ" })], op("GE")).ok, false);
  assert.equal(planejar([c("x", 1, { fornecedor: "GE HEALTHCARE" })], op("GE")).ok, false);
  assert.equal(planejar([c("x", 1, { fornecedor: "Gê Healthcare" })], op("ge healthcare")).ok, true);
});

test("validarSuspensao normaliza para mês inteiro", () => {
  assert.deepEqual(validarSuspensao("2026-07-15", "2027-06-10"), { ok: true, de: "2026-07-01", ate: "2027-06-30" });
  assert.deepEqual(validarSuspensao("2026-02-10", "2026-02-20"), { ok: true, de: "2026-02-01", ate: "2026-02-28" });
  assert.deepEqual(validarSuspensao("2028-02-03", "2028-02-04"), { ok: true, de: "2028-02-01", ate: "2028-02-29" });
  const s = validarSuspensao("2026-07-15", "2026-07-20");
  assert.ok(s.ok);
  if (s.ok) {
    const k = c("k", 10, { suspensoDe: s.de, suspensoAte: s.ate });
    assert.equal(contratoContaNoIndicador(k, 2026, 6), false); // jul/26
    assert.equal(contratoSuspensoNoMes(k, 2026, 6), true);
    assert.equal(contratoContaNoIndicador(k, 2026, 7), true); // ago/26
  }
});

test("planejar: dry-run simula suspensão pelo mês inteiro, igual à API", () => {
  const r = planejar([c("s", 100)], { meses, operacoes: [{ op: "suspender", id: "s", de: "2026-07-15", ate: "2026-07-20" }] });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.passos[0].depois.suspensoDe, "2026-07-01");
    assert.equal(r.passos[0].depois.suspensoAte, "2026-07-31");
    assert.equal(contratoContaNoIndicador(r.final[0], 2026, 6), false); // jul/26 sai no dry-run
  }
});
