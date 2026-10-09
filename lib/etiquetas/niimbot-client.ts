"use client";

import type { LabelSizePx } from "./tipos";

export type NiimbotModel = {
  label?: string;
  id?: number;
  dpi: number;
  task: "b1" | "v4";
  density: number;
  label_type: number;
  speed: number;
  name_prefixes: string[];
};

export type NiimbotSize = {
  w_px: number;
  h_px: number;
  offset_y_px?: number;
  dpi?: number;
};

export type NiimbotApi = {
  isSupported: () => boolean;
  identify: (model: NiimbotModel) => Promise<unknown>;
  connect: (model: NiimbotModel) => Promise<void>;
  disconnect: () => Promise<void> | void;
  printImage: (
    url: string,
    opts: {
      model: NiimbotModel;
      size: NiimbotSize;
      copies?: number;
      density?: number;
      onProgress?: (s: string) => void;
    },
  ) => Promise<void>;
  printBatch: (
    urls: string[],
    opts: {
      model: NiimbotModel;
      size: NiimbotSize;
      density?: number;
      onProgress?: (s: string) => void;
    },
  ) => Promise<void>;
  printer: { modelId: number; task: string; dpi: number; label?: string } | null;
};

declare global {
  interface Window {
    Niimbot?: NiimbotApi;
  }
}

/** Modelo B1 (203 dpi) — registry niimbot-web-bluetooth. */
export const NIIMBOT_B1_MODEL: NiimbotModel = {
  label: "Niimbot B1",
  id: 4096,
  dpi: 203,
  task: "b1",
  density: 3,
  label_type: 1,
  speed: 1,
  name_prefixes: ["B1"],
};

export function labelSizeToNiimbot(size: LabelSizePx): NiimbotSize {
  return {
    w_px: size.wPx,
    h_px: size.hPx,
    offset_y_px: size.offsetYPx,
    dpi: 203,
  };
}

export function webBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

let loadPromise: Promise<NiimbotApi> | null = null;

/** Carrega o driver global (script em /vendor/niimbot.js). */
export function loadNiimbot(): Promise<NiimbotApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Niimbot só funciona no navegador"));
  }
  if (window.Niimbot) return Promise.resolve(window.Niimbot);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<NiimbotApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-niimbot="1"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.Niimbot) resolve(window.Niimbot);
        else reject(new Error("Driver Niimbot não expôs window.Niimbot"));
      });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar driver Niimbot")));
      return;
    }
    const script = document.createElement("script");
    script.src = "/vendor/niimbot.js";
    script.async = true;
    script.dataset.niimbot = "1";
    script.onload = () => {
      if (window.Niimbot) resolve(window.Niimbot);
      else reject(new Error("Driver Niimbot não expôs window.Niimbot"));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Falha ao carregar /vendor/niimbot.js"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function printPngOnNiimbotB1(
  dataUrl: string,
  size: LabelSizePx,
  opts?: { copies?: number; onProgress?: (s: string) => void },
) {
  if (!webBluetoothSupported()) {
    throw new Error(
      "Web Bluetooth indisponível. Use Chrome/Edge em HTTPS (ou localhost) com Bluetooth ligado.",
    );
  }
  const Niimbot = await loadNiimbot();
  if (!Niimbot.isSupported()) {
    throw new Error("Este navegador não suporta Web Bluetooth (Chrome/Edge recomendados).");
  }
  await Niimbot.printImage(dataUrl, {
    model: NIIMBOT_B1_MODEL,
    size: labelSizeToNiimbot(size),
    copies: opts?.copies ?? 1,
    onProgress: opts?.onProgress,
  });
}
