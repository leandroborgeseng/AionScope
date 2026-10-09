import QRCode from "qrcode";
import { chipLabels } from "./agregar-plano";
import { etiquetaContatoLine } from "./branding";
import { LABEL_SIZES_B1, type LabelRenderInput, type LabelSizePx } from "./tipos";

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Desenha a etiqueta no canvas (B1 1-bit friendly: preto sobre branco).
 *
 * Layout 50×30 (384×240 @ 203 dpi) — WYSIWYG do que vai à B1:
 *  [logo] brand              [QR ficha vida]
 *  TAG
 *  nome equipamento
 *  [PREV][CAL][TSE]
 *  Realiz. MM/AAAA   Próx. …
 *  site · telefone
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
  ctx.lineWidth = 1;

  const pad = Math.max(6, Math.round(size.wPx * 0.028));
  const qrSide = Math.round(Math.min(size.hPx * 0.58, size.wPx * 0.32));
  const textMaxW = size.wPx - pad * 2 - qrSide - Math.round(pad * 0.6);
  const isCompact = size.id === "40x30";

  // ——— Cabeçalho: logo + brand ———
  const logoH = Math.round(size.hPx * 0.16);
  let headerX = pad;
  const headerY = pad;

  try {
    const logo = await loadImage(input.logoUrl);
    const ratio = logo.naturalWidth / Math.max(1, logo.naturalHeight);
    const logoW = Math.min(Math.round(logoH * ratio), Math.round(textMaxW * 0.55));
    drawLogoThreshold(ctx, logo, headerX, headerY, logoW, logoH);
    headerX += logoW + Math.round(pad * 0.5);
  } catch {
    // Sem logo: segue só com texto da marca
  }

  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(size.hPx * 0.075)}px sans-serif`;
  const brandMax = isCompact ? 16 : 20;
  ctx.fillText(
    truncate(input.brand, brandMax),
    headerX,
    headerY + logoH / 2,
    Math.max(20, textMaxW - (headerX - pad)),
  );

  // ——— Tag ———
  const tagY = headerY + logoH + Math.round(size.hPx * 0.04);
  ctx.textBaseline = "top";
  ctx.font = `bold ${Math.round(size.hPx * 0.135)}px monospace`;
  ctx.fillText(truncate(input.tag, isCompact ? 14 : 16), pad, tagY, textMaxW);

  // ——— Nome ———
  const nameY = tagY + Math.round(size.hPx * 0.145);
  ctx.font = `${Math.round(size.hPx * 0.085)}px sans-serif`;
  ctx.fillText(
    truncate(input.equipamento || "—", isCompact ? 20 : 26),
    pad,
    nameY,
    textMaxW,
  );

  // ——— Chips PREV · CAL · TSE ———
  const chips = chipLabels(input.planos);
  const chipY = nameY + Math.round(size.hPx * 0.115);
  const chipH = Math.round(size.hPx * 0.125);
  let chipX = pad;
  ctx.font = `bold ${Math.round(chipH * 0.52)}px sans-serif`;
  ctx.textBaseline = "middle";
  for (const chip of chips) {
    const tw = ctx.measureText(chip).width;
    const cw = Math.ceil(tw + 8);
    if (chipX + cw > pad + textMaxW) break;
    ctx.strokeRect(chipX + 0.5, chipY + 0.5, cw, chipH);
    ctx.fillText(chip, chipX + 4, chipY + chipH / 2);
    chipX += cw + 4;
  }

  // ——— Datas ———
  ctx.textBaseline = "top";
  const dateY = chipY + chipH + Math.round(size.hPx * 0.045);
  ctx.font = `${Math.round(size.hPx * 0.08)}px sans-serif`;
  ctx.fillText(`Realiz. ${input.realizacaoLabel}`, pad, dateY, textMaxW);
  ctx.fillText(
    `Próx. ${input.proximaLabel}`,
    pad,
    dateY + Math.round(size.hPx * 0.095),
    textMaxW,
  );

  // ——— Contato: site · telefone ———
  const contato = etiquetaContatoLine({
    brand: input.brand,
    site: input.site,
    telefone: input.telefone,
    logoUrl: input.logoUrl,
  });
  const footerY = size.hPx - pad - Math.round(size.hPx * 0.085);
  ctx.font = `${Math.round(size.hPx * 0.07)}px sans-serif`;
  ctx.fillText(truncate(contato || input.site, isCompact ? 28 : 36), pad, footerY, textMaxW);

  // ——— QR (direita, centro vertical da área útil) ———
  const qrDataUrl = await QRCode.toDataURL(input.qrUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: qrSide * 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrImg = await loadImage(qrDataUrl);
  const qrX = size.wPx - pad - qrSide;
  const qrY = Math.round((size.hPx - qrSide) / 2 - size.hPx * 0.02);
  ctx.drawImage(qrImg, qrX, qrY, qrSide, qrSide);

  // Moldura fina (ajuda o mockup; a B1 corta ~1 mm de margem)
  ctx.strokeRect(0.5, 0.5, size.wPx - 1, size.hPx - 1);
}

/** Desenha logo em tons escuros → preto (termossensível). */
function drawLogoThreshold(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(w));
  off.height = Math.max(1, Math.round(h));
  const octx = off.getContext("2d");
  if (!octx) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  octx.drawImage(img, 0, 0, off.width, off.height);
  const image = octx.getImageData(0, 0, off.width, off.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] ?? 0;
    if (a < 40) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = 0;
      continue;
    }
    const lum = 0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
    const v = lum < 160 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = v === 0 ? 255 : 0;
  }
  octx.putImageData(image, 0, 0);
  ctx.drawImage(off, x, y, w, h);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
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

/** Escala de exibição do mockup: 1 mm ≈ N px CSS (mantém proporção 50:30). */
export const LABEL_PREVIEW_PX_PER_MM = 6.4;
