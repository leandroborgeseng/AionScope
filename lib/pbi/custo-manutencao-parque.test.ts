import assert from "node:assert/strict";
import { test } from "node:test";
import type { Contrato } from "@/lib/cadastros/types";
import {
  contratoContaNoIndicador,
  rotuloInativado,
  textoConfirmarInativar,
  textoConfirmarReativar,
} from "@/lib/cadastros/contratos-proprios";
import type { GastoReparoMonth } from "@/lib/pbi/gasto-reparo";
import { buildCustoParqueAno, formatPctParque } from "@/lib/pbi/custo-manutencao-parque";
import { currentCalendarYearRange } from "@/lib/pbi/volume-ec";

function ct(p: Partial<Contrato> & { id: string }): Contrato {
  return { nome: p.id, valorMensal: 0, ativo: true, tipo: "MANUTENCAO", inicio: "2026-01-01", fim: null, ...p };
}

function gasto(year: number, valores: Record<number, number>): GastoReparoMonth[] {
  return Object.entries(valores).map(([m, v]) => ({
    year,
    month: Number(m),
    key: `${year}-${String(Number(m) + 1).padStart(2, "0")}`,
    label: m,
    gasto: v,
    gastoCorretiva: v,
    gastoOutro: 0,
    osCount: 1,
    osComCusto: 1,
    osCustoZero: 0,
  }));
}

// Exemplo de referência do aceite (C16): só números, sem fornecedores.
const A = ct({ id: "A", valorMensal: 1000, inicio: "2026-01-15", fim: "2026-03-31" });
const C = ct({ id: "C", valorMensal: 200, inicio: "2026-01-01", fim: "2026-12-31", ativo: false, inativadoEm: "2026-02-10T09:00:00-03:00" });
const OS_2026 = gasto(2026, { 0: 3000, 2: 3000, 3: 500 });

function ano(year: number, extra: Partial<Parameters<typeof buildCustoParqueAno>[0]> = {}) {
  const r = currentCalendarYearRange(new Date(year, 5, 1));
  return buildCustoParqueAno({
    year,
    months: r.months,
    contratos: [A, C],
    gastoMonths: OS_2026,
    valorParque: 1_000_000,
    avulsosDisponiveis: true,
    ...extra,
  });
}

test("C16 exemplo de referência jan–mai/2026", () => {
  const m = ano(2026).months;
  const esperado = [
    [1200, 3000, 4200, 4200, "0,42%", "Acima"],
    [1200, 0, 1200, 5400, "0,54%", "Dentro"],
    [1000, 3000, 4000, 9400, "0,94%", "Dentro"],
    [0, 500, 500, 9900, "0,99%", "Dentro"],
    [0, 0, 0, 9900, "0,99%", "Dentro"],
  ] as const;
  esperado.forEach(([contratos, avulsos, despesa, acum, pct, status], i) => {
    assert.equal(m[i].contratos, contratos, `contratos ${i}`);
    assert.equal(m[i].avulsos, avulsos);
    assert.equal(m[i].despesa, despesa);
    assert.equal(m[i].acumulado, acum);
    assert.equal(formatPctParque(m[i].pctAcumulado), pct);
    assert.equal(m[i].status, status);
  });
  assert.equal(formatPctParque(m[0].metaPct), "0,33%");
  assert.equal(formatPctParque(m[3].metaPct), "1,33%");
});

test("C8 virada do ano: jan/2027 zera (A e C fora, 0 OS)", () => {
  const jan = ano(2027).months[0];
  assert.equal(jan.acumulado, 0);
  assert.equal(formatPctParque(jan.pctAcumulado), "0,00%");
  assert.equal(jan.status, "Dentro");
});

test("C11 parque 0/ausente ou avulsos indisponíveis: sem % nem status", () => {
  for (const extra of [{ valorParque: 0 }, { valorParque: null }, { avulsosDisponiveis: false }]) {
    const r = ano(2026, extra);
    assert.ok(r.faltando.length > 0);
    assert.ok(r.months.every((m) => m.pctAcumulado === null && m.status === null));
    assert.equal(formatPctParque(r.months[0].pctAcumulado), "—");
  }
  assert.deepEqual(ano(2026, { valorParque: 0 }).faltando, ["valor do parque indisponível"]);
  assert.deepEqual(ano(2026, { avulsosDisponiveis: false }).faltando, ["custos avulsos indisponíveis"]);
});

test("C2 Locação e sem tipo nunca somam", () => {
  const L = ct({ id: "L", valorMensal: 500, tipo: "LOCACAO" });
  const S = ct({ id: "S", valorMensal: 700, tipo: null });
  for (let m = 0; m < 12; m++) {
    assert.equal(contratoContaNoIndicador(L, 2026, m), false);
    assert.equal(contratoContaNoIndicador(S, 2026, m), false);
  }
  const r = ano(2026, { contratos: [A, C, L, S] });
  assert.equal(r.months[0].contratos, 1200);
});

test("C1/C3 mês inteiro com ≥1 dia de vigência; fim inclusivo; fora da vigência não soma", () => {
  const X = ct({ id: "X", valorMensal: 100, inicio: "2026-03-31", fim: "2026-05-01" });
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((m) => contratoContaNoIndicador(X, 2026, m)),
    [false, true, true, true, false],
  );
});

test("C4 inativado em 10/03 soma jan–mar e não soma de abr em diante", () => {
  const I = ct({ id: "I", valorMensal: 100, inicio: "2026-01-01", fim: "2026-12-31", ativo: false, inativadoEm: "2026-03-10T14:00:00-03:00" });
  assert.deepEqual(
    Array.from({ length: 12 }, (_, m) => contratoContaNoIndicador(I, 2026, m)),
    [true, true, true, false, false, false, false, false, false, false, false, false],
  );
});

test("C5 inativo sem data não conta; reativado (data nula, ativo) conta em toda a vigência", () => {
  const semData = ct({ id: "N", valorMensal: 100, ativo: false, inativadoEm: null });
  const reativado = ct({ id: "R", valorMensal: 100, ativo: true, inativadoEm: null, fim: "2026-12-31" });
  for (let m = 0; m < 12; m++) {
    assert.equal(contratoContaNoIndicador(semData, 2026, m), false);
    assert.equal(contratoContaNoIndicador(reativado, 2026, m), true);
  }
});

test("C12 cadastro sem Manutenção: calcula só com avulsos e sinaliza", () => {
  const r = ano(2026, { contratos: [] });
  assert.equal(r.semContratos, true);
  assert.equal(r.months[0].despesa, 3000);
});

test("C14 drill: soma dos contratos listados = contratos do mês", () => {
  for (const m of ano(2026).months) {
    assert.equal(m.contratosNoMes.reduce((s, c) => s + c.valorMensal, 0), m.contratos);
  }
});

test("meses futuros: só meta, sem status", () => {
  const r = ano(2026, { mesAtual: 9 });
  assert.equal(r.atual?.month, 9);
  assert.equal(r.months[10].futuro, true);
  assert.equal(r.months[10].status, null);
  assert.equal(formatPctParque(r.atual!.metaPct), "3,33%");
});

test("textos do cadastro (esboço UX §5)", () => {
  const c = { nome: "n", fornecedor: "F", equipamento: "E" };
  assert.equal(
    textoConfirmarInativar(c, new Date("2026-10-20T23:00:00-03:00")),
    "Inativar F – E? Ele deixa de contar no indicador a partir do mês seguinte. Os meses até outubro/2026 continuam no acumulado.",
  );
  // 31/10 23h30 BRT já é novembro em UTC; vale o mês BRT
  assert.match(textoConfirmarInativar(c, new Date("2026-10-31T23:30:00-03:00")), /outubro\/2026/);
  assert.equal(textoConfirmarReativar(c), "Reativar F – E? Ele volta a contar em toda a vigência.");
  assert.equal(rotuloInativado({ ativo: false, inativadoEm: "2026-03-10T14:00:00-03:00" }), "Inativado em 10/03/2026");
  assert.equal(rotuloInativado({ ativo: false, inativadoEm: null }), "Inativado (sem data)");
  assert.equal(rotuloInativado({ ativo: true, inativadoEm: null }), null);
});

test("serieGraficoParque: sem dados não desenha barras nem acumulado, mantém a meta", async () => {
  const { serieGraficoParque, metaProporcionalPct } = await import("@/lib/pbi/custo-manutencao-parque");
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: String(i), month: i, contratos: 1000, avulsos: 500, despesa: 1500, acumulado: 1500 * (i + 1),
    pctAcumulado: 0.1 * (i + 1), metaPct: metaProporcionalPct(i), status: "Dentro", futuro: i > 9,
  })) as unknown as Parameters<typeof serieGraficoParque>[0];
  const erro = serieGraficoParque(months, true);
  assert.ok(erro.every((r) => r.contratos === null && r.avulsos === null && r.pct === null));
  assert.deepEqual(erro.map((r) => r.meta), months.map((m) => m.metaPct));
  const ok = serieGraficoParque(months, false);
  assert.equal(ok[0].contratos, 1000);
  assert.equal(ok[9].avulsos, 500);
  assert.equal(ok[10].contratos, null);
  assert.equal(ok[0].pct, 0.1);
});

import { valorParqueDoMes } from "@/lib/pbi/parque-frescor";
test("parque-auto: modo único (padrão) x mensal no cálculo", () => {
  const fotos = [{ competencia: "2026-03", valor: 2_000_000 }];
  const unico = ano(2026).months;
  const mensal = ano(2026, { valorParqueDoMes: (c) => valorParqueDoMes("mensal", 1_000_000, fotos, c) }).months;
  const viaFlagUnico = ano(2026, { valorParqueDoMes: (c) => valorParqueDoMes("unico", 1_000_000, fotos, c) }).months;
  assert.deepEqual(viaFlagUnico.map((m) => m.pctAcumulado), unico.map((m) => m.pctAcumulado));
  assert.equal(mensal[0].pctAcumulado, unico[0].pctAcumulado); // jan: sem foto => valor único
  assert.equal(mensal[2].pctAcumulado, unico[2].pctAcumulado! / 2); // mar: foto de 2 mi
  assert.equal(mensal[4].pctAcumulado, unico[4].pctAcumulado! / 2); // mai: herda a foto de mar
});
