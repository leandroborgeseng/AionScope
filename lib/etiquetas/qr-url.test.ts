import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import {
  applyEffortUrlTemplate,
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
  it("substitui Id, Tag e base", () => {
    assert.equal(
      applyEffortUrlTemplate(
        "{base}/#/equipamento/{Id}?tag={Tag}",
        { tag: "HSJ-001", id: 7685 },
        "https://sjh.globalthings.net",
      ),
      "https://sjh.globalthings.net/#/equipamento/7685?tag=HSJ-001",
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
  it("cai na ficha vida AionScope sem template", () => {
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

  it("usa template Effort quando configurado e Id disponível", () => {
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

  it("ETIQUETA_QR_BASE sozinha vira {base}/{Tag}", () => {
    clearEnv();
    process.env.NEXT_PUBLIC_ETIQUETA_QR_BASE = "https://sjh.globalthings.net/ativo";
    assert.equal(effortEquipamentoUrlTemplate(), "https://sjh.globalthings.net/ativo/{Tag}");
    const r = resolveEtiquetaQrUrl({
      tag: "HSJ-9",
      fichaVidaPath: "/equipamentos/HSJ-9",
      origin: "https://aionscope.example",
    });
    assert.equal(r.source, "effort-template");
    assert.equal(r.url, "https://sjh.globalthings.net/ativo/HSJ-9");
  });

  it("fallback ficha se template exige Id ausente", () => {
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
