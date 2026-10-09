/**
 * Gera docs/ops/etiqueta-50x30-layout.png (400×240) via Chrome headless.
 * Espelha o layout do kit oficial (LEIA-ME / etiqueta-aion.html) e de render-label.ts.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDocs = join(root, "docs/ops/etiqueta-50x30-layout.png");
const outArt = join("/tmp/cursor/artifacts/etiqueta-50x30-layout.png");

const qrUrl =
  "https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=59";

const AION_SPINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="133" viewBox="0 0 214 68">
  <path d="M54.45 15 A28 28 0 1 1 40.25 5.95" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  <circle cx="48.25" cy="9.52" r="3.4" fill="#ffffff"/>
  <path d="M22 47 L33 20 L44 47 M27 38 H39" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="74" y="44" textLength="136" lengthAdjust="spacing" fill="#ffffff" style="font-family: Arial Black, Arial, sans-serif; font-weight: 800; font-size: 40px">AION</text>
  <text x="75" y="61" textLength="134" lengthAdjust="spacing" fill="#ffffff" style="font-family: Arial, sans-serif; font-weight: 600; font-size: 10px">ENGENHARIA</text>
</svg>`;

const qr = QRCode.create(qrUrl, { errorCorrectionLevel: "M" });
const modulesJson = [];
const n = qr.modules.size;
for (let row = 0; row < n; row++) {
  const line = [];
  for (let col = 0; col < n; col++) line.push(qr.modules.get(row, col) ? 1 : 0);
  modulesJson.push(line);
}

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Montserrat:wght@600;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:#fff}
  canvas{display:block;width:400px;height:240px}
</style></head><body>
<canvas id="c" width="400" height="240"></canvas>
<script>
const LABEL_FONT = '"Barlow Condensed", Arial, sans-serif';
const MODULES = ${JSON.stringify(modulesJson)};
const SPINE_SVG = ${JSON.stringify(AION_SPINE_SVG)};
const STATUS = [
  { label: 'M.P', active: true },
  { label: 'CAL.', active: true },
  { label: 'T.S.E', active: false },
];
function roundRect(ctx,x,y,w,h,r){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
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
function loadImage(src){
  return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=()=>rej(new Error(src)); img.src=src; });
}
function drawChip(ctx,opts){
  const {x,y,w,h,label,active}=opts;
  const check=13, checkX=x+8, checkY=y+(h-check)/2;
  ctx.save();
  ctx.strokeStyle='#000';
  if(active){
    ctx.lineWidth=2; ctx.setLineDash([]);
    roundRect(ctx,x+1,y+1,w-2,h-2,5); ctx.stroke();
    roundRect(ctx,checkX,checkY,check,check,3); ctx.fillStyle='#000'; ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath();
    ctx.moveTo(checkX+check*0.22,checkY+check*0.52);
    ctx.lineTo(checkX+check*0.42,checkY+check*0.72);
    ctx.lineTo(checkX+check*0.78,checkY+check*0.28);
    ctx.stroke();
    ctx.fillStyle='#000'; ctx.font='800 15px '+LABEL_FONT;
  } else {
    ctx.lineWidth=1; ctx.setLineDash([3,2]);
    roundRect(ctx,x+0.5,y+0.5,w-1,h-1,5); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth=2; roundRect(ctx,checkX,checkY,check,check,3); ctx.stroke();
    ctx.fillStyle='#000'; ctx.font='600 15px '+LABEL_FONT;
  }
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(label, checkX+check+8, y+h/2);
  ctx.restore();
}
async function draw(){
  await document.fonts.ready;
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,400,240);

  ctx.fillStyle='#000'; ctx.fillRect(0,0,85,240);
  try{
    const img=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(SPINE_SVG));
    ctx.save(); ctx.translate(42.5,120); ctx.rotate(-Math.PI/2);
    ctx.drawImage(img,-105,-33.25,210,66.5); ctx.restore();
  }catch(e){}

  ctx.fillStyle='#000';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.font='600 10px '+LABEL_FONT;
  fillTextSpaced(ctx,'EQUIP.',97,14,1.5);
  fillTextSpaced(ctx,'Nº',97,26,1.5);
  ctx.font='800 47px '+LABEL_FONT;
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText('HSJ-00001',390,34,280);
  ctx.fillRect(97,57,293,3);

  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font='700 9px '+LABEL_FONT;
  fillTextSpaced(ctx,'REALIZADO',97,82,1.5);
  ctx.font='700 21px '+LABEL_FONT;
  ctx.textAlign='right';
  ctx.fillText('07/26',235,82,80);
  ctx.fillRect(97,93,138,1);

  roundRect(ctx,97,97,138,30,6); ctx.fillStyle='#000'; ctx.fill();
  ctx.fillStyle='#fff';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font='800 9px '+LABEL_FONT;
  fillTextSpaced(ctx,'PRÓXIMO',107,112,1.5);
  ctx.font='800 26px '+LABEL_FONT;
  ctx.textAlign='right';
  ctx.fillText('07/27',227,112,70);

  let chipY=137;
  for(const row of STATUS){
    drawChip(ctx,{x:97,y:chipY,w:138,h:22,label:row.label,active:row.active});
    chipY+=25;
  }

  ctx.fillStyle='#000';
  ctx.font='600 10px '+LABEL_FONT;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('(16) 3030-0445 · aion.eng.br',97,225,138);

  const n=MODULES.length;
  let modulePt=5;
  if(modulePt*n>145) modulePt=Math.max(1,Math.floor(145/n));
  const qrSize=modulePt*n;
  const ox=245+Math.floor((145-qrSize)/2);
  const oy=70+Math.floor((145-qrSize)/2);
  ctx.fillStyle='#fff'; ctx.fillRect(245,70,145,145);
  ctx.fillStyle='#000';
  for(let row=0;row<n;row++) for(let col=0;col<n;col++) if(MODULES[row][col]) ctx.fillRect(ox+col*modulePt,oy+row*modulePt,modulePt,modulePt);

  ctx.font='700 8px '+LABEL_FONT;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  fillTextSpaced(ctx,'VOID IF SEAL IS BROKEN',245+72.5,225,1.5);

  window.__DONE__=canvas.toDataURL('image/png');
}
draw().catch(e=>{ window.__ERR__=String(e); });
</script></body></html>`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;

const userData = `/tmp/etiqueta-chrome-profile-${process.pid}`;
mkdirSync(userData, { recursive: true });

const chromeBin = [
  "/usr/local/bin/google-chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].find((p) => existsSync(p));

if (!chromeBin) {
  server.close();
  console.error("Chrome/Chromium não encontrado — pulando preview PNG");
  process.exit(0);
}

const chrome = spawn(
  chromeBin,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=0`,
    url,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let dbgPort = null;
const errBuf = [];
chrome.stderr.on("data", (buf) => {
  const s = buf.toString();
  errBuf.push(s);
  const m = s.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
  if (m) dbgPort = Number(m[1]);
});

for (let i = 0; i < 50 && !dbgPort; i++) await sleep(100);
if (!dbgPort) {
  chrome.kill();
  server.close();
  throw new Error("Chrome DevTools não iniciou:\n" + errBuf.join(""));
}

const res = await fetch(`http://127.0.0.1:${dbgPort}/json`);
const targets = await res.json();
const page = targets.find((t) => t.type === "page" && t.url.startsWith("http"));
if (!page) throw new Error("Sem página: " + JSON.stringify(targets));

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", () => resolve(), { once: true });
  ws.addEventListener("error", (e) => reject(e), { once: true });
});

let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
  if (msg.id != null && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
function send(method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

await send("Runtime.enable");
let dataUrl = null;
for (let i = 0; i < 60; i++) {
  const r = await send("Runtime.evaluate", {
    expression: "window.__DONE__ || window.__ERR__ || null",
    returnByValue: true,
  });
  const v = r.result?.value;
  if (typeof v === "string") {
    if (v.startsWith("data:image")) {
      dataUrl = v;
      break;
    }
    throw new Error("Erro no canvas: " + v);
  }
  await sleep(100);
}
if (!dataUrl) throw new Error("Timeout aguardando canvas");

const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
const buf = Buffer.from(b64, "base64");
writeFileSync(outDocs, buf);
mkdirSync(dirname(outArt), { recursive: true });
copyFileSync(outDocs, outArt);
console.log("OK", outDocs, buf.length, "bytes");
console.log("OK", outArt);

ws.close();
chrome.kill();
server.close();
process.exit(0);
