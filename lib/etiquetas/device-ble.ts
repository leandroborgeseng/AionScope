/** Pré-checagem de plataforma / Web Bluetooth para o fluxo de etiquetas. */

export type BlePlatform = "ios" | "android" | "desktop" | "unknown";

export type BlePathAdvice = {
  platform: BlePlatform;
  bleAvailable: boolean;
  /** Caminho recomendado para o usuário. */
  recommend: "b1" | "png";
  title: string;
  message: string;
};

export function detectBlePlatform(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): BlePlatform {
  const s = ua || "";
  if (/iPhone|iPad|iPod/i.test(s) || (/Macintosh/i.test(s) && typeof navigator !== "undefined" && "maxTouchPoints" in navigator && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(s)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(s)) return "desktop";
  return "unknown";
}

export function adviseBlePath(opts?: {
  ua?: string;
  bleAvailable?: boolean;
}): BlePathAdvice {
  const platform = detectBlePlatform(opts?.ua);
  const bleAvailable =
    opts?.bleAvailable ??
    (typeof navigator !== "undefined" && Boolean(navigator.bluetooth));

  if (platform === "ios") {
    return {
      platform,
      bleAvailable: false,
      recommend: "png",
      title: "iPhone / iPad",
      message:
        "Safari e iOS não têm Web Bluetooth. Baixe PNG (selecionadas ou pacote offline) e imprima pelo app Niimbot.",
    };
  }

  if (!bleAvailable) {
    return {
      platform,
      bleAvailable: false,
      recommend: "png",
      title: "Bluetooth web indisponível",
      message:
        "Use Chrome ou Edge em HTTPS com Bluetooth ligado. Enquanto isso, baixe PNG e use o app Niimbot.",
    };
  }

  if (platform === "android") {
    return {
      platform,
      bleAvailable: true,
      recommend: "b1",
      title: "Android · Chrome/Edge",
      message: "Web Bluetooth disponível — pode conectar e imprimir direto na Niimbot B1.",
    };
  }

  return {
    platform,
    bleAvailable: true,
    recommend: "b1",
    title: "Desktop · Chrome/Edge",
    message: "Web Bluetooth disponível — conecte a B1 e imprima a fila daqui.",
  };
}
