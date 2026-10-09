import QRCode from "qrcode";
import { chipLabels } from "./agregar-plano";
import { LABEL_SIZES_B1, type LabelRenderInput, type LabelSizePx, type PlanoEtiqueta } from "./tipos";

/** Família legível em 203 dpi (Outfit já carrega no app; fallbacks limpos). */
const LABEL_FONT = 'Outfit, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

const GRID_ROWS: { id: PlanoEtiqueta; label: string }[] = [
  { id: "preventiva", label: "PREV" },
  { id: "calibracao", label: "CAL" },
  { id: "tse", label: "TSE" },
];

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Layout 50×30 (384×240 @ 203 dpi) — esquerda alinhada à foto de referência:
 *
 *  ┌──────────────────────────────────────────┐
 *  │ logo │ TAG │  miolo (grid/chips/datas) │QR│
 *  │ Aion │ blk │                           │  │
 *  │ vert │ vert│                           │──│
 *  │      │     │                           │☎ │
 *  └──────────────────────────────────────────┘
 *
 * Faixa branca (logo+wordmark) + faixa preta (TAG) rotacionadas −90° (baixo→cima).
 * Direita do TAG: grid compacto de planos + QR + bloco de contato.
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
  const pad = isCompact ? 3 : 4;
  const brandW = isCompact ? 26 : 32;
  const tagW = isCompact ? 34 : 42;
  const leftW = brandW + tagW;

  // Coluna direita: QR + contato
  const contactH = isCompact ? 40 : 46;
  const qrSide = Math.min(
    size.hPx - pad * 2 - contactH - 2,
    Math.round(size.wPx * (isCompact ? 0.28 : 0.26)),
  );
  const rightColW = Math.max(qrSide, isCompact ? 72 : 86);
  const gap = isCompact ? 3 : 4;

  const mainX = leftW + gap;
  const mainRight = size.wPx - pad - rightColW - gap;
  const mainW = Math.max(36, mainRight - mainX);

  // ——— Esquerda: faixa branca (logo) + faixa preta (TAG) ———
  await drawLeftBrandStrip(ctx, input, {
    x: 0,
    y: 0,
    w: brandW,
    h: size.hPx,
    pad,
  });
  drawTagBand(ctx, input, {
    x: brandW,
    y: 0,
    w: tagW,
    h: size.hPx,
    pad,
  });

  // ——— Miolo (direita do TAG) ———
  let y = pad;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // Marca opcional (só se NEXT_PUBLIC_ETIQUETA_BRAND — sem "HSJ Eng. Clínica")
  const brand = (input.brand ?? "").trim();
  if (brand) {
    ctx.font = `600 ${Math.round(size.hPx * 0.065)}px ${LABEL_FONT}`;
    ctx.fillText(truncate(brand, isCompact ? 16 : 20), mainX, y, mainW);
    y += Math.round(size.hPx * 0.085);
  }

  // Nome do equipamento
  const nameSize = Math.round(size.hPx * (isCompact ? 0.095 : 0.105));
  ctx.font = `700 ${nameSize}px ${LABEL_FONT}`;
  const nameLines = wrapText(ctx, input.equipamento || "—", mainW, 2);
  for (const line of nameLines) {
    ctx.fillText(line, mainX, y, mainW);
    y += Math.round(nameSize * 1.1);
  }
  y += Math.round(size.hPx * 0.02);

  // Grid compacto SERVIÇO / EXEC / PRÓX (só linhas aplicáveis; fallback chips)
  const planosSet = new Set(input.planos);
  const activeRows = GRID_ROWS.filter((r) => planosSet.has(r.id));
  if (activeRows.length > 0 && mainW >= 90) {
    y = drawServiceGrid(ctx, {
      x: mainX,
      y,
      w: mainW,
      h: size.hPx - y - pad,
      rows: activeRows,
      realizacao: input.realizacaoLabel,
      proxima: input.proximaLabel,
      compact: isCompact,
    });
  } else {
    // Fallback: chips pretos se o miolo for estreito (40×30)
    const chips = chipLabels(input.planos);
    const chipH = Math.round(size.hPx * 0.13);
    const chipFont = Math.round(chipH * 0.52);
    ctx.font = `700 ${chipFont}px ${LABEL_FONT}`;
    ctx.textBaseline = "middle";
    let chipX = mainX;
    for (const chip of chips) {
      const tw = ctx.measureText(chip).width;
      const cw = Math.ceil(tw + 8);
      if (chipX + cw > mainX + mainW) break;
      ctx.fillStyle = "#000000";
      roundRect(ctx, chipX, y, cw, chipH, 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(chip, chipX + 4, y + chipH / 2);
      chipX += cw + 3;
    }
    ctx.fillStyle = "#000000";
    y += chipH + Math.round(size.hPx * 0.04);
    ctx.textBaseline = "top";
    const dateSize = Math.round(size.hPx * 0.085);
    ctx.font = `600 ${dateSize}px ${LABEL_FONT}`;
    ctx.fillText(`Realiz. ${input.realizacaoLabel}`, mainX, y, mainW);
    y += Math.round(dateSize * 1.18);
    ctx.fillText(`Próx. ${input.proximaLabel}`, mainX, y, mainW);
  }

  // ——— Coluna direita: QR + bloco contato ———
  const rightX = size.wPx - pad - rightColW;
  const qrX = rightX + Math.round((rightColW - qrSide) / 2);
  const qrY = pad;

  const qrDataUrl = await QRCode.toDataURL(input.qrUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: qrSide * 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSide, qrSide);

  // Bloco preto de contato sob o QR
  const contactY = Math.max(qrY + qrSide + 2, size.hPx - pad - contactH);
  const contactBoxH = size.hPx - pad - contactY;
  ctx.fillStyle = "#000000";
  ctx.fillRect(rightX, contactY, rightColW, contactBoxH);

  const site = formatSite(input.site);
  const tel = (input.telefone ?? "").trim() || "(16) 3030-0445";
  const contactPad = 3;
  const telSize = Math.round(Math.min(contactBoxH * 0.32, rightColW * 0.14));
  const siteSize = Math.round(Math.min(contactBoxH * 0.26, rightColW * 0.11));
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${telSize}px ${LABEL_FONT}`;
  ctx.fillText(tel, rightX + rightColW / 2, contactY + contactBoxH * 0.38, rightColW - contactPad * 2);
  ctx.font = `600 ${siteSize}px ${LABEL_FONT}`;
  ctx.fillText(site, rightX + rightColW / 2, contactY + contactBoxH * 0.72, rightColW - contactPad * 2);

  // Moldura
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size.wPx - 1, size.hPx - 1);
}

type Box = { x: number; y: number; w: number; h: number; pad: number };

/** Faixa branca esquerda: logo Aion (ícone + AION / ENGENHARIA) rotacionado −90°. */
async function drawLeftBrandStrip(
  ctx: CanvasRenderingContext2D,
  input: LabelRenderInput,
  box: Box,
) {
  const { x, y, w, h, pad } = box;
  const cx = x + w / 2;
  const usableH = h - pad * 2;

  try {
    const logo = await loadImage(input.logoUrl);
    // Após −90°: espessura ≈ drawH (largura da faixa); comprimento vertical ≈ drawW
    const drawH = Math.max(14, w - 4);
    const natRatio = logo.naturalWidth / Math.max(1, logo.naturalHeight);
    let drawW = Math.round(drawH * natRatio);
    const maxLen = usableH - 2;
    if (drawW > maxLen) drawW = maxLen;

    ctx.save();
    ctx.translate(cx, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    drawLogoThreshold(ctx, logo, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  } catch {
    // Fallback tipográfico: AION / ENGENHARIA deitados
    ctx.save();
    ctx.translate(cx, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const aionSize = Math.round(w * 0.55);
    ctx.font = `800 ${aionSize}px ${LABEL_FONT}`;
    ctx.fillText("AION", 0, -aionSize * 0.15);
    ctx.font = `600 ${Math.round(aionSize * 0.42)}px ${LABEL_FONT}`;
    ctx.fillText("ENGENHARIA", 0, aionSize * 0.55);
    ctx.restore();
  }
}

/** Faixa preta com TAG em branco, rotacionada −90° (baixo→cima). */
function drawTagBand(ctx: CanvasRenderingContext2D, input: LabelRenderInput, box: Box) {
  const { x, y, w, h, pad } = box;
  ctx.fillStyle = "#000000";
  ctx.fillRect(x, y, w, h);

  const tag = truncate(input.tag.trim() || "—", 16);
  const tagFont = Math.round(Math.min(w * 0.62, 20));
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${tagFont}px ${LABEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, 0, 0, h - pad * 2 - 4);
  ctx.restore();
}

/**
 * Mini-tabela térmica: cabeçalhos SERVIÇO / EXEC / PRÓX + linhas dos planos ativos.
 * Retorna o Y final após o grid.
 */
function drawServiceGrid(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    rows: { id: PlanoEtiqueta; label: string }[];
    realizacao: string;
    proxima: string;
    compact: boolean;
  },
): number {
  const { x, y, w, rows, realizacao, proxima, compact } = opts;
  const headerH = compact ? 28 : 34;
  const rowH = Math.min(
    Math.floor((opts.h - headerH - 2) / Math.max(1, rows.length)),
    compact ? 28 : 34,
  );
  const colSvc = Math.round(w * 0.28);
  const colExec = Math.round(w * 0.36);
  const colProx = w - colSvc - colExec;
  const fontHdr = Math.round(compact ? 8 : 9);
  const fontCell = Math.round(compact ? 11 : 12);

  // Cabeçalho
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, headerH + rowH * rows.length - 1);

  // Separadores verticais
  ctx.beginPath();
  ctx.moveTo(x + colSvc + 0.5, y);
  ctx.lineTo(x + colSvc + 0.5, y + headerH + rowH * rows.length);
  ctx.moveTo(x + colSvc + colExec + 0.5, y);
  ctx.lineTo(x + colSvc + colExec + 0.5, y + headerH + rowH * rows.length);
  ctx.stroke();

  // Separador sob cabeçalho
  ctx.beginPath();
  ctx.moveTo(x, y + headerH + 0.5);
  ctx.lineTo(x + w, y + headerH + 0.5);
  ctx.stroke();

  // Labels do cabeçalho (rotacionados +90° / topo→baixo, como na foto)
  const headers = [
    { label: "SERVIÇO", cx: x + colSvc / 2 },
    { label: "EXEC", cx: x + colSvc + colExec / 2 },
    { label: "PRÓX", cx: x + colSvc + colExec + colProx / 2 },
  ];
  for (const h of headers) {
    ctx.save();
    ctx.translate(h.cx, y + headerH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#000000";
    ctx.font = `700 ${fontHdr}px ${LABEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(h.label, 0, 0);
    ctx.restore();
  }

  // Linhas de dados
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  rows.forEach((row, i) => {
    const ry = y + headerH + i * rowH;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(x, ry + 0.5);
      ctx.lineTo(x + w, ry + 0.5);
      ctx.stroke();
    }
    // Chip preto no rótulo do serviço
    ctx.font = `800 ${fontCell}px ${LABEL_FONT}`;
    const tw = ctx.measureText(row.label).width;
    const chipW = Math.min(colSvc - 6, Math.ceil(tw + 8));
    const chipH = Math.min(rowH - 6, fontCell + 8);
    const chipX = x + (colSvc - chipW) / 2;
    const chipY = ry + (rowH - chipH) / 2;
    ctx.fillStyle = "#000000";
    roundRect(ctx, chipX, chipY, chipW, chipH, 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(row.label, x + colSvc / 2, ry + rowH / 2);

    ctx.fillStyle = "#000000";
    ctx.font = `700 ${fontCell}px ${LABEL_FONT}`;
    ctx.fillText(shortDate(realizacao), x + colSvc + colExec / 2, ry + rowH / 2, colExec - 4);
    ctx.fillText(shortDate(proxima), x + colSvc + colExec + colProx / 2, ry + rowH / 2, colProx - 4);
  });

  return y + headerH + rowH * rows.length;
}

/** Compacta MM/AAAA ou DD/MM/AAAA → MM/AA quando couber melhor na célula. */
function shortDate(label: string): string {
  const t = label.trim();
  if (!t || t === "—") return "—";
  // DD/MM/AAAA
  const full = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (full) return `${full[2]}/${full[3]!.slice(2)}`;
  // MM/AAAA
  const my = /^(\d{2})\/(\d{4})$/.exec(t);
  if (my) return `${my[1]}/${my[2]!.slice(2)}`;
  return t;
}

function formatSite(site: string): string {
  const s = (site || "www.aion.eng.br").trim().replace(/^https?:\/\//i, "");
  if (s.startsWith("www.")) return s;
  // Preferir www. no bloco de contato (como na etiqueta física)
  if (s === "aion.eng.br") return "www.aion.eng.br";
  return s;
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
    if (ctx.measureText(trial).width <= maxW || !current) {
      current = trial;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);

  const out = lines.slice(0, maxLines);
  const lastIdx = out.length - 1;
  if (lastIdx >= 0) {
    let last = out[lastIdx]!;
    if (ctx.measureText(last).width > maxW || words.join(" ").length > out.join(" ").length) {
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) {
        last = last.slice(0, -1);
      }
      out[lastIdx] = last.endsWith("…") ? last : `${last}…`;
    }
  }
  return out;
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
