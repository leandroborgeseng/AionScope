import QRCode from "qrcode";
import { chipLabels } from "./agregar-plano";
import { etiquetaContatoLine } from "./branding";
import { LABEL_SIZES_B1, type LabelRenderInput, type LabelSizePx } from "./tipos";

/** Família legível em 203 dpi (Outfit já carrega no app; fallbacks limpos). */
const LABEL_FONT = 'Outfit, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Layout 50×30 (384×240 @ 203 dpi) — faixa vertical esquerda + miolo + QR:
 *
 *  ┌─────────────────────────────────────┐
 *  │ L │  nome / chips / datas / site   │ QR │
 *  │ O │                                │    │
 *  │ G │                                │    │
 *  │ O │                                │    │
 *  │ T │                                │    │
 *  │ A │                                │    │
 *  │ G │                                │    │
 *  └─────────────────────────────────────┘
 *
 * Logo e TAG deitados (rotacionados −90°). Chips preto/branco.
 * Mesmo canvas do mockup e da impressão B1 (WYSIWYG).
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

  const isCompact = size.id === "40x30";
  const pad = isCompact ? 4 : 5;
  const stripW = isCompact ? 36 : 46;
  const qrSide = Math.round(Math.min(size.hPx - pad * 2, size.wPx * (isCompact ? 0.3 : 0.28)));
  const gap = isCompact ? 3 : 4;

  const mainX = stripW + gap;
  const mainRight = size.wPx - pad - qrSide - gap;
  const mainW = Math.max(40, mainRight - mainX);

  // ——— Faixa esquerda: logo + TAG deitados ———
  await drawLeftStrip(ctx, input, {
    x: 0,
    y: 0,
    w: stripW,
    h: size.hPx,
    pad,
  });

  // Separador faixa | miolo
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(stripW + 0.5, pad);
  ctx.lineTo(stripW + 0.5, size.hPx - pad);
  ctx.stroke();

  // ——— Miolo ———
  let y = pad;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // Marca opcional (só se NEXT_PUBLIC_ETIQUETA_BRAND estiver setado — sem "HSJ Eng. Clínica")
  const brand = (input.brand ?? "").trim();
  if (brand) {
    ctx.font = `600 ${Math.round(size.hPx * 0.07)}px ${LABEL_FONT}`;
    ctx.fillText(truncate(brand, isCompact ? 18 : 22), mainX, y, mainW);
    y += Math.round(size.hPx * 0.095);
  }

  // Nome do equipamento (destaque tipográfico)
  const nameSize = Math.round(size.hPx * (isCompact ? 0.105 : 0.118));
  ctx.font = `700 ${nameSize}px ${LABEL_FONT}`;
  const nameLines = wrapText(ctx, input.equipamento || "—", mainW, isCompact ? 2 : 2);
  for (const line of nameLines) {
    ctx.fillText(line, mainX, y, mainW);
    y += Math.round(nameSize * 1.12);
  }
  y += Math.round(size.hPx * 0.02);

  // Chips PRETO / letra BRANCA
  const chips = chipLabels(input.planos);
  const chipH = Math.round(size.hPx * 0.135);
  const chipFont = Math.round(chipH * 0.52);
  ctx.font = `700 ${chipFont}px ${LABEL_FONT}`;
  ctx.textBaseline = "middle";
  let chipX = mainX;
  for (const chip of chips) {
    const tw = ctx.measureText(chip).width;
    const cw = Math.ceil(tw + 10);
    if (chipX + cw > mainX + mainW) break;
    ctx.fillStyle = "#000000";
    roundRect(ctx, chipX, y, cw, chipH, 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(chip, chipX + 5, y + chipH / 2);
    chipX += cw + 4;
  }
  ctx.fillStyle = "#000000";
  y += chipH + Math.round(size.hPx * 0.045);

  // Datas
  ctx.textBaseline = "top";
  const dateSize = Math.round(size.hPx * 0.088);
  ctx.font = `600 ${dateSize}px ${LABEL_FONT}`;
  ctx.fillText(`Realiz. ${input.realizacaoLabel}`, mainX, y, mainW);
  y += Math.round(dateSize * 1.2);
  ctx.fillText(`Próx. ${input.proximaLabel}`, mainX, y, mainW);

  // Contato (site · tel) — ancorado no rodapé do miolo
  const contato = etiquetaContatoLine({
    brand: input.brand,
    site: input.site,
    telefone: input.telefone,
    logoUrl: input.logoUrl,
  });
  const footerSize = Math.round(size.hPx * 0.068);
  ctx.font = `500 ${footerSize}px ${LABEL_FONT}`;
  ctx.fillText(
    truncate(contato, isCompact ? 26 : 32),
    mainX,
    size.hPx - pad - footerSize,
    mainW,
  );

  // ——— QR (direita) ———
  const qrDataUrl = await QRCode.toDataURL(input.qrUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: qrSide * 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrImg = await loadImage(qrDataUrl);
  const qrX = size.wPx - pad - qrSide;
  const qrY = Math.round((size.hPx - qrSide) / 2);
  ctx.drawImage(qrImg, qrX, qrY, qrSide, qrSide);

  // Moldura
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size.wPx - 1, size.hPx - 1);
}

type StripBox = { x: number; y: number; w: number; h: number; pad: number };

/**
 * Faixa vertical esquerda: logo Aion deitado (−90°) no topo,
 * TAG deitada (−90°) na parte inferior — libera o miolo horizontal.
 */
async function drawLeftStrip(
  ctx: CanvasRenderingContext2D,
  input: LabelRenderInput,
  box: StripBox,
) {
  const { x, y, w, h, pad } = box;
  const innerW = w - pad;
  const cx = x + w / 2;

  // Fundo sutil da faixa (linha só; fundo branco)
  const usableH = h - pad * 2;
  const logoShare = 0.48;
  const logoZoneH = Math.round(usableH * logoShare);
  const tagZoneH = usableH - logoZoneH - 2;

  // Logo rotacionado −90° (wordmark “deitado”)
  try {
    const logo = await loadImage(input.logoUrl);
    // Após −90°: espessura visual ≈ drawH; comprimento ao longo da faixa ≈ drawW
    const drawH = Math.max(12, innerW - 2);
    const natRatio = logo.naturalWidth / Math.max(1, logo.naturalHeight);
    let drawW = Math.round(drawH * natRatio);
    const maxLen = logoZoneH - 2;
    if (drawW > maxLen) drawW = maxLen;

    ctx.save();
    // Centro da zona do logo
    ctx.translate(cx, y + pad + logoZoneH / 2);
    ctx.rotate(-Math.PI / 2);
    // No espaço rotacionado, X = comprimento vertical, Y = espessura
    drawLogoThreshold(ctx, logo, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  } catch {
    // Fallback: texto "AION" deitado
    ctx.save();
    ctx.translate(cx, y + pad + logoZoneH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#000000";
    ctx.font = `700 ${Math.round(innerW * 0.55)}px ${LABEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AION", 0, 0);
    ctx.restore();
  }

  // TAG rotacionada −90°
  const tag = truncate(input.tag.trim() || "—", 16);
  const tagFont = Math.round(Math.min(innerW * 0.72, 18));
  ctx.save();
  ctx.translate(cx, y + pad + logoZoneH + 2 + tagZoneH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#000000";
  ctx.font = `700 ${tagFont}px ui-monospace, "Cascadia Mono", "Segoe UI Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Limita ao comprimento da zona
  const maxTagW = tagZoneH - 4;
  ctx.fillText(tag, 0, 0, maxTagW);
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["—"];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxW) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  } else if (current && lines.length === maxLines) {
    // última linha já cheia — ignora resto
  } else if (current && lines.length === maxLines - 1) {
    lines.push(truncate(current, 40));
  }
  // Truncar última se ainda estourou
  if (lines.length > 0) {
    const last = lines[lines.length - 1]!;
    if (ctx.measureText(last).width > maxW) {
      let t = last;
      while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
      lines[lines.length - 1] = `${t}…`;
    }
  }
  // Se estourou palavras e maxLines, truncar última
  if (words.join(" ").length > 0 && lines.length === maxLines) {
    const used = lines.join(" ");
    if (used.length < text.trim().length && !lines[lines.length - 1]!.endsWith("…")) {
      const last = lines[lines.length - 1]!;
      lines[lines.length - 1] = truncate(last, Math.max(4, last.length));
      if (!lines[lines.length - 1]!.endsWith("…")) {
        lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
      }
    }
  }
  return lines.slice(0, maxLines);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
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
export const LABEL_PREVIEW_PX_PER_MM = 7.2;
