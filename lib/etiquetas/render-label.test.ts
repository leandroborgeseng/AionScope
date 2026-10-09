import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LABEL_PREVIEW_PX_PER_MM,
  resolveLabelCanvasBackingStore,
} from "./render-label";
import { LABEL_SIZES_B1 } from "./tipos";

const size50 = LABEL_SIZES_B1.find((s) => s.id === "50x30")!;

describe("resolveLabelCanvasBackingStore", () => {
  it("print fica 1:1 com a geometria B1 203 dpi", () => {
    const b = resolveLabelCanvasBackingStore(size50, "print");
    assert.equal(b.width, 400);
    assert.equal(b.height, 240);
    assert.equal(b.mapX, 1);
    assert.equal(b.mapY, 1);
    assert.equal(b.smooth, false);
  });

  it("preview usa CSS × DPR (retina ≈ kit HTML 800×480)", () => {
    const cssW = size50.wMm * LABEL_PREVIEW_PX_PER_MM;
    const cssH = size50.hMm * LABEL_PREVIEW_PX_PER_MM;
    assert.equal(cssW, 400);
    assert.equal(cssH, 240);
    const b = resolveLabelCanvasBackingStore(size50, "preview", {
      cssW,
      cssH,
      devicePixelRatio: 2,
    });
    assert.equal(b.width, 800);
    assert.equal(b.height, 480);
    assert.equal(b.mapX, 2);
    assert.equal(b.mapY, 2);
    assert.equal(b.smooth, true);
  });

  it("preview sem clientWidth cai no fallback mm × px/mm", () => {
    const b = resolveLabelCanvasBackingStore(size50, "preview", {
      cssW: 0,
      cssH: 0,
      devicePixelRatio: 1,
    });
    assert.equal(b.width, 400);
    assert.equal(b.height, 240);
  });
});
