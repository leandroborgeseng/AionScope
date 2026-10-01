import assert from "node:assert/strict";
import test from "node:test";
import { diffHorasUteis, type HorarioUtilConfig } from "./horario-util";

const config: HorarioUtilConfig = {
  inicio: 7,
  fim: 17,
  feriados: new Set(["2026-04-21"]),
};

test("conta só o expediente do mesmo dia", () => {
  const horas = diffHorasUteis(new Date(2026, 9, 1, 8, 0), new Date(2026, 9, 1, 9, 0), config);
  assert.equal(horas, 1);
});

test("sexta à noite até segunda de manhã", () => {
  const horas = diffHorasUteis(new Date(2026, 9, 2, 16, 0), new Date(2026, 9, 5, 8, 0), config);
  assert.equal(horas, 2);
});

test("feriado inteiro não conta", () => {
  const horas = diffHorasUteis(new Date(2026, 3, 21, 7, 0), new Date(2026, 3, 21, 17, 0), config);
  assert.equal(horas, 0);
});

test("abertura fora do horário espera o próximo expediente", () => {
  const horas = diffHorasUteis(new Date(2026, 9, 3, 18, 0), new Date(2026, 9, 5, 8, 0), config);
  assert.equal(horas, 1);
});

test("madrugada fora do expediente vale zero, sem horário de verão", () => {
  const horas = diffHorasUteis(new Date(2026, 9, 1, 2, 0), new Date(2026, 9, 1, 3, 0), config);
  assert.equal(horas, 0);
});
