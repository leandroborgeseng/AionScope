import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePbiDate } from "./dates";
import { buildOficinasPlanoComparativo } from "./oficinas-plano-comparativo";
import { currentCalendarYearRange } from "./volume-ec";
import type { OsAnaliticoItem } from "./types";

// Dados fictícios (repo público).
let seq = 0;
const os = (Oficina: string, SituacaoDaOS: string, Abertura: string, Fechamento = ""): OsAnaliticoItem =>
  ({ OS: `X${++seq}`, Oficina, SituacaoDaOS, Abertura, Fechamento, DataDaSolucao: "", TipoDeManutencao: "A - PREVENTIVA", Status: "" }) as unknown as OsAnaliticoItem;
const range = currentCalendarYearRange(new Date(2026, 9, 22, 12, 0));
const PREV = "PREVENTIVA EQUIPAMENTOS";
const CAL = "CALIBRAÇÃO DE EQUIPAMENTOS";
const TSE = "SEGURANÇA ELÉTRICA";

test("canceladas saem de ABERT. e FECH., inclusive com Fechamento preenchido", () => {
  const lista = [
    os(PREV, "Fechada", "01/09/2026 08:00", "10/09/2026 10:00"),
    os(PREV, "Aberta", "01/09/2026 08:00"),
    os(PREV, "Cancelada", "01/09/2026 08:00", "14/10/2026 17:00"), // aberta set, cancelada out
    os(PREV, "Cancelada", "05/10/2026 08:00"), // cancelada sem data de fechamento
    os(CAL, "Cancelada", "02/09/2026 08:00", "15/10/2026 08:00"),
    os(CAL, "Fechada", "02/09/2026 08:00", "03/09/2026 08:00"),
    os(TSE, "CANCELADA", "02/09/2026 08:00", "02/09/2026 09:00"),
  ];
  // Fechada em set e cancelada depois (Effort grava Fechamento; SituacaoDaOS vira Cancelada): sai dos dois lados.
  lista.push(os(PREV, "Cancelada", "03/09/2026 08:00", "20/09/2026 10:00"));
  const r = buildOficinasPlanoComparativo(lista, range);
  const set = r.months[8];
  const out = r.months[9];
  assert.deepEqual([set.porOficina[0].abertas, set.porOficina[0].fechadas], [2, 1]);
  assert.deepEqual([out.porOficina[0].abertas, out.porOficina[0].fechadas], [0, 0]);
  assert.deepEqual([set.porOficina[1].abertas, set.porOficina[1].fechadas], [1, 1]);
  assert.deepEqual([out.porOficina[1].abertas, out.porOficina[1].fechadas], [0, 0]);
  assert.deepEqual([set.porOficina[2].abertas, set.porOficina[2].fechadas], [0, 0]);
  assert.deepEqual([set.consolidado.abertas, set.consolidado.fechadas], [3, 2]);
  assert.deepEqual([out.consolidado.abertas, out.consolidado.fechadas], [0, 0]);
});

test("datas no horário de Brasília perto da meia-noite", () => {
  const d1 = parsePbiDate("31/10/2026 23:59")!;
  assert.deepEqual([d1.getMonth(), d1.getDate()], [9, 31]);
  // 2026-11-01T02:30Z = 31/10 23:30 em Brasília → outubro
  const d2 = parsePbiDate("2026-11-01T02:30:00Z")!;
  assert.deepEqual([d2.getMonth(), d2.getDate(), d2.getHours()], [9, 31, 23]);
  const d3 = parsePbiDate("2026-10-01T00:10:00-03:00")!;
  assert.deepEqual([d3.getMonth(), d3.getDate()], [9, 1]);
  const d4 = parsePbiDate("2026-10-31")!;
  assert.deepEqual([d4.getMonth(), d4.getDate()], [9, 31]);
  const r = buildOficinasPlanoComparativo([os(PREV, "Fechada", "2026-11-01T02:30:00Z", "2026-11-01T02:40:00Z")], range);
  assert.deepEqual([r.months[9].porOficina[0].abertas, r.months[9].porOficina[0].fechadas], [1, 1]);
});
