import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LABEL_PREVIEW_PX_PER_MM,
  downsampleRgbaThreshold,
  hardenRgbaTo1Bit,
  resolveLabelCanvasBackingStore,
} from "./render-label";
import { LABEL_SIZES_B1 } from "./tipos";

const size50 = LABEL_SIZES_B1.find((s) => s.id === "50x30")!;

describe("hardenRgbaTo1Bit / downsampleRgbaThreshold", () => {
  it("remove cinza do antialias", () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // branco
      180, 180, 180, 255, // cinza → branco (limiar 168)
      40, 40, 40, 255, // quase preto → preto
      0, 0, 0, 255, // preto
    ]);
    hardenRgbaTo1Bit(data, 190);
    assert.equal(data[0], 255);
    assert.equal(data[4], 0); // 180 < 190 → preto (limiar agressivo)
    assert.equal(data[8], 0);
    assert.equal(data[12], 0);
  });

  it("downsample 2× usa voto de escuridão", () => {
    // 4×2 → 2×1; cada bloco 2×2
    const src = new Uint8ClampedArray(4 * 2 * 4);
    src.fill(255);
    // bloco TL: 1 preto / 4 → ratio 0.25 ≥ 0.18 → preto
    src[0] = src[1] = src[2] = 0;
    // bloco TR: 2 pretos → preto
    src[8] = src[9] = src[10] = 0;
    src[12] = src[13] = src[14] = 0;

    const out = downsampleRgbaThreshold(src, 4, 2, 2, 1, {
      threshold: 190,
      darkRatio: 0.18,
    });
    assert.equal(out[0], 0);
    assert.equal(out[4], 0);
  });
});

describe("resolveLabelCanvasBackingStore", () => {
  it("print fica 1:1 com a geometria B1 203 dpi (cabeçote 384)", () => {
    const b = resolveLabelCanvasBackingStore(size50, "print");
    assert.equal(b.width, 384);
    assert.equal(b.height, 240);
    assert.equal(b.mapX, 1);
    assert.equal(b.mapY, 1);
    assert.equal(b.smooth, false);
  });

  it("preview usa CSS × DPR com piso 2× print (384→768)", () => {
    const cssW = size50.wMm * LABEL_PREVIEW_PX_PER_MM;
    const cssH = size50.hMm * LABEL_PREVIEW_PX_PER_MM;
    assert.equal(cssW, 400);
    assert.equal(cssH, 240);
    const b = resolveLabelCanvasBackingStore(size50, "preview", {
      cssW,
      cssH,
      devicePixelRatio: 2,
    });
    // CSS×DPR = 800×480; piso 2× print = 768×480 → usa 800
    assert.equal(b.width, 800);
    assert.equal(b.height, 480);
    assert.equal(b.mapX, 800 / 384);
    assert.equal(b.mapY, 2);
    assert.equal(b.smooth, true);
  });

  it("preview sem clientWidth cai no fallback mm × px/mm (piso 2× print)", () => {
    const b = resolveLabelCanvasBackingStore(size50, "preview", {
      cssW: 0,
      cssH: 0,
      devicePixelRatio: 1,
    });
    // fallback CSS 400×240 @ dpr1 → 400, mas piso 2× print 384 = 768×480
    assert.equal(b.width, 768);
    assert.equal(b.height, 480);
  });

  it("preview em coluna estreita ainda usa piso 2× print", () => {
    const b = resolveLabelCanvasBackingStore(size50, "preview", {
      cssW: 292,
      cssH: 175,
      devicePixelRatio: 2,
    });
    // CSS×DPR = 584×350 < 768×480 → piso
    assert.equal(b.width, 768);
    assert.equal(b.height, 480);
  });
});
