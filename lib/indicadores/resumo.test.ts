import assert from "node:assert/strict";
import { test } from "node:test";
import { INDICADORES_SALA, indicadoresNaSala } from "@/lib/indicadores/catalog";
import { custoParqueDemo, clonesDemo } from "@/lib/indicadores/fixture-sala-indicadores";
import {
  ariaLabelCard,
  estadoCard,
  estadoCustoParque,
  gradeIndicadores,
  horaLeitura,
  ordenarCards,
  paginar,
  resumoCustoParque,
  rotuloStatusCard,
} from "@/lib/indicadores/resumo";
import { formatPctParque, rotuloStatus } from "@/lib/pbi/custo-manutencao-parque";
import { formatBRL } from "@/lib/pbi/indicators";

test("I2/I3: card e página saem do mesmo estado (mesma fixture)", () => {
  const ind = custoParqueDemo();
  const pagina = estadoCustoParque(ind); // o que a página /indicadores/custo-manutencao-parque mostra
  const card = resumoCustoParque(ind);
  assert.equal(card.valorPrincipal, formatPctParque(pagina.pctAtual));
  assert.equal(card.valorPrincipalNum, pagina.pctAtual);
  assert.equal(rotuloStatus(pagina.statusAtual), "Dentro da meta");
  assert.equal(card.status, "dentro");
  // fixture: out/26 → 10×100 mil + 300 mil avulsos = 1,3 mi / 50 mi = 2,60% ≤ 3,33%
  assert.equal(card.valorPrincipal, "2,60%");
  assert.match(card.meta ?? "", /Meta até out: 3,33% · Teto anual: 4,00%/);
});

test("I10: valor do mês e cada ponto do gráfico = página", () => {
  const ind = custoParqueDemo();
  const card = resumoCustoParque(ind);
  assert.equal(card.serieMensal.length, 12);
  ind.months.forEach((m, i) => {
    assert.equal(card.serieMensal[i].valor, m.futuro ? null : m.pctAcumulado, `mês ${i}`);
    assert.equal(card.serieMensal[i].meta, m.metaPct);
    assert.equal(card.serieMensal[i].futuro, m.futuro);
  });
  assert.equal(card.valorMes, `out: ${formatBRL(ind.atual!.despesa)} no mês`);
  assert.equal(card.valorSecundario, `${formatBRL(1_300_000)} acumulado até outubro`);
});

test("I2: acima da meta usa a mesma faixa da página", () => {
  const ind = custoParqueDemo({ valorParque: 20_000_000 });
  const pagina = estadoCustoParque(ind);
  const card = resumoCustoParque(ind);
  assert.equal(pagina.statusAtual, "Acima");
  assert.equal(card.status, "acima");
  assert.equal(rotuloStatusCard(card.status), "▲ Acima da meta");
});

test("I14: sem dados mostra — e Sem dados, nunca 0%", () => {
  const card = resumoCustoParque(custoParqueDemo({ valorParque: null }));
  assert.equal(card.valorPrincipal, "—");
  assert.equal(card.status, "sem-dados");
  assert.equal(rotuloStatusCard(card.status), "Sem dados");
  assert.equal(card.motivoSemDados, "Valor do parque indisponível");
  assert.ok(card.serieMensal.every((p) => p.valor == null));
  assert.equal(card.valorSecundario, null);
  assert.ok(!JSON.stringify(card).includes("0,00%"));
  // faltando extra (cadastro de contratos fora) também zera o card como na página
  const c2 = resumoCustoParque(custoParqueDemo(), ["cadastro de contratos indisponível"]);
  assert.equal(c2.status, "sem-dados");
  assert.match(c2.motivoSemDados ?? "", /cadastro de contratos indisponível/);
});

test("I12: status sempre com ícone e texto", () => {
  assert.equal(rotuloStatusCard("dentro"), "✓ Dentro da meta");
  assert.equal(rotuloStatusCard("acima"), "▲ Acima da meta");
  assert.match(ariaLabelCard(resumoCustoParque(custoParqueDemo())), /^Custo de manutenção do parque: 2,60%, dentro da meta\. Abrir detalhe$/);
});

test("I4: href do card leva ao indicador com o mesmo período", () => {
  assert.equal(resumoCustoParque(custoParqueDemo()).href, "/indicadores/custo-manutencao-parque?ano=2026");
});

test("I5/I11: registro com chave de exibição; começa só com custo", () => {
  assert.deepEqual(indicadoresNaSala().map((d) => d.id), ["custo-manutencao-parque"]);
  const lista = [...INDICADORES_SALA, { id: "x", titulo: "X", href: "/indicadores/x", sala: false }];
  assert.deepEqual(indicadoresNaSala(lista).map((d) => d.id), ["custo-manutencao-parque"]);
  assert.deepEqual(indicadoresNaSala(lista.map((d) => ({ ...d, sala: true }))).map((d) => d.id), ["custo-manutencao-parque", "x"]);
});

test("I13: grade 1 / 2×2 / 3×2 / paginação acima de 6", () => {
  assert.deepEqual(gradeIndicadores(1), { colunas: 1, linhas: 1, porPagina: 1, paginas: 1, ampliado: true });
  for (const n of [2, 3, 4]) assert.equal(gradeIndicadores(n).colunas, 2);
  for (const n of [5, 6]) assert.deepEqual([gradeIndicadores(n).colunas, gradeIndicadores(n).linhas, gradeIndicadores(n).paginas], [3, 2, 1]);
  assert.equal(gradeIndicadores(7).paginas, 2);
  assert.equal(gradeIndicadores(13).paginas, 3);
  const sete = clonesDemo(resumoCustoParque(custoParqueDemo()), 7);
  assert.equal(paginar(sete, 0, 6).length, 6);
  assert.equal(paginar(sete, 1, 6).length, 1);
});

test("UX §2: acima da meta primeiro, ordem estável do catálogo", () => {
  const r = ordenarCards([
    { id: "a", status: "dentro" as const },
    { id: "b", status: "acima" as const },
    { id: "c", status: "sem-dados" as const },
    { id: "d", status: "acima" as const },
  ]);
  assert.deepEqual(r.map((x) => x.id), ["b", "d", "a", "c"]);
});

test("I6/I14: erro mantém o último valor + horário; erro sem histórico não inventa número", () => {
  const ok = resumoCustoParque(custoParqueDemo());
  const em = Date.UTC(2026, 9, 23, 11, 40);
  const e = estadoCard({ carregando: false, erro: "falhou", resumo: null, ultimo: { resumo: ok, em } });
  assert.equal(e.tipo, "erro");
  assert.equal(e.tipo === "erro" && e.ultimo?.valorPrincipal, "2,60%");
  assert.equal(horaLeitura(em), "08:40");
  const semHist = estadoCard({ carregando: false, erro: "falhou", resumo: null, ultimo: null });
  assert.equal(semHist.tipo === "erro" && semHist.ultimo, null);
  assert.equal(estadoCard({ carregando: true, erro: null, resumo: null, ultimo: null }).tipo, "carregando");
  assert.equal(estadoCard({ carregando: false, erro: null, resumo: ok, ultimo: null }).tipo, "ok");
});

test("I9: fixture só com dados DEMO", () => {
  const ind = custoParqueDemo();
  for (const m of ind.months) for (const c of m.contratosNoMes) assert.match(c.nome, /^Contrato DEMO /);
  assert.equal(ind.valorParque, 50_000_000);
});

import { contemValorMonetario, resumoCustoParquePublico } from "@/lib/indicadores/resumo";

test("D1: resumo público (Sala/TV sem login) = mesmos %/status da página, sem nenhum R$", () => {
  const ind = custoParqueDemo();
  const pagina = resumoCustoParque(ind);
  const pub = resumoCustoParquePublico(ind);
  assert.equal(pub.valorPrincipal, pagina.valorPrincipal);
  assert.equal(pub.status, pagina.status);
  assert.deepEqual(pub.serieMensal, pagina.serieMensal);
  assert.equal(pub.meta, pagina.meta);
  assert.equal(pub.valorSecundario, null);
  assert.equal(contemValorMonetario(pub), false);
  assert.equal(contemValorMonetario(pagina), true, "a página logada mostra R$");
  // out/26 fictício: 100 mil + 25 mil no mês / 50 mi = 0,25%
  assert.equal(pub.valorMes, "out: +0,25% no mês");
  assert.equal(contemValorMonetario(resumoCustoParquePublico(custoParqueDemo({ valorParque: null }))), false);
});
