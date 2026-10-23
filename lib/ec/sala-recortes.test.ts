import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { closeDbForTests } from "../db/client";
import { agoraFixtureSala, dadosFixtureSala, OS_FALHA_API_DEMO } from "./fixture-sala-drilldown";
import { montarSnapshotDeDados, montarVistasSala } from "./montar-snapshot";
import { resolverRecorte, slugRecorte } from "./sala-recortes";
import { buscarDetalheOsApi, comTimeout, recorteDeDados, TempoEsgotadoError } from "./sala-recorte-servico";
import { TELAS_SALA, type SalaSnapshot } from "./snapshot-tipos";

const dir = path.join(os.tmpdir(), `aion-recortes-${process.pid}-${Date.now()}`);
let snap: SalaSnapshot;
const dados = dadosFixtureSala();
const agora = agoraFixtureSala();
const CANCELADAS = ["DEMO-1090", "DEMO-1091"];

function lista(id: string) {
  const r = recorteDeDados(id, dados, agora);
  assert.ok(r, `recorte ${id} deveria existir`);
  return r;
}

before(() => {
  mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
  closeDbForTests();
  snap = montarSnapshotDeDados(dados, agora);
});

after(() => {
  closeDbForTests();
  rmSync(dir, { recursive: true, force: true });
});

test("C2/E1: cada faixa e cada segmento de etapa batem com o gráfico", () => {
  for (const faixa of snap.envelhecimento.faixas) {
    const r = lista(`envelhecimento.faixa.${faixa.id}`);
    assert.equal(r.linhas.length, faixa.total, faixa.id);
    for (const parte of faixa.partes) {
      const rp = lista(`envelhecimento.faixa.${faixa.id}.etapa.${slugRecorte(parte.etapa)}`);
      assert.equal(rp.linhas.length, parte.quantidade, `${faixa.id}/${parte.etapa}`);
    }
    assert.equal(faixa.partes.reduce((s, p) => s + p.quantidade, 0), faixa.total);
  }
  const soma = snap.envelhecimento.faixas.reduce((s, f) => s + f.total, 0);
  const unicas = new Set(snap.envelhecimento.faixas.flatMap((f) => lista(`envelhecimento.faixa.${f.id}`).linhas.map((l) => l.os)));
  assert.equal(unicas.size, soma, "faixas sem sobreposição");
});

test("T1: faixa '8 a 15 dias' vazia (só cancelada) e segmento inexistente vazio", () => {
  const faixa = snap.envelhecimento.faixas.find((f) => f.id === "d8a15");
  assert.equal(faixa?.total, 0);
  assert.equal(lista("envelhecimento.faixa.d8a15").linhas.length, 0);
  assert.equal(lista("envelhecimento.faixa.d8a15").vazio, "Nenhuma OS nesta faixa agora.");
  assert.equal(lista("envelhecimento.faixa.d8a15.etapa.em-atendimento").linhas.length, 0);
});

test("E2: lista ordenada por dias em aberto, decrescente", () => {
  const r = lista("envelhecimento.faixa.d16a30");
  const dias = r.linhas.map((l) => l.idadeDias ?? 0);
  assert.deepEqual(dias, [...dias].sort((a, b) => b - a));
  assert.ok(dias.length >= 2);
});

test("U2: os 3 KPIs de contagem abrem listas do mesmo tamanho", () => {
  assert.equal(lista("envelhecimento.kpi.aguardando-terceiros").linhas.length, snap.envelhecimento.aguardandoTerceiros);
  assert.equal(lista("envelhecimento.kpi.sem-movimento-7").linhas.length, snap.envelhecimento.semMovimentoMais7);
  assert.equal(lista("envelhecimento.kpi.pendentes-sem-motivo").linhas.length, snap.envelhecimento.pendenciaSemMotivo);
  assert.ok(snap.envelhecimento.aguardandoTerceiros > 0);
  assert.ok(snap.envelhecimento.pendenciaSemMotivo > 0);
});

test("F1/U3: etapas, entraram (com +N ocultas) e encerradas batem com o Fluxo", () => {
  for (const etapa of snap.fluxo.etapas) {
    assert.equal(lista(`fluxo.etapa.${slugRecorte(etapa.etapa)}`).linhas.length, etapa.quantidade, etapa.etapa);
  }
  const entraram = lista("fluxo.entraram");
  assert.equal(entraram.linhas.length, snap.fluxo.entraramHoje);
  assert.equal(entraram.linhas.length, snap.fluxo.entraram.length + snap.fluxo.entraramOcultas);
  assert.ok(snap.fluxo.entraramOcultas > 0, "fixture cobre +N ocultas");
  assert.equal(lista("fluxo.encerradas").linhas.length, snap.fluxo.encerradasHoje);
  assert.equal(snap.fluxo.encerradasHoje, 1);
  assert.equal(snap.fluxo.etapas.find((e) => e.etapa === "Teste e devolução")?.quantidade, 0, "etapa vazia");
});

test("F2: entrada usa abertura e saída usa fechamento (hora local)", () => {
  assert.ok(lista("fluxo.entraram").linhas.every((l) => l.aberturaIso?.startsWith("2026-10-15")));
  const enc = lista("fluxo.encerradas").linhas[0];
  assert.equal(enc.os, "DEMO-1008");
  assert.equal(enc.hora, "09:00");
});

test("P2/D8: barras de Programadas batem com o indicador (sem canceladas)", () => {
  const comp = snap.programadas.comparativo;
  assert.ok(comp);
  for (const mes of comp.meses) {
    for (const cel of mes.porOficina) {
      assert.equal(lista(`programadas.${cel.chave}.${mes.chave}.abertas`).linhas.length, cel.abertas, `${cel.chave} ${mes.chave}`);
      assert.equal(lista(`programadas.${cel.chave}.${mes.chave}.fechadas`).linhas.length, cel.fechadas, `${cel.chave} ${mes.chave}`);
    }
    assert.equal(lista(`programadas.consolidado.${mes.chave}.abertas`).linhas.length, mes.consolidado.abertas);
  }
  const fev = comp.meses.find((m) => m.chave === "2026-02");
  assert.equal(fev?.porOficina.find((c) => c.chave === "seguranca-eletrica")?.abertas, 0, "TSE vazio em fevereiro");
  const out = comp.meses.find((m) => m.chave === "2026-10");
  const prevOut = out?.porOficina.find((c) => c.chave === "preventiva");
  // Fixture: 2 abertas válidas + 1 cancelada (com Fechamento) em outubro.
  assert.equal(prevOut?.abertas, 2, "preventiva cancelada não conta como aberta");
  assert.equal(prevOut?.fechadas, 1, "preventiva cancelada não conta como fechada");
});

test("U4: card de tipo abre as executadas do mês com a mesma contagem", () => {
  for (const tipo of snap.programadas.porTipo) {
    assert.equal(lista(`programadas.tipo.${slugRecorte(tipo.tipo)}`).linhas.length, tipo.executados, tipo.tipo);
  }
});

test("C2/PR #8: nenhuma OS cancelada aparece em nenhum recorte", () => {
  const ids = [
    ...snap.envelhecimento.faixas.map((f) => `envelhecimento.faixa.${f.id}`),
    ...snap.fluxo.etapas.map((e) => `fluxo.etapa.${slugRecorte(e.etapa)}`),
    "fluxo.entraram",
    "fluxo.encerradas",
    ...(snap.programadas.comparativo?.meses ?? []).map((m) => `programadas.consolidado.${m.chave}.todas`),
  ];
  for (const id of ids) {
    const r = lista(id);
    for (const linha of r.linhas) {
      assert.ok(!CANCELADAS.includes(linha.os), `${linha.os} em ${id}`);
      assert.ok(!/cancelad/i.test(linha.situacaoOs), `${linha.os} cancelada em ${id}`);
    }
  }
});

test("id desconhecido devolve null", () => {
  const { vistas } = montarVistasSala(dados, agora);
  for (const id of ["x", "envelhecimento.faixa.zzz", "fluxo.etapa.nada", "programadas.nada.2026-01", "programadas.preventiva.2026-01.xx"]) {
    assert.equal(resolverRecorte(id, { vistas, os: dados.os, agora }), null, id);
  }
});

test("C11/T1: a fixture tem uma OS cuja busca na API falha e há cache para ela", async () => {
  await assert.rejects(() => buscarDetalheOsApi(OS_FALHA_API_DEMO, true));
  const r = lista("envelhecimento.faixa.d16a30");
  assert.ok(r.linhas.some((l) => l.os === OS_FALHA_API_DEMO));
  assert.equal(r.detalhes[OS_FALHA_API_DEMO]?.os, OS_FALHA_API_DEMO);
  const ok = await buscarDetalheOsApi("DEMO-1005", true);
  assert.equal(ok?.os, "DEMO-1005");
});

test("C11: timeout do detalhe rejeita com TempoEsgotadoError", async () => {
  await assert.rejects(() => comTimeout(new Promise(() => {}), 20), TempoEsgotadoError);
  assert.equal(await comTimeout(Promise.resolve(1), 50), 1);
});

test("X1/X2: Processos fora do menu e da rotação", () => {
  assert.ok(!TELAS_SALA.some((t) => (t.id as string) === "processos"));
  assert.ok(!snap.sequencia.includes("processos" as never));
});
