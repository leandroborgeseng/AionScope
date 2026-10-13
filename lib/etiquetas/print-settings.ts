/** Tom de impressão térmica (limiar PNG + densidade B1), persistido localmente. */

export type PrintTone = 0 | 1 | 2 | 3 | 4;

export type PrintToneOpts = {
  /** 0 = mais fino … 4 = mais forte */
  tone: PrintTone;
  threshold: number;
  darkRatio: number;
  density: number;
  label: string;
};

const STORAGE_KEY = "aionscope.etiquetas.print-tone.v1";

const PRESETS: readonly PrintToneOpts[] = [
  { tone: 0, threshold: 140, darkRatio: 0.5, density: 1, label: "Mais fino" },
  { tone: 1, threshold: 134, darkRatio: 0.46, density: 2, label: "Fino" },
  { tone: 2, threshold: 128, darkRatio: 0.42, density: 2, label: "Padrão" },
  { tone: 3, threshold: 118, darkRatio: 0.36, density: 3, label: "Forte" },
  { tone: 4, threshold: 108, darkRatio: 0.3, density: 4, label: "Mais forte" },
] as const;

export function clampPrintTone(n: number): PrintTone {
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(4, Math.round(n))) as PrintTone;
}

export function toneToPrintOpts(tone: number): PrintToneOpts {
  return PRESETS[clampPrintTone(tone)]!;
}

export function loadPrintTone(): PrintTone {
  if (typeof window === "undefined") return 2;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return 2;
    return clampPrintTone(Number(raw));
  } catch {
    return 2;
  }
}

export function savePrintTone(tone: PrintTone): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(clampPrintTone(tone)));
}

export const PRINT_TONE_PRESETS = PRESETS;
