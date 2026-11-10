import assert from "node:assert/strict";
import { test } from "node:test";
import { EMAIL_TAMANHO_MAXIMO, SETOR_TAMANHO_MAXIMO, mascararEmail, normalizarEmail, normalizarTextoLivre } from "./texto-livre";

test("setor e outros_setores: trim, limite e texto puro", () => {
  assert.deepEqual(normalizarTextoLivre("  UTI ZZTESTE  ", SETOR_TAMANHO_MAXIMO), {
    ok: true,
    texto: "UTI ZZTESTE",
  });
  assert.deepEqual(normalizarTextoLivre("", SETOR_TAMANHO_MAXIMO), { ok: true, texto: null });
  assert.deepEqual(normalizarTextoLivre(null, SETOR_TAMANHO_MAXIMO), { ok: true, texto: null });

  const noLimite = "Z".repeat(SETOR_TAMANHO_MAXIMO);
  const alem = "Z".repeat(SETOR_TAMANHO_MAXIMO + 1);
  assert.equal(normalizarTextoLivre(noLimite, SETOR_TAMANHO_MAXIMO).ok, true);
  assert.deepEqual(normalizarTextoLivre(alem, SETOR_TAMANHO_MAXIMO), { ok: false });
});

test("invisíveis e bidi (Cf) são recusados sem devolver o caractere", () => {
  for (const caractere of ["\u200B", "\u200E", "\u202E", "\u2066", "\uFEFF", "\u00AD"]) {
    const entrada = `UTI${caractere}ZZ`;
    const resultado = normalizarTextoLivre(entrada, SETOR_TAMANHO_MAXIMO);
    assert.deepEqual(resultado, { ok: false });
    assert.equal(JSON.stringify(resultado).includes(caractere), false);
    assert.equal(JSON.stringify(resultado).includes("ZZ"), false);
  }
});

test("HTML e caracteres de controle são recusados, sem interpretar entidade", () => {
  for (const entrada of ["UTI <script>alert(1)</script>", "Plantao ZZ\nnoturno", "UTI\u0000ZZ", "aba\u2028c", "x\ty"]) {
    assert.deepEqual(normalizarTextoLivre(entrada, SETOR_TAMANHO_MAXIMO), { ok: false }, entrada);
  }
  const entidade = normalizarTextoLivre("Tom &amp; ZZTESTE", SETOR_TAMANHO_MAXIMO);
  assert.deepEqual(entidade, { ok: true, texto: "Tom &amp; ZZTESTE" });
});

test("e-mail é minúsculo, validado e mascarado", () => {
  assert.deepEqual(normalizarEmail("  Ana.ZZTESTE@Exemplo.INVALID "), {
    ok: true,
    email: "ana.zzteste@exemplo.invalid",
  });
  assert.deepEqual(normalizarEmail(""), { ok: true, email: null });
  assert.deepEqual(normalizarEmail("sem-arroba"), { ok: false });
  assert.deepEqual(normalizarEmail(`${"a".repeat(EMAIL_TAMANHO_MAXIMO)}@exemplo.invalid`), { ok: false });
  assert.equal(mascararEmail("ana.zzteste@exemplo.invalid"), "a•••@e•••");
  assert.equal(mascararEmail("ana.zzteste@exemplo.invalid").includes("ana.zzteste"), false);
  assert.equal(mascararEmail("ana.zzteste@exemplo.invalid").includes("exemplo.invalid"), false);
});
