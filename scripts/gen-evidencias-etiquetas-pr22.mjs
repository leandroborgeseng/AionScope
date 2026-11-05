/**
 * Evidências PR #22 — B1 com setor (curto / longo / vazio) + equipamento longo.
 * Layout alinhado a render-label.ts (setor y≈36, nome y=52, divisor y=64).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "docs/evidencias/etiquetas-reimpressao-os-fechadas");
mkdirSync(outDir, { recursive: true });

const SETOR_MAX = 28;
function truncateSetor(setor, max = SETOR_MAX) {
  const t = (setor ?? "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

const qrUrl =
  "https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=59";
const qr = QRCode.create(qrUrl, { errorCorrectionLevel: "M" });
const modulesJson = [];
const nMod = qr.modules.size;
for (let row = 0; row < nMod; row++) {
  const line = [];
  for (let col = 0; col < nMod; col++) line.push(qr.modules.get(row, col) ? 1 : 0);
  modulesJson.push(line);
}

const LABEL_FONT = '"Barlow Condensed", Arial, sans-serif';
const BRAND_FONT = 'Montserrat, "Barlow Condensed", Arial, sans-serif';
const EQUIP_LONGO =
  "MONITOR MULTIPARAMÉTRICO DE ÚLTIMA GERAÇÃO COM MÓDULO DE CAPNOGRAFIA";

function buildLabelHtml({ setor, equipamento }) {
  const setorLinha = truncateSetor(setor);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Montserrat:wght@600;800&display=swap" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:#fff}canvas{display:block;width:400px;height:240px}</style></head><body>
<canvas id="c" width="400" height="240"></canvas>
<script>
const LABEL_FONT = ${JSON.stringify(LABEL_FONT)};
const BRAND_FONT = ${JSON.stringify(BRAND_FONT)};
const MODULES = ${JSON.stringify(modulesJson)};
const SETOR = ${JSON.stringify(setorLinha)};
const EQUIP = ${JSON.stringify(equipamento)};
const STATUS = [
  { label: 'Manut. Preventiva', active: true },
  { label: 'Calibração', active: true },
  { label: 'Teste Seg. Elétrica', active: false },
];
function roundRect(ctx,x,y,w,h,r){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius); ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius); ctx.arcTo(x,y,x+w,y,radius); ctx.closePath();
}
function fillTextSpaced(ctx,text,x,y,tracking){
  let total=0; const widths=[];
  for(const ch of text){ const w=ctx.measureText(ch).width; widths.push(w); total+=w; }
  total += tracking*Math.max(0,text.length-1);
  let cursor=x;
  if(ctx.textAlign==='center') cursor=x-total/2;
  else if(ctx.textAlign==='right'||ctx.textAlign==='end') cursor=x-total;
  const prev=ctx.textAlign; ctx.textAlign='left';
  for(let i=0;i<text.length;i++){ ctx.fillText(text[i],cursor,y); cursor+=widths[i]+tracking; }
  ctx.textAlign=prev;
}
function fitTextWidth(ctx,text,maxWidth){
  if(ctx.measureText(text).width<=maxWidth) return text;
  let t=text;
  while(t.length>1 && ctx.measureText(t+'…').width>maxWidth) t=t.slice(0,-1);
  return t+'…';
}
function drawChip(ctx,opts){
  const {x,y,w,h,label,active}=opts;
  const check=13, checkX=x+8, checkY=y+(h-check)/2;
  ctx.save(); ctx.strokeStyle='#000';
  if(active){
    ctx.lineWidth=2; ctx.setLineDash([]);
    roundRect(ctx,x+1,y+1,w-2,h-2,5); ctx.stroke();
    roundRect(ctx,checkX,checkY,check,check,3); ctx.fillStyle='#000'; ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath();
    ctx.moveTo(checkX+check*0.22,checkY+check*0.52);
    ctx.lineTo(checkX+check*0.42,checkY+check*0.72);
    ctx.lineTo(checkX+check*0.78,checkY+check*0.28); ctx.stroke();
    ctx.fillStyle='#000'; ctx.font='600 12px '+LABEL_FONT;
  } else {
    ctx.lineWidth=1; ctx.setLineDash([3,2]);
    roundRect(ctx,x+0.5,y+0.5,w-1,h-1,5); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth=2; roundRect(ctx,checkX,checkY,check,check,3); ctx.stroke();
    ctx.fillStyle='#000'; ctx.font='600 12px '+LABEL_FONT;
  }
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(label, checkX+check+8, y+h/2); ctx.restore();
}
function drawSpine(ctx){
  const SPINE_W=68, brandW=170, brandH=48;
  ctx.fillStyle='#000'; ctx.fillRect(0,0,SPINE_W,240);
  ctx.save();
  ctx.translate(SPINE_W/2,120); ctx.rotate(-Math.PI/2); ctx.translate(-brandW/2,-brandH/2);
  ctx.fillStyle='#fff'; ctx.font='800 36px '+BRAND_FONT;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('AION',52,brandH/2+1);
  ctx.beginPath(); ctx.arc(28,24,10,0,Math.PI*2); ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.stroke();
  ctx.restore();
}
async function draw(){
  await document.fonts.ready;
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,400,240);
  drawSpine(ctx);
  const CONTENT_X=78, CONTENT_RIGHT=378, contentW=CONTENT_RIGHT-CONTENT_X, colW=148, colRight=CONTENT_X+colW;
  const temSetor=Boolean(SETOR);
  ctx.fillStyle='#000';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.font='600 12px '+LABEL_FONT;
  fillTextSpaced(ctx,'EQUIP. Nº',CONTENT_X,8,0);
  ctx.font='700 28px '+LABEL_FONT;
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText('HSJ-90001',CONTENT_RIGHT,22);
  // Layout com setor: nome y=52, divisor y=64 (render-label.ts)
  let nomeY=44, lineY=56;
  if(temSetor){
    ctx.font='600 14px '+LABEL_FONT;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(fitTextWidth(ctx, SETOR.toLocaleUpperCase('pt-BR'), contentW), CONTENT_X, 36);
    nomeY=52; lineY=64;
  }
  ctx.font='600 14px '+LABEL_FONT;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(fitTextWidth(ctx, EQUIP.toLocaleUpperCase('pt-BR'), contentW), CONTENT_X, nomeY);
  ctx.fillRect(CONTENT_X,lineY,contentW,2);
  ctx.textAlign='left';
  ctx.font='600 12px '+LABEL_FONT;
  fillTextSpaced(ctx,'REALIZADO',CONTENT_X,82,0);
  ctx.font='700 20px '+LABEL_FONT;
  ctx.textAlign='right';
  ctx.fillText('11/26',colRight,82);
  ctx.fillRect(CONTENT_X,93,colW,1);
  roundRect(ctx,CONTENT_X,97,colW,30,6); ctx.fillStyle='#000'; ctx.fill();
  ctx.fillStyle='#fff';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font='600 12px '+LABEL_FONT;
  fillTextSpaced(ctx,'PRÓXIMO',CONTENT_X+10,112,0);
  ctx.font='700 24px '+LABEL_FONT;
  ctx.textAlign='right';
  ctx.fillText('11/27',colRight-8,112);
  let chipY=137;
  for(const row of STATUS){
    drawChip(ctx,{x:CONTENT_X,y:chipY,w:colW,h:22,label:row.label,active:row.active});
    chipY+=25;
  }
  const n=MODULES.length;
  let modulePt=5;
  if(modulePt*n>136) modulePt=Math.max(1,Math.floor(136/n));
  const qrSize=modulePt*n;
  const qrX=colRight+10;
  const ox=qrX+Math.floor((136-qrSize)/2);
  const oy=70+Math.floor((136-qrSize)/2);
  ctx.fillStyle='#fff'; ctx.fillRect(qrX,70,136,136);
  ctx.fillStyle='#000';
  for(let row=0;row<n;row++) for(let col=0;col<n;col++) if(MODULES[row][col]) ctx.fillRect(ox+col*modulePt,oy+row*modulePt,modulePt,modulePt);
  ctx.fillStyle='#000';
  ctx.font='600 14px '+LABEL_FONT;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('(16) 3030-0445  ·  aion.eng.br', CONTENT_X+contentW/2, 226);
  window.__DONE__=canvas.toDataURL('image/png');
}
draw().catch(e=>{ window.__ERR__=String(e); });
</script></body></html>`;
}

function sleep(ms){ return new Promise((r)=>setTimeout(r,ms)); }
function findChrome(){
  return ["/usr/local/bin/google-chrome","/usr/bin/google-chrome","/usr/bin/chromium"].find((p)=>existsSync(p));
}

async function captureCanvasPng(html, outPath) {
  const chromeBin = findChrome();
  if (!chromeBin) throw new Error("Chrome não encontrado");
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;
  const userData = `/tmp/etiqueta-ev-${process.pid}-${port}`;
  mkdirSync(userData, { recursive: true });
  const chrome = spawn(chromeBin, [
    "--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage",
    `--user-data-dir=${userData}`,`--remote-debugging-port=0`, url,
  ], { stdio: ["ignore","pipe","pipe"] });
  let dbgPort = null; const errBuf = [];
  chrome.stderr.on("data", (buf) => {
    const s = buf.toString(); errBuf.push(s);
    const m = s.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
    if (m) dbgPort = Number(m[1]);
  });
  for (let i = 0; i < 80 && !dbgPort; i++) await sleep(100);
  if (!dbgPort) { chrome.kill(); server.close(); throw new Error(errBuf.join("")); }
  const targets = await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("http"));
  if (!page) throw new Error("Sem página");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", (e) => reject(e), { once: true });
  });
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
    }
  });
  const send = (method, params = {}) => {
    const msgId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };
  await send("Runtime.enable");
  let dataUrl = null;
  for (let i = 0; i < 80; i++) {
    const r = await send("Runtime.evaluate", { expression: "window.__DONE__ || window.__ERR__ || null", returnByValue: true });
    const v = r.result?.value;
    if (typeof v === "string") {
      if (v.startsWith("data:image")) { dataUrl = v; break; }
      throw new Error(v);
    }
    await sleep(100);
  }
  if (!dataUrl) throw new Error("Timeout canvas");
  const buf = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  writeFileSync(outPath, buf);
  console.log("OK B1", outPath, buf.length);
  ws.close(); chrome.kill(); server.close();
}

const variants = [
  { file: "b1-setor-curto.png", setor: "UTI Adulto", equipamento: "Monitor multiparamétrico" },
  { file: "b1-setor-longo.png", setor: "Centro Cirúrgico Bloco B Ala Norte Equipamentos", equipamento: "Monitor multiparamétrico" },
  { file: "b1-setor-vazio.png", setor: "", equipamento: "Monitor multiparamétrico" },
  { file: "b1-equipamento-longo.png", setor: "UTI Adulto", equipamento: EQUIP_LONGO },
];
for (const v of variants) {
  await captureCanvasPng(buildLabelHtml(v), join(outDir, v.file));
}
console.log("B1 done");
