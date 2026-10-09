import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import {
  applyEffortUrlTemplate,
  DEFAULT_EFFORT_EQUIPAMENTO_URL_TEMPLATE,
  effortEquipamentoUrlTemplate,
  effortPortalBase,
  resolveEtiquetaQrUrl,
} from "./qr-url";

const ENV_KEYS = [
  "NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE",
  "NEXT_PUBLIC_ETIQUETA_QR_BASE",
  "NEXT_PUBLIC_PBI_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

before(() => {
  stashEnv();
});

afterEach(() => {
  restoreEnv();
});

describe("applyEffortUrlTemplate", () => {
  it("substitui Id, Tag e base no path Mobile", () => {
    assert.equal(
      applyEffortUrlTemplate(
        "{base}/Mobile/MEquipamentoPropriedade.aspx?eqp={Id}",
        { tag: "HSJ-00001", id: 59 },
        "https://sjh.globalthings.net",
      ),
      "https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=59",
    );
  });

  it("exige Id quando o template usa {Id}", () => {
    assert.equal(
      applyEffortUrlTemplate("{base}/eq/{Id}", { tag: "HSJ-001" }, "https://x"),
      null,
    );
  });

  it("exige CodigoCliente quando o template usa {CodigoCliente}", () => {
    assert.equal(
      applyEffortUrlTemplate(
        "{base}?c={CodigoCliente}",
        { tag: "HSJ-001", id: 1, codigoCliente: "" },
        "https://x",
      ),
      null,
    );
  });
});

describe("resolveEtiquetaQrUrl", () => {
  it("padrão Effort Mobile com Id (HSJ-00001 → eqp=59)", () => {
    clearEnv();
    process.env.NEXT_PUBLIC_APP_URL = "https://aionscope.example";
    assert.equal(effortEquipamentoUrlTemplate(), DEFAULT_EFFORT_EQUIPAMENTO_URL_TEMPLATE);
    const r = resolveEtiquetaQrUrl({
      tag: "HSJ-00001",
      id: 59,
      fichaVidaPath: "/equipamentos/HSJ-00001",
      origin: "https://aionscope.example",
    });
    assert.equal(r.source, "effort-template");
    assert.equal(
      r.url,
      "https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=59",
    );
    assert.equal(r.fichaVidaUrl, "https://aionscope.example/equipamentos/HSJ-00001");
  });

  it("fallback ficha vida quando Id ausente (template padrão exige {Id})", () => {
    clearEnv();
    process.env.NEXT_PUBLIC_APP_URL = "https://aionscope.example";
    const r = resolveEtiquetaQrUrl({
      tag: "EQ-1",
      fichaVidaPath: "/equipamentos/EQ-1",
      origin: "https://aionscope.example",
    });
    assert.equal(r.source, "ficha-vida");
    assert.equal(r.url, "https://aionscope.example/equipamentos/EQ-1");
    assert.equal(r.fichaVidaUrl, r.url);
  });

  it("override de template Effort quando configurado", () => {
    clearEnv();
    process.env.NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE =
      "{base}/equipamento/{Id}";
    process.env.NEXT_PUBLIC_ETIQUETA_QR_BASE = "https://sjh.globalthings.net";
    const r = resolveEtiquetaQrUrl({
      tag: "HSJ-03001",
      id: 7685,
      fichaVidaPath: "/equipamentos/HSJ-03001",
      origin: "https://aionscope.example",
    });
    assert.equal(r.source, "effort-template");
    assert.equal(r.url, "https://sjh.globalthings.net/equipamento/7685");
    assert.equal(r.fichaVidaUrl, "https://aionscope.example/equipamentos/HSJ-03001");
  });

  it("ETIQUETA_QR_BASE altera só o {base} do template padrão", () => {
    clearEnv();
    process.env.NEXT_PUBLIC_ETIQUETA_QR_BASE = "https://outro.globalthings.net";
    assert.equal(effortEquipamentoUrlTemplate(), DEFAULT_EFFORT_EQUIPAMENTO_URL_TEMPLATE);
    const r = resolveEtiquetaQrUrl({
      tag: "HSJ-9",
      id: 12,
      fichaVidaPath: "/equipamentos/HSJ-9",
      origin: "https://aionscope.example",
    });
    assert.equal(r.source, "effort-template");
    assert.equal(
      r.url,
      "https://outro.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=12",
    );
  });

  it("fallback ficha se template custom exige Id ausente", () => {
    clearEnv();
    process.env.NEXT_PUBLIC_EFFORT_EQUIPAMENTO_URL_TEMPLATE =
      "https://portal.example/eq/{Id}";
    const r = resolveEtiquetaQrUrl({
      tag: "HSJ-1",
      fichaVidaPath: "/equipamentos/HSJ-1",
      origin: "https://aionscope.example",
    });
    assert.equal(r.source, "ficha-vida");
    assert.equal(r.url, "https://aionscope.example/equipamentos/HSJ-1");
  });

  it("effortPortalBase usa default GlobalThings", () => {
    clearEnv();
    assert.equal(effortPortalBase(), "https://sjh.globalthings.net");
  });
});
