import QRCode from "qrcode";
import {
  LABEL_KIT_DESIGN_PX,
  LABEL_SIZES_B1,
  type LabelRenderInput,
  type LabelSizePx,
  type PlanoEtiqueta,
} from "./tipos";

/** Fallbacks se next/font ainda não injetou as variáveis CSS. */
const LABEL_FONT_FALLBACK = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const BRAND_FONT_FALLBACK = 'Montserrat, "Barlow Condensed", Arial, sans-serif';

/** Resolve família do next/font (variável CSS) para o canvas 2D. */
function labelFontStack(): string {
  if (typeof document === "undefined") return LABEL_FONT_FALLBACK;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-barlow-condensed")
    .trim();
  return v ? `${v}, ${LABEL_FONT_FALLBACK}` : LABEL_FONT_FALLBACK;
}

function brandFontStack(): string {
  if (typeof document === "undefined") return BRAND_FONT_FALLBACK;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-montserrat")
    .trim();
  return v ? `${v}, ${BRAND_FONT_FALLBACK}` : BRAND_FONT_FALLBACK;
}

/** Caixas de status impressas (sempre as três; ativas = sólidas + check). */
const STATUS_BOXES: { id: PlanoEtiqueta; label: string }[] = [
  { id: "preventiva", label: "M.P" },
  { id: "calibracao", label: "CAL." },
  { id: "tse", label: "T.S.E" },
];

/**
 * Layout 50×30 — kit oficial AION (coordenadas de desenho 400×240):
 *
 *  ┌──────┬────────────────────────────────────┐
 *  │AION  │ EQUIP. Nº              HSJ-00001   │
 *  │ENG.  │ NOME DO EQUIPAMENTO…               │
 *  │  ○A  │ ────────────────────────────────── │
 *  │      │ REALIZADO      07/26    ┌──────┐   │
 *  │      │ [PRÓXIMO       07/27]   │  QR  │   │
 *  │      │ [✓ M.P]  [✓ CAL.] …     │      │   │
 *  │      │ tel · site              VOID…  │   │
 *  └──────┴────────────────────────────────────┘
 *
 * Coordenadas do kit em 400×240; bitmap B1 = 384×240 (cabeçote) com escala X.
 * - mode "print": 203 dpi 1:1 no wPx/hPx da geometria (384×240 na 50×30).
 * - mode "preview": backing store = caixa CSS × devicePixelRatio.
 */
export type DrawLabelMode = "print" | "preview";

export type DrawLabelOptions = {
  /** Default `"print"`. Preview usa DPR; print permanece 203 dpi 1:1. */
  mode?: DrawLabelMode;
  /** Override de DPR (testes). Só aplica em mode `"preview"`. */
  devicePixelRatio?: number;
};

/**
 * Escala de exibição do mockup: 1 mm ≈ N px CSS (mantém proporção 50:30).
 * 8 → 50×30 mm = 400×240 CSS (igual ao pt do print); com DPR 2 ≈ kit HTML 800×480.
 */
export const LABEL_PREVIEW_PX_PER_MM = 8;

/** Dimensões do bitmap e escala lógica→físico (print 1:1 vs preview CSS×DPR). */
export function resolveLabelCanvasBackingStore(
  size: LabelSizePx,
  mode: DrawLabelMode,
  opts?: { cssW?: number; cssH?: number; devicePixelRatio?: number },
): { width: number; height: number; mapX: number; mapY: number; smooth: boolean } {
  if (mode === "preview") {
    const fallbackW = size.wMm * LABEL_PREVIEW_PX_PER_MM;
    const fallbackH = size.hMm * LABEL_PREVIEW_PX_PER_MM;
    const cssW = opts?.cssW && opts.cssW > 0 ? opts.cssW : fallbackW;
    const cssH = opts?.cssH && opts.cssH > 0 ? opts.cssH : fallbackH;
    const dpr = opts?.devicePixelRatio && opts.devicePixelRatio > 0 ? opts.devicePixelRatio : 1;
    // CSS×DPR, com piso 2× o bitmap de impressão (kit HTML 800×480) — coluna estreita
    // não pode deixar a prévia mais pobre que o mock oficial.
    const width = Math.max(1, Math.round(cssW * dpr), size.wPx * 2);
    const height = Math.max(1, Math.round(cssH * dpr), size.hPx * 2);
    return {
      width,
      height,
      mapX: width / size.wPx,
      mapY: height / size.hPx,
      smooth: true,
    };
  }
  return {
    width: size.wPx,
    height: size.hPx,
    mapX: 1,
    mapY: 1,
    smooth: false,
  };
}

export async function drawLabelToCanvas(
  canvas: HTMLCanvasElement,
  input: LabelRenderInput,
  options?: DrawLabelOptions,
): Promise<void> {
  const { size } = input;
  const mode: DrawLabelMode = options?.mode ?? "print";

  const dpr =
    options?.devicePixelRatio ??
    (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const parent = canvas.parentElement;
  const backing = resolveLabelCanvasBackingStore(size, mode, {
    cssW: canvas.clientWidth || parent?.clientWidth || 0,
    cssH: canvas.clientHeight || parent?.clientHeight || 0,
    devicePixelRatio: mode === "preview" ? dpr : 1,
  });

  // Dimensionar antes de await(fonts) — senão um load lento deixa o canvas no default 300×150.
  canvas.width = backing.width;
  canvas.height = backing.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");

  ctx.setTransform(backing.mapX, 0, 0, backing.mapY, 0, 0);
  ctx.imageSmoothingEnabled = backing.smooth;
  if (backing.smooth) {
    try {
      ctx.imageSmoothingQuality = "high";
    } catch {
      // browsers antigos
    }
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.wPx, size.hPx);

  await ensureLabelFonts();
  // Reaplicar transform (por segurança) e limpar antes do kit com fontes prontas.
  ctx.setTransform(backing.mapX, 0, 0, backing.mapY, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.wPx, size.hPx);

  const kitW = LABEL_KIT_DESIGN_PX.w;
  const kitH = LABEL_KIT_DESIGN_PX.h;
  if (size.wPx === kitW && size.hPx === kitH) {
    await drawKit50x30(ctx, input);
    return;
  }

  // B1 50×30 (384×240), 40×30, etc.: escala proporcional do kit 400×240
  const scaleX = size.wPx / kitW;
  const scaleY = size.hPx / kitH;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  await drawKit50x30(ctx, {
    ...input,
    size: { ...size, wPx: kitW, hPx: kitH, id: "50x30" },
  });
  ctx.restore();
}

/** Mockup de tela: layout idêntico ao print, resolução do backing store = CSS × DPR. */
export async function drawLabelPreviewToCanvas(
  canvas: HTMLCanvasElement,
  input: LabelRenderInput,
  options?: Omit<DrawLabelOptions, "mode">,
): Promise<void> {
  return drawLabelToCanvas(canvas, input, { ...options, mode: "preview" });
}

async function drawKit50x30(ctx: CanvasRenderingContext2D, input: LabelRenderInput) {
  const font = labelFontStack();

  // ——— Faixa da marca (x 0–85) ———
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 85, 240);
  drawSpineBrand(ctx);

  // ——— Header: EQUIP. Nº + TAG menor + nome do equipamento ———
  // Linha 1: rótulo à esquerda, TAG ~30 pt à direita (antes 47 pt — liberava espaço).
  // Linha 2: nome do equipamento (truncado à largura útil).
  const tag = truncate(input.tag.trim() || "—", 16);
  const nomeEq = (input.equipamento ?? "").trim() || "—";

  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  // Texto pequeno: ≥12 pt, tracking 0, stroke+fill (hastes mais grossas no 203 dpi)
  ctx.font = `800 12px ${font}`;
  fillTextSpaced(ctx, "EQUIP. Nº", 97, 8, 0);

  ctx.font = `800 30px ${font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  fillThermalText(ctx, tag, 378, 22, 200);

  ctx.font = `800 15px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const nomeFit = fitTextWidth(ctx, nomeEq.toLocaleUpperCase("pt-BR"), 281);
  fillThermalText(ctx, nomeFit, 97, 44, 281);

  // Linha 2 pt sob o header
  ctx.fillStyle = "#000000";
  ctx.fillRect(97, 56, 281, 2);

  // ——— REALIZADO (x 97–235, y 70–94) ———
  const realizacao = shortDate(input.realizacaoLabel);
  const proxima = shortDate(input.proximaLabel);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 12px ${font}`;
  fillTextSpaced(ctx, "REALIZADO", 97, 82, 0);
  ctx.font = `800 22px ${font}`;
  ctx.textAlign = "right";
  fillThermalText(ctx, realizacao, 235, 82, 80);
  ctx.fillRect(97, 93, 138, 1);

  // ——— PRÓXIMO (x 97–235, y 97–127) ———
  roundRect(ctx, 97, 97, 138, 30, 6);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 12px ${font}`;
  fillTextSpaced(ctx, "PRÓXIMO", 107, 112, 0);
  ctx.font = `800 26px ${font}`;
  ctx.textAlign = "right";
  fillThermalText(ctx, proxima, 227, 112, 70);

  // ——— Testes M.P / CAL. / T.S.E (x 97–235, y 137–207) ———
  const planosSet = new Set(input.planos);
  const chipCount = STATUS_BOXES.length;
  const chipGap = 3;
  const areaH = 207 - 137; // 70
  const chipH = Math.min(22, Math.floor((areaH - chipGap * (chipCount - 1)) / chipCount));
  let chipY = 137;
  for (const row of STATUS_BOXES) {
    drawStatusChip(ctx, {
      x: 97,
      y: chipY,
      w: 138,
      h: chipH,
      label: row.label,
      active: planosSet.has(row.id),
      font,
    });
    chipY += chipH + chipGap;
  }

  // ——— Contato (x 97–235, y 220–230) ———
  const tel = (input.telefone ?? "").trim() || "(16) 3030-0445";
  const site = formatSite(input.site);
  ctx.fillStyle = "#000000";
  ctx.font = `800 13px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  fillThermalText(ctx, `${tel} · ${site}`, 97, 225, 138);

  // ——— QR (x 242–378, y 70–206) 136×136 — cabe no cabeçote 384 com folga ———
  await drawCrispQr(ctx, input.qrUrl, 242, 70, 136);

  // ——— Lacre sob o QR ———
  ctx.fillStyle = "#000000";
  ctx.font = `800 11px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextSpaced(ctx, "VOID IF SEAL IS BROKEN", 242 + 136 / 2, 225, 0);
}

/** Logo AION + ENGENHARIA na faixa preta, −90° (lê de baixo para cima), 210 pt. */
function drawSpineBrand(ctx: CanvasRenderingContext2D) {
  // viewBox 214×68 do kit, escalado para ~210×66,5 e centrado na faixa 85×240
  const brandW = 210;
  const brandH = 66.5;
  const cx = 85 / 2;
  const cy = 240 / 2;
  const sx = brandW / 214;
  const sy = brandH / 68;
  const brand = brandFontStack();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.translate(-brandW / 2, -brandH / 2);
  ctx.scale(sx, sy);

  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  try {
    ctx.stroke(new Path2D("M54.45 15 A28 28 0 1 1 40.25 5.95"));
    ctx.stroke(new Path2D("M22 47 L33 20 L44 47 M27 38 H39"));
  } catch {
    // Path2D indisponível — só tipografia
  }
  ctx.beginPath();
  ctx.arc(48.25, 9.52, 3.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 40px ${brand}`;
  ctx.fillText("AION", 74, 44);
  ctx.font = `600 10px ${brand}`;
  ctx.fillText("ENGENHARIA", 75, 61);
  ctx.restore();
}

function drawStatusChip(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    active: boolean;
    font: string;
  },
) {
  const { x, y, w, h, label, active, font } = opts;
  const r = 5;
  const check = 13;
  const checkX = x + 8;
  const checkY = y + (h - check) / 2;

  ctx.save();
  ctx.strokeStyle = "#000000";
  if (active) {
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
    ctx.stroke();

    // Checkbox preto + ✓ branco
    roundRect(ctx, checkX, checkY, check, check, 3);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(checkX + check * 0.22, checkY + check * 0.52);
    ctx.lineTo(checkX + check * 0.42, checkY + check * 0.72);
    ctx.lineTo(checkX + check * 0.78, checkY + check * 0.28);
    ctx.stroke();

    ctx.fillStyle = "#000000";
    ctx.font = `800 15px ${font}`;
  } else {
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.setLineDash([]);

    // Checkbox vazio (contorno 2 pt)
    ctx.lineWidth = 2;
    roundRect(ctx, checkX, checkY, check, check, 3);
    ctx.stroke();

    ctx.fillStyle = "#000000";
    ctx.font = `600 15px ${font}`;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  fillThermalText(ctx, label, checkX + check + 8, y + h / 2);
  ctx.restore();
}

/** QR com módulo inteiro de pontos (preferência 5 pt = V3); ECC M. */
async function drawCrispQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  box: number,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, box, box);

  try {
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    const modules = qr.modules;
    const n = modules.size;
    let modulePt = 5;
    if (modulePt * n > box) {
      modulePt = Math.max(1, Math.floor(box / n));
    }
    const qrSize = modulePt * n;
    const ox = x + Math.floor((box - qrSize) / 2);
    const oy = y + Math.floor((box - qrSize) / 2);
    ctx.fillStyle = "#000000";
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (modules.get(row, col)) {
          ctx.fillRect(ox + col * modulePt, oy + row * modulePt, modulePt, modulePt);
        }
      }
    }
    return;
  } catch {
    // Fallback: raster do helper qrcode (menos nítido, mas sempre desenha)
  }

  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: box * 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("QR image fail"));
    el.src = dataUrl;
  });
  ctx.drawImage(img, x, y, box, box);
}

let fontsReady: Promise<void> | null = null;

function ensureLabelFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontsReady) return fontsReady;
  fontsReady = new Promise<void>((resolve) => {
    const done = () => resolve();
    const timer = setTimeout(done, 800);
    try {
      if (!document.fonts?.load) {
        clearTimeout(timer);
        done();
        return;
      }
      const font = labelFontStack();
      const brand = brandFontStack();
      // loads pode rejeitar (NetworkError no headless/offline)
      void Promise.all([
        document.fonts.load(`600 10px ${font}`),
        document.fonts.load(`700 21px ${font}`),
        document.fonts.load(`800 47px ${font}`),
        document.fonts.load(`800 40px ${brand}`),
        document.fonts.load(`600 10px ${brand}`),
      ]).then(
        () => {
          clearTimeout(timer);
          done();
        },
        () => {
          clearTimeout(timer);
          done();
        },
      );
    } catch {
      clearTimeout(timer);
      done();
    }
  });
  return fontsReady;
}

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Corta com reticências para caber em `maxWidth` pt (usa measureText do canvas). */
function fitTextWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const t = text.trim();
  if (!t) return "—";
  if (ctx.measureText(t).width <= maxWidth) return t;
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${t.slice(0, mid)}…`;
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo <= 0 ? "…" : `${t.slice(0, lo)}…`;
}

/** Compacta MM/AAAA ou DD/MM/AAAA → MM/AA. */
function shortDate(label: string): string {
  const t = label.trim();
  if (!t || t === "—") return "—";
  const full = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (full) return `${full[2]}/${full[3]!.slice(2)}`;
  const my = /^(\d{2})\/(\d{4})$/.exec(t);
  if (my) return `${my[1]}/${my[2]!.slice(2)}`;
  const short = /^(\d{2})\/(\d{2})$/.exec(t);
  if (short) return t;
  return t;
}

/** Site do rodapé — aion.eng.br (sem www), como no kit. */
function formatSite(site: string): string {
  const s = (site || "aion.eng.br").trim().replace(/^https?:\/\//i, "");
  if (s.startsWith("www.")) return s.slice(4);
  return s || "aion.eng.br";
}

/**
 * Texto para térmico: stroke leve + fill engrossa hastes (antialias vira bloco preto no limiar).
 * `maxWidth` opcional — mesmo contrato do fillText.
 */
function fillThermalText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth?: number,
) {
  const xPt = Math.round(x);
  const yPt = Math.round(y);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = ctx.fillStyle;
  if (maxWidth != null) {
    ctx.strokeText(text, xPt, yPt, maxWidth);
    ctx.fillText(text, xPt, yPt, maxWidth);
  } else {
    ctx.strokeText(text, xPt, yPt);
    ctx.fillText(text, xPt, yPt);
  }
  ctx.restore();
}

/** Letter-spacing aproximado (pt). Preferir tracking 0 em rótulos pequenos. */
function fillTextSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
) {
  const align = ctx.textAlign;
  const baseline = ctx.textBaseline;
  let total = 0;
  const widths: number[] = [];
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    widths.push(w);
    total += w;
  }
  total += tracking * Math.max(0, text.length - 1);

  let cursor = x;
  if (align === "center") cursor = x - total / 2;
  else if (align === "right" || align === "end") cursor = x - total;

  const prevAlign = ctx.textAlign;
  const prevFill = ctx.fillStyle;
  ctx.textAlign = "left";
  ctx.textBaseline = baseline;
  const yPt = Math.round(y);
  for (let i = 0; i < text.length; i++) {
    ctx.fillStyle = prevFill;
    fillThermalText(ctx, text[i]!, Math.round(cursor), yPt);
    cursor += (widths[i] ?? 0) + tracking;
  }
  ctx.textAlign = prevAlign;
  ctx.fillStyle = prevFill;
}

/** Limiar / voto padrão do PNG de impressão (mais agressivo = hastes mais grossas). */
export const LABEL_PRINT_THRESHOLD = 190;
export const LABEL_PRINT_DARK_RATIO = 0.18;

/** Aplica limiar 1-bit in-place em buffer RGBA. */
export function hardenRgbaTo1Bit(
  data: Uint8ClampedArray,
  threshold = LABEL_PRINT_THRESHOLD,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    const v = lum < threshold ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
}

/**
 * Força bitmap 1-bit puro (sem cinza do antialias).
 * Limiar alto engrossa traços finos — melhor legibilidade na B1 203 dpi.
 */
export function hardenCanvasTo1Bit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  threshold = LABEL_PRINT_THRESHOLD,
): void {
  const img = ctx.getImageData(0, 0, w, h);
  hardenRgbaTo1Bit(img.data, threshold);
  ctx.putImageData(img, 0, 0);
}

/** Downsample RGBA → RGBA 1-bit por voto de escuridão (puro, testável sem DOM). */
export function downsampleRgbaThreshold(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  opts?: { threshold?: number; darkRatio?: number },
): Uint8ClampedArray {
  if (dw <= 0 || dh <= 0 || sw < dw || sh < dh) {
    throw new Error("downsampleRgbaThreshold: dimensões inválidas");
  }
  const sx = sw / dw;
  const sy = sh / dh;
  const threshold = opts?.threshold ?? LABEL_PRINT_THRESHOLD;
  const darkRatio = opts?.darkRatio ?? LABEL_PRINT_DARK_RATIO;
  const out = new Uint8ClampedArray(dw * dh * 4);

  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(sh, Math.floor((y + 1) * sy));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(sw, Math.floor((x + 1) * sx));
      let dark = 0;
      let total = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) * 4;
          const lum = 0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
          if (lum < threshold) dark += 1;
          total += 1;
        }
      }
      const v = total > 0 && dark / total >= darkRatio ? 0 : 255;
      const o = (y * dw + x) * 4;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Reduz `src` para o destino com voto de escuridão.
 * Bloco com ≥ `darkRatio` pixels escuros → preto (preserva hastes finas do texto).
 */
export function downsampleThreshold(
  src: HTMLCanvasElement,
  dest: HTMLCanvasElement,
  opts?: { threshold?: number; darkRatio?: number },
): void {
  const dw = dest.width;
  const dh = dest.height;
  const sw = src.width;
  const sh = src.height;
  const sctx = src.getContext("2d");
  const dctx = dest.getContext("2d");
  if (!sctx || !dctx) throw new Error("Canvas 2D indisponível");

  const srcData = sctx.getImageData(0, 0, sw, sh).data;
  const pixels = downsampleRgbaThreshold(srcData, sw, sh, dw, dh, opts);
  const out = dctx.createImageData(dw, dh);
  out.data.set(pixels);
  dctx.putImageData(out, 0, 0);
}

/** Fator de supersampling do PNG de impressão (3× kit → downsample 1-bit). */
export const LABEL_PRINT_SUPERSAMPLE = 3;

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

/**
 * PNG 1-bit para B1 / download.
 * Pipeline: kit em 3× → downsample com limiar agressivo → cabeçote (ex. 384×240).
 * Stroke+fill no desenho + voto de escuridão engrossam letras pequenas no térmico.
 */
export async function labelToPngDataUrl(
  input: LabelRenderInput,
  canvas?: HTMLCanvasElement,
): Promise<string> {
  const size = input.size;
  const ss = LABEL_PRINT_SUPERSAMPLE;
  const kitW = LABEL_KIT_DESIGN_PX.w;
  const kitH = LABEL_KIT_DESIGN_PX.h;
  const thr = LABEL_PRINT_THRESHOLD;
  const ratio = LABEL_PRINT_DARK_RATIO;

  const hi = document.createElement("canvas");
  hi.width = kitW * ss;
  hi.height = kitH * ss;
  const hiCtx = hi.getContext("2d");
  if (!hiCtx) throw new Error("Canvas 2D indisponível");

  hiCtx.setTransform(ss, 0, 0, ss, 0, 0);
  hiCtx.imageSmoothingEnabled = false;
  hiCtx.fillStyle = "#ffffff";
  hiCtx.fillRect(0, 0, kitW, kitH);
  await ensureLabelFonts();
  hiCtx.setTransform(ss, 0, 0, ss, 0, 0);
  hiCtx.imageSmoothingEnabled = false;
  hiCtx.fillStyle = "#ffffff";
  hiCtx.fillRect(0, 0, kitW, kitH);
  await drawKit50x30(hiCtx, {
    ...input,
    size: { ...size, wPx: kitW, hPx: kitH, id: "50x30" },
  });

  // 1200×720 → 400×240 (bloco 3×3, voto de escuridão)
  const mid = document.createElement("canvas");
  mid.width = kitW;
  mid.height = kitH;
  downsampleThreshold(hi, mid, { threshold: thr, darkRatio: ratio });

  const el = canvas ?? document.createElement("canvas");
  el.width = size.wPx;
  el.height = size.hPx;
  if (size.wPx === kitW && size.hPx === kitH) {
    const ctx = el.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível");
    ctx.drawImage(mid, 0, 0);
    hardenCanvasTo1Bit(ctx, el.width, el.height, thr);
  } else {
    // 400×240 → 384×240 (ou 40×30)
    downsampleThreshold(mid, el, { threshold: thr, darkRatio: Math.max(ratio, 0.2) });
  }

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
