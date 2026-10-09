import QRCode from "qrcode";
import { LABEL_SIZES_B1, type LabelRenderInput, type LabelSizePx, type PlanoEtiqueta } from "./tipos";

/** Kit oficial: Barlow Condensed em todo o texto (LEIA-ME). */
const LABEL_FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
/** Wordmark da faixa: Montserrat (como no SVG do HTML). */
const BRAND_FONT = 'Montserrat, "Barlow Condensed", Arial, sans-serif';

/** Caixas de status impressas (sempre as três; ativas = sólidas + check). */
const STATUS_BOXES: { id: PlanoEtiqueta; label: string }[] = [
  { id: "preventiva", label: "M.P" },
  { id: "calibracao", label: "CAL." },
  { id: "tse", label: "T.S.E" },
];

/**
 * Layout 50×30 (400×240 pt @ 203 dpi) — kit oficial AION (LEIA-ME / etiqueta-aion.html):
 *
 *  ┌──────┬────────────────────────────────────┐
 *  │AION  │ EQUIP. Nº              HSJ-00001   │
 *  │ENG.  │ ────────────────────────────────── │
 *  │  ○A  │ REALIZADO      07/26    ┌──────┐   │
 *  │      │ [PRÓXIMO       07/27]   │  QR  │   │
 *  │      │ [✓ M.P]                 │      │   │
 *  │      │ [✓ CAL.]                │      │   │
 *  │      │ [  T.S.E]               │      │   │
 *  │      │ tel · site              VOID…  │   │
 *  └──────┴────────────────────────────────────┘
 *
 * Coordenadas em pontos (origem canto superior esquerdo). Mesmo canvas do mockup e da B1.
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

  await ensureLabelFonts();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.wPx, size.hPx);
  // Sem antialias em texto/formas onde possível (termossensível 1-bit)
  ctx.imageSmoothingEnabled = false;

  if (size.id === "50x30" && size.wPx === 400 && size.hPx === 240) {
    await drawKit50x30(ctx, input);
    return;
  }

  // 40×30 (e outros): escala proporcional do kit 400×240
  const scaleX = size.wPx / 400;
  const scaleY = size.hPx / 240;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  await drawKit50x30(ctx, { ...input, size: { ...size, wPx: 400, hPx: 240, id: "50x30" } });
  ctx.restore();
}

async function drawKit50x30(ctx: CanvasRenderingContext2D, input: LabelRenderInput) {
  // ——— Faixa da marca (x 0–85) ———
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 85, 240);
  await drawSpineBrand(ctx);

  // ——— ID: EQUIP. Nº + TAG (x 97–390, y 8–60) ———
  const tag = truncate(input.tag.trim() || "—", 16);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 10px ${LABEL_FONT}`;
  fillTextSpaced(ctx, "EQUIP.", 97, 14, 1.5);
  fillTextSpaced(ctx, "Nº", 97, 26, 1.5);

  ctx.font = `800 47px ${LABEL_FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, 390, 34, 280);

  // Linha 3 pt sob o header
  ctx.fillStyle = "#000000";
  ctx.fillRect(97, 57, 293, 3);

  // ——— REALIZADO (x 97–235, y 70–94) ———
  const realizacao = shortDate(input.realizacaoLabel);
  const proxima = shortDate(input.proximaLabel);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 9px ${LABEL_FONT}`;
  fillTextSpaced(ctx, "REALIZADO", 97, 82, 1.5);
  ctx.font = `700 21px ${LABEL_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(realizacao, 235, 82, 80);
  ctx.fillRect(97, 93, 138, 1);

  // ——— PRÓXIMO (x 97–235, y 97–127) ———
  roundRect(ctx, 97, 97, 138, 30, 6);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 9px ${LABEL_FONT}`;
  fillTextSpaced(ctx, "PRÓXIMO", 107, 112, 1.5);
  ctx.font = `800 26px ${LABEL_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(proxima, 227, 112, 70);

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
    });
    chipY += chipH + chipGap;
  }

  // ——— Contato (x 97–235, y 220–230) ———
  const tel = (input.telefone ?? "").trim() || "(16) 3030-0445";
  const site = formatSite(input.site);
  ctx.fillStyle = "#000000";
  ctx.font = `600 10px ${LABEL_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${tel} · ${site}`, 97, 225, 138);

  // ——— QR (x 245–390, y 70–215) 145×145, módulo inteiro ———
  await drawCrispQr(ctx, input.qrUrl, 245, 70, 145);

  // ——— Lacre (x 245–390, y 220–230) ———
  ctx.fillStyle = "#000000";
  ctx.font = `700 8px ${LABEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextSpaced(ctx, "VOID IF SEAL IS BROKEN", 245 + 145 / 2, 225, 1.5);
}

/** Logo AION + ENGENHARIA na faixa preta, −90° (lê de baixo para cima), 210 pt. */
async function drawSpineBrand(ctx: CanvasRenderingContext2D) {
  // viewBox 214×68 do kit, escalado para ~210×66,5 e centrado na faixa 85×240
  const brandW = 210;
  const brandH = 66.5;
  const cx = 85 / 2;
  const cy = 240 / 2;
  const sx = brandW / 214;
  const sy = brandH / 68;

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
  ctx.stroke(new Path2D("M54.45 15 A28 28 0 1 1 40.25 5.95"));
  ctx.beginPath();
  ctx.arc(48.25, 9.52, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke(new Path2D("M22 47 L33 20 L44 47 M27 38 H39"));

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 40px ${BRAND_FONT}`;
  ctx.fillText("AION", 74, 44);
  ctx.font = `600 10px ${BRAND_FONT}`;
  ctx.fillText("ENGENHARIA", 75, 61);
  ctx.restore();
}

function drawStatusChip(
  ctx: CanvasRenderingContext2D,
  opts: { x: number; y: number; w: number; h: number; label: string; active: boolean },
) {
  const { x, y, w, h, label, active } = opts;
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
    ctx.font = `800 15px ${LABEL_FONT}`;
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
    ctx.font = `600 15px ${LABEL_FONT}`;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, checkX + check + 8, y + h / 2);
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
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const modules = qr.modules;
  const n = modules.size;
  // Preferir 5 pt/módulo quando couber; senão o maior inteiro que cabe
  let modulePt = 5;
  if (modulePt * n > box) {
    modulePt = Math.max(1, Math.floor(box / n));
  }
  const qrSize = modulePt * n;
  const ox = x + Math.floor((box - qrSize) / 2);
  const oy = y + Math.floor((box - qrSize) / 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, box, box);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (modules.get(row, col)) {
        ctx.fillRect(ox + col * modulePt, oy + row * modulePt, modulePt, modulePt);
      }
    }
  }
}

let fontsReady: Promise<void> | null = null;

function ensureLabelFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    try {
      await Promise.all([
        document.fonts.load(`600 10px ${LABEL_FONT}`),
        document.fonts.load(`700 21px ${LABEL_FONT}`),
        document.fonts.load(`800 47px ${LABEL_FONT}`),
        document.fonts.load(`800 40px ${BRAND_FONT}`),
        document.fonts.load(`600 10px ${BRAND_FONT}`),
      ]);
    } catch {
      // Fallback do stack do canvas
    }
  })();
  return fontsReady;
}

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
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

/** Letter-spacing aproximado (pt) — canvas não tem tracking nativo. */
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
  ctx.textAlign = "left";
  ctx.textBaseline = baseline;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i]!, cursor, y);
    cursor += (widths[i] ?? 0) + tracking;
  }
  ctx.textAlign = prevAlign;
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
