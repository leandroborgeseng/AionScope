import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LABEL_PREVIEW_PX_PER_MM,
  resolveLabelCanvasBackingStore,
} from "./render-label";
import { LABEL_SIZES_B1 } from "./tipos";

const size50 = LABEL_SIZES_B1.find((s) => s.id === "50x30")!;

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
