import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  historyMapFromEntries,
  isPrintedForMonths,
  isPrintedInAnyMonth,
  printHistoryKey,
} from "./print-history";
import { adviseBlePath, detectBlePlatform } from "./device-ble";
import { clampPrintTone, toneToPrintOpts } from "./print-settings";

describe("print-history keys", () => {
  it("normaliza tag", () => {
    assert.equal(printHistoryKey(" hsj-1 ", "2026-10"), "HSJ-1|2026-10");
  });

  it("detecta impresso em todos / algum mês", () => {
    const map = historyMapFromEntries([
      { tag: "HSJ-1", monthKey: "2026-10", printedAt: "2026-10-01T00:00:00.000Z" },
    ]);
    assert.equal(isPrintedForMonths(map, "hsj-1", ["2026-10"]), true);
    assert.equal(isPrintedForMonths(map, "hsj-1", ["2026-10", "2026-11"]), false);
    assert.equal(isPrintedInAnyMonth(map, "hsj-1", ["2026-10", "2026-11"]), true);
  });
});

describe("device-ble", () => {
  it("detecta iOS e recomenda PNG", () => {
    assert.equal(detectBlePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "ios");
    const advice = adviseBlePath({ ua: "iPhone", bleAvailable: false });
    assert.equal(advice.recommend, "png");
  });

  it("Android com BLE recomenda B1", () => {
    const advice = adviseBlePath({
      ua: "Mozilla/5.0 (Linux; Android 14) Chrome/120",
      bleAvailable: true,
    });
    assert.equal(advice.platform, "android");
    assert.equal(advice.recommend, "b1");
  });
});

describe("print-settings", () => {
  it("mapeia tom fino/forte", () => {
    assert.equal(clampPrintTone(9), 4);
    assert.ok(toneToPrintOpts(0).threshold > toneToPrintOpts(4).threshold);
    assert.ok(toneToPrintOpts(0).density < toneToPrintOpts(4).density);
    assert.equal(toneToPrintOpts(2).label, "Padrão");
  });
});
