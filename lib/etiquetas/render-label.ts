import QRCode from "qrcode";
import { chipLabels } from "./agregar-plano";
import { LABEL_SIZES_B1, type LabelRenderInput, type LabelSizePx } from "./tipos";

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Desenha a etiqueta no canvas (B1 1-bit friendly: preto sobre branco).
 * Layout: marca | Tag+nome | chips PREV·CAL·TSE | Realização / Próxima | QR ficha vida.
 */
export async function drawLabelToCanvas(
  canvas: HTMLCanvasElement,
  input: LabelRenderInput,
): Promise<void> {
  const { size } = input;
  canvas.width = size.wPx;
  canvas.height = size.hPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.wPx, size.hPx);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";

  const pad = Math.max(6, Math.round(size.wPx * 0.025));
  const qrSide = Math.round(Math.min(size.hPx * 0.72, size.wPx * 0.38));

  // Marca
  ctx.font = `bold ${Math.round(size.hPx * 0.1)}px sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(truncate(input.brand, 28), pad, pad);

  // Tag
  const tagY = pad + Math.round(size.hPx * 0.14);
  ctx.font = `bold ${Math.round(size.hPx * 0.145)}px monospace`;
  ctx.fillText(truncate(input.tag, 18), pad, tagY);

  // Nome
  const nameY = tagY + Math.round(size.hPx * 0.16);
  ctx.font = `${Math.round(size.hPx * 0.095)}px sans-serif`;
  ctx.fillText(truncate(input.equipamento || "—", size.id === "40x30" ? 22 : 28), pad, nameY);

  // Chips
  const chips = chipLabels(input.planos);
  const chipY = nameY + Math.round(size.hPx * 0.13);
  const chipH = Math.round(size.hPx * 0.13);
  let chipX = pad;
  ctx.font = `bold ${Math.round(chipH * 0.55)}px sans-serif`;
  ctx.textBaseline = "middle";
  for (const chip of chips) {
    const tw = ctx.measureText(chip).width;
    const cw = tw + 10;
    ctx.strokeRect(chipX + 0.5, chipY + 0.5, cw, chipH);
    ctx.fillText(chip, chipX + 5, chipY + chipH / 2);
    chipX += cw + 5;
  }

  // Datas
  ctx.textBaseline = "top";
  const dateY = chipY + chipH + Math.round(size.hPx * 0.06);
  ctx.font = `${Math.round(size.hPx * 0.09)}px sans-serif`;
  const line1 = `Realiz.: ${input.realizacaoLabel}`;
  const line2 = `Próxima: ${input.proximaLabel}`;
  ctx.fillText(truncate(line1, 26), pad, dateY);
  ctx.fillText(truncate(line2, 26), pad, dateY + Math.round(size.hPx * 0.11));

  // QR
  const qrDataUrl = await QRCode.toDataURL(input.qrUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: qrSide,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const img = await loadImage(qrDataUrl);
  const qrX = size.wPx - pad - qrSide;
  const qrY = Math.round((size.hPx - qrSide) / 2);
  ctx.drawImage(img, qrX, qrY, qrSide, qrSide);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar QR"));
    img.src = src;
  });
}

export async function labelToPngDataUrl(
  input: LabelRenderInput,
  canvas?: HTMLCanvasElement,
): Promise<string> {
  const el = canvas ?? document.createElement("canvas");
  await drawLabelToCanvas(el, input);
  return el.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function resolveLabelSize(id: LabelSizePx["id"] | string): LabelSizePx {
  return LABEL_SIZES_B1.find((s) => s.id === id) ?? LABEL_SIZES_B1[0]!;
}
