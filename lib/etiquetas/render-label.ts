import QRCode from "qrcode";
import { LABEL_SIZES_B1, type LabelRenderInput, type LabelSizePx, type PlanoEtiqueta } from "./tipos";

/** Família legível em 203 dpi (Outfit já carrega no app; fallbacks limpos). */
const LABEL_FONT = 'Outfit, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Caixas de status impressas (sempre as três; ativas = sólidas + check). */
const STATUS_BOXES: { id: PlanoEtiqueta; label: string }[] = [
  { id: "preventiva", label: "M.P" },
  { id: "calibracao", label: "CAL." },
  { id: "tse", label: "T.S.E" },
];

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Layout 50×30 (384×240 @ 203 dpi) — kit HTML / mock Aion (screenshots):
 *
 *  ┌──────┬────────────────────────────────────┐
 *  │AION  │ EQUIP. Nº              HSJ-00001   │
 *  │ENG.  │ ────────────────────────────────── │
 *  │  ○A  │ REALIZADO 07/26         ┌──────┐   │
 *  │      │ [PRÓXIMO 07/27]         │  QR  │   │
 *  │      │ [✓ M.P] [✓ CAL.] […]    │      │   │
 *  │      │ tel · site              VOID…  │   │
 *  └──────┴────────────────────────────────────┘
 *
 * Coluna preta: AION + ENGENHARIA (baixo→cima) + marca circular.
 * Miolo: TAG grande, datas, caixas M.P/CAL./T.S.E, QR Effort, rodapé.
 * Sem “HSJ · Eng. Clínica”. Mesmo canvas do mockup e da impressão B1 (WYSIWYG).
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
  const spineW = isCompact ? 44 : 56;
  const pad = isCompact ? 5 : 7;
  const gap = isCompact ? 4 : 6;

  await drawBlackSpine(ctx, input, {
    x: 0,
    y: 0,
    w: spineW,
    h: size.hPx,
    pad: 4,
    compact: isCompact,
  });

  const mainX = spineW + pad;
  const mainRight = size.wPx - pad;
  const mainW = mainRight - mainX;

  // ——— Header: EQUIP. Nº + TAG ———
  const headerH = isCompact ? 34 : 40;
  const tag = truncate(input.tag.trim() || "—", 16);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const equipFont = Math.round(isCompact ? 8 : 9);
  ctx.font = `700 ${equipFont}px ${LABEL_FONT}`;
  ctx.fillText("EQUIP.", mainX, pad + 2);
  ctx.fillText("Nº", mainX, pad + 2 + equipFont + 1);

  const tagFont = Math.round(
    Math.min(isCompact ? 20 : 24, mainW * (isCompact ? 0.22 : 0.2)),
  );
  ctx.font = `800 ${tagFont}px ${LABEL_FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, mainRight, pad + headerH / 2 - 1, mainW * 0.72);

  // Hairline sob o header
  const ruleY = pad + headerH;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mainX, ruleY + 0.5);
  ctx.lineTo(mainRight, ruleY + 0.5);
  ctx.stroke();

  // ——— Coluna direita: QR + VOID ———
  const voidH = isCompact ? 10 : 12;
  const contentTop = ruleY + gap;
  const footerH = isCompact ? 12 : 14;
  const contentBottom = size.hPx - pad - footerH;
  const qrMax = Math.min(
    contentBottom - contentTop - voidH - 2,
    Math.round(mainW * (isCompact ? 0.42 : 0.4)),
  );
  const qrSide = Math.max(72, qrMax);
  const qrX = mainRight - qrSide;
  const qrY = contentTop;

  const qrDataUrl = await QRCode.toDataURL(input.qrUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: qrSide * 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSide, qrSide);

  ctx.fillStyle = "#000000";
  ctx.font = `700 ${Math.round(isCompact ? 6.5 : 7.5)}px ${LABEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("VOID IF SEAL IS BROKEN", qrX + qrSide / 2, qrY + qrSide + 2, qrSide + 4);

  // ——— Coluna esquerda do miolo: datas + status ———
  const leftW = Math.max(48, qrX - gap - mainX);
  let y = contentTop;

  const realizacao = shortDate(input.realizacaoLabel);
  const proxima = shortDate(input.proximaLabel);

  // REALIZADO MM/YY
  const labelSize = Math.round(isCompact ? 8 : 9);
  const dateSize = Math.round(isCompact ? 13 : 15);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  ctx.font = `700 ${labelSize}px ${LABEL_FONT}`;
  const realLabel = "REALIZADO";
  const realLabelW = ctx.measureText(realLabel).width;
  const realRowH = Math.max(dateSize, labelSize) + 2;
  ctx.fillText(realLabel, mainX, y + realRowH / 2);
  ctx.font = `800 ${dateSize}px ${LABEL_FONT}`;
  ctx.fillText(realizacao, mainX + realLabelW + 5, y + realRowH / 2, leftW - realLabelW - 6);
  y += realRowH + 3;

  // Pill PRÓXIMO
  const pillH = Math.round(isCompact ? 18 : 22);
  const pillPadX = isCompact ? 5 : 7;
  ctx.font = `700 ${Math.round(labelSize * 0.95)}px ${LABEL_FONT}`;
  const proxWord = "PRÓXIMO";
  const proxWordW = ctx.measureText(proxWord).width;
  ctx.font = `800 ${dateSize}px ${LABEL_FONT}`;
  const proxDateW = ctx.measureText(proxima).width;
  const pillW = Math.min(leftW, Math.ceil(pillPadX * 2 + proxWordW + 5 + proxDateW));
  ctx.fillStyle = "#000000";
  roundRect(ctx, mainX, y, pillW, pillH, Math.round(pillH * 0.5));
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(labelSize * 0.95)}px ${LABEL_FONT}`;
  ctx.fillText(proxWord, mainX + pillPadX, y + pillH / 2);
  ctx.font = `800 ${dateSize}px ${LABEL_FONT}`;
  ctx.fillText(proxima, mainX + pillPadX + proxWordW + 5, y + pillH / 2);
  y += pillH + (isCompact ? 4 : 6);

  // Caixas M.P / CAL. / T.S.E
  const planosSet = new Set(input.planos);
  const boxGap = isCompact ? 3 : 4;
  const boxesBottom = contentBottom - 2;
  const boxH = Math.min(
    isCompact ? 22 : 26,
    Math.floor((boxesBottom - y - boxGap * 2) / 3),
  );
  const boxW = Math.min(leftW, isCompact ? 72 : 88);
  const boxFont = Math.round(Math.min(boxH * 0.48, isCompact ? 10 : 12));
  const checkSize = Math.round(boxH * 0.48);

  for (const row of STATUS_BOXES) {
    const active = planosSet.has(row.id);
    drawStatusBox(ctx, {
      x: mainX,
      y,
      w: boxW,
      h: boxH,
      label: row.label,
      active,
      fontSize: boxFont,
      checkSize,
    });
    y += boxH + boxGap;
  }

  // Rodapé contato (canto inferior esquerdo do miolo)
  const tel = (input.telefone ?? "").trim() || "(16) 3030-0445";
  const site = formatSite(input.site);
  const contact = `${tel} · ${site}`;
  ctx.fillStyle = "#000000";
  ctx.font = `600 ${Math.round(isCompact ? 7 : 8)}px ${LABEL_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(contact, mainX, size.hPx - pad, mainW);

  // Moldura
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size.wPx - 1, size.hPx - 1);
}

type SpineBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  pad: number;
  compact: boolean;
};

/** Coluna preta: marca circular embaixo + AION / ENGENHARIA (baixo→cima). */
async function drawBlackSpine(
  ctx: CanvasRenderingContext2D,
  input: LabelRenderInput,
  box: SpineBox,
) {
  const { x, y, w, h, pad, compact } = box;
  ctx.fillStyle = "#000000";
  ctx.fillRect(x, y, w, h);

  const logoSize = Math.round(Math.min(w - 8, compact ? 22 : 28));
  const logoCx = x + w / 2;
  const logoCy = y + h - pad - logoSize / 2;

  const markUrl = (input.logoUrl || "").includes("mark")
    ? input.logoUrl
    : "/aion-mark.png";
  try {
    const logo = await loadImage(markUrl);
    drawLogoOnBlack(ctx, logo, logoCx - logoSize / 2, logoCy - logoSize / 2, logoSize, logoSize);
  } catch {
    drawFallbackMark(ctx, logoCx, logoCy, logoSize);
  }

  // Texto vertical acima da marca
  const textBottom = logoCy - logoSize / 2 - 4;
  const textTop = y + pad;
  const textLen = Math.max(24, textBottom - textTop);
  const cx = x + w / 2;
  const cy = textTop + textLen / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const aionSize = Math.round(Math.min(w * 0.48, compact ? 14 : 18));
  const engSize = Math.round(Math.min(w * 0.22, compact ? 7 : 8));
  // No eixo pré-rotação: +Y → direita da faixa (lado do miolo)
  ctx.font = `800 ${aionSize}px ${LABEL_FONT}`;
  ctx.fillText("AION", 0, -aionSize * 0.22, textLen);
  ctx.font = `600 ${engSize}px ${LABEL_FONT}`;
  ctx.fillText("ENGENHARIA", 0, aionSize * 0.42, textLen);
  ctx.restore();
}

function drawStatusBox(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    active: boolean;
    fontSize: number;
    checkSize: number;
  },
) {
  const { x, y, w, h, label, active, fontSize, checkSize } = opts;
  const r = Math.round(h * 0.22);
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.25;
  if (active) {
    ctx.setLineDash([]);
  } else {
    ctx.setLineDash([2.5, 2]);
  }
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
  ctx.setLineDash([]);

  const checkX = x + Math.round(h * 0.22);
  const checkY = y + (h - checkSize) / 2;
  if (active) {
    ctx.fillStyle = "#000000";
    roundRect(ctx, checkX, checkY, checkSize, checkSize, 2);
    ctx.fill();
    // Check branco
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, checkSize * 0.14);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(checkX + checkSize * 0.22, checkY + checkSize * 0.52);
    ctx.lineTo(checkX + checkSize * 0.42, checkY + checkSize * 0.72);
    ctx.lineTo(checkX + checkSize * 0.78, checkY + checkSize * 0.28);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    roundRect(ctx, checkX, checkY, checkSize, checkSize, 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#000000";
  ctx.font = `700 ${fontSize}px ${LABEL_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, checkX + checkSize + 5, y + h / 2);
  ctx.restore();
}

function drawFallbackMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.beginPath();
  ctx.arc(cx, cy, r - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  // Ponto orbital
  const dotR = Math.max(1.2, size * 0.07);
  const ang = -Math.PI / 4;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx + Math.cos(ang) * (r - ctx.lineWidth), cy + Math.sin(ang) * (r - ctx.lineWidth), dotR, 0, Math.PI * 2);
  ctx.fill();
  // A estilizado
  ctx.font = `800 ${Math.round(size * 0.55)}px ${LABEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", cx, cy + size * 0.02);
}

/** Compacta MM/AAAA ou DD/MM/AAAA → MM/AA. */
function shortDate(label: string): string {
  const t = label.trim();
  if (!t || t === "—") return "—";
  const full = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (full) return `${full[2]}/${full[3]!.slice(2)}`;
  const my = /^(\d{2})\/(\d{4})$/.exec(t);
  if (my) return `${my[1]}/${my[2]!.slice(2)}`;
  // Já MM/AA
  const short = /^(\d{2})\/(\d{2})$/.exec(t);
  if (short) return t;
  return t;
}

/** Site do rodapé — preferir aion.eng.br (sem www), como no kit. */
function formatSite(site: string): string {
  const s = (site || "aion.eng.br").trim().replace(/^https?:\/\//i, "");
  if (s.startsWith("www.")) return s.slice(4);
  return s || "aion.eng.br";
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

/** Marca colorida → branco opaco sobre fundo preto (termossensível). */
function drawLogoOnBlack(
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
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    const lum = 0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
    // Pixels da marca (não-brancos) → branco sólido
    const isInk = lum < 245 || a > 200;
    if (isInk && lum < 250) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = 255;
    } else {
      d[i + 3] = 0;
    }
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
