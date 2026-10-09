/**
 * Gera docs/ops/etiqueta-50x30-layout.png (384×240) via Chrome headless.
 * Espelha o layout de lib/etiquetas/render-label.ts (kit HTML / screenshots).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDocs = join(root, "docs/ops/etiqueta-50x30-layout.png");
const outArt = join("/tmp/cursor/artifacts/etiqueta-50x30-layout.png");

const markB64 = readFileSync(join(root, "public/aion-mark.png")).toString("base64");
const qrUrl =
  "https://sjh.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=59";
const qrDataUrl = await QRCode.toDataURL(qrUrl, {
  errorCorrectionLevel: "M",
  margin: 1,
  width: 240,
  color: { dark: "#000000", light: "#ffffff" },
});

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#fff}
  canvas{display:block;width:384px;height:240px}
</style></head><body>
<canvas id="c" width="384" height="240"></canvas>
<script>
const LABEL_FONT = 'Arial, "Helvetica Neue", sans-serif';
const STATUS = [
  { id: 'preventiva', label: 'M.P', active: true },
  { id: 'calibracao', label: 'CAL.', active: true },
  { id: 'tse', label: 'T.S.E', active: false },
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
function loadImage(src){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=()=>rej(new Error(src));
    img.src=src;
  });
}
function drawLogoOnBlack(ctx,img,x,y,w,h){
  const off=document.createElement('canvas');
  off.width=Math.max(1,Math.round(w));
  off.height=Math.max(1,Math.round(h));
  const o=off.getContext('2d');
  o.drawImage(img,0,0,off.width,off.height);
  const image=o.getImageData(0,0,off.width,off.height);
  const d=image.data;
  for(let i=0;i<d.length;i+=4){
    const a=d[i+3];
    if(a<40){d[i+3]=0;continue;}
    const lum=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    if(lum<250){d[i]=d[i+1]=d[i+2]=255;d[i+3]=255;}
    else d[i+3]=0;
  }
  o.putImageData(image,0,0);
  ctx.drawImage(off,x,y,w,h);
}
function drawStatusBox(ctx,opts){
  const {x,y,w,h,label,active,fontSize,checkSize}=opts;
  const r=Math.round(h*0.22);
  ctx.save();
  ctx.strokeStyle='#000';
  ctx.lineWidth=1.25;
  ctx.setLineDash(active?[]:[2.5,2]);
  roundRect(ctx,x+0.5,y+0.5,w-1,h-1,r);
  ctx.stroke();
  ctx.setLineDash([]);
  const checkX=x+Math.round(h*0.22);
  const checkY=y+(h-checkSize)/2;
  if(active){
    ctx.fillStyle='#000';
    roundRect(ctx,checkX,checkY,checkSize,checkSize,2); ctx.fill();
    ctx.strokeStyle='#fff';
    ctx.lineWidth=Math.max(1.5,checkSize*0.14);
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath();
    ctx.moveTo(checkX+checkSize*0.22,checkY+checkSize*0.52);
    ctx.lineTo(checkX+checkSize*0.42,checkY+checkSize*0.72);
    ctx.lineTo(checkX+checkSize*0.78,checkY+checkSize*0.28);
    ctx.stroke();
  } else {
    ctx.strokeStyle='#000'; ctx.lineWidth=1;
    roundRect(ctx,checkX,checkY,checkSize,checkSize,2); ctx.stroke();
  }
  ctx.fillStyle='#000';
  ctx.font='700 '+fontSize+'px '+LABEL_FONT;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(label, checkX+checkSize+5, y+h/2);
  ctx.restore();
}
async function draw(){
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');
  const W=384,H=240;
  const spineW=56, pad=7, gap=6;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  // spine
  ctx.fillStyle='#000'; ctx.fillRect(0,0,spineW,H);
  const logoSize=28;
  const logoCx=spineW/2;
  const logoCy=H-4-logoSize/2;
  try{
    const mark=await loadImage('data:image/png;base64,${markB64}');
    drawLogoOnBlack(ctx,mark,logoCx-logoSize/2,logoCy-logoSize/2,logoSize,logoSize);
  }catch(e){}
  const textBottom=logoCy-logoSize/2-4;
  const textTop=4;
  const textLen=Math.max(24,textBottom-textTop);
  ctx.save();
  ctx.translate(logoCx, textTop+textLen/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillStyle='#fff';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='800 18px '+LABEL_FONT;
  ctx.fillText('AION',0,-18*0.22,textLen);
  ctx.font='600 8px '+LABEL_FONT;
  ctx.fillText('ENGENHARIA',0,18*0.42,textLen);
  ctx.restore();

  const mainX=spineW+pad, mainRight=W-pad, mainW=mainRight-mainX;
  const headerH=40;
  ctx.fillStyle='#000';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.font='700 9px '+LABEL_FONT;
  ctx.fillText('EQUIP.',mainX,pad+2);
  ctx.fillText('Nº',mainX,pad+2+10);
  ctx.font='800 24px '+LABEL_FONT;
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText('HSJ-00001',mainRight,pad+headerH/2-1,mainW*0.72);
  const ruleY=pad+headerH;
  ctx.strokeStyle='#000'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(mainX,ruleY+0.5); ctx.lineTo(mainRight,ruleY+0.5); ctx.stroke();

  const voidH=12, footerH=14;
  const contentTop=ruleY+gap;
  const contentBottom=H-pad-footerH;
  const qrSide=Math.max(72, Math.min(contentBottom-contentTop-voidH-2, Math.round(mainW*0.4)));
  const qrX=mainRight-qrSide, qrY=contentTop;
  const qrImg=await loadImage(${JSON.stringify(qrDataUrl)});
  ctx.drawImage(qrImg,qrX,qrY,qrSide,qrSide);
  ctx.fillStyle='#000';
  ctx.font='700 7.5px '+LABEL_FONT;
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('VOID IF SEAL IS BROKEN', qrX+qrSide/2, qrY+qrSide+2, qrSide+4);

  const leftW=Math.max(48, qrX-gap-mainX);
  let y=contentTop;
  const labelSize=9, dateSize=15;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font='700 '+labelSize+'px '+LABEL_FONT;
  const realLabel='REALIZADO';
  const realLabelW=ctx.measureText(realLabel).width;
  const realRowH=Math.max(dateSize,labelSize)+2;
  ctx.fillText(realLabel,mainX,y+realRowH/2);
  ctx.font='800 '+dateSize+'px '+LABEL_FONT;
  ctx.fillText('07/26',mainX+realLabelW+5,y+realRowH/2);
  y+=realRowH+3;

  const pillH=22, pillPadX=7;
  ctx.font='700 '+Math.round(labelSize*0.95)+'px '+LABEL_FONT;
  const proxWord='PRÓXIMO';
  const proxWordW=ctx.measureText(proxWord).width;
  ctx.font='800 '+dateSize+'px '+LABEL_FONT;
  const proxDateW=ctx.measureText('07/27').width;
  const pillW=Math.min(leftW, Math.ceil(pillPadX*2+proxWordW+5+proxDateW));
  ctx.fillStyle='#000';
  roundRect(ctx,mainX,y,pillW,pillH,Math.round(pillH*0.5)); ctx.fill();
  ctx.fillStyle='#fff';
  ctx.font='700 '+Math.round(labelSize*0.95)+'px '+LABEL_FONT;
  ctx.fillText(proxWord,mainX+pillPadX,y+pillH/2);
  ctx.font='800 '+dateSize+'px '+LABEL_FONT;
  ctx.fillText('07/27',mainX+pillPadX+proxWordW+5,y+pillH/2);
  y+=pillH+6;

  const boxGap=4;
  const boxH=Math.min(26, Math.floor((contentBottom-2-y-boxGap*2)/3));
  const boxW=Math.min(leftW,88);
  const boxFont=Math.round(Math.min(boxH*0.48,12));
  const checkSize=Math.round(boxH*0.48);
  for(const row of STATUS){
    drawStatusBox(ctx,{x:mainX,y,w:boxW,h:boxH,label:row.label,active:row.active,fontSize:boxFont,checkSize});
    y+=boxH+boxGap;
  }
  ctx.fillStyle='#000';
  ctx.font='600 8px '+LABEL_FONT;
  ctx.textAlign='left'; ctx.textBaseline='bottom';
  ctx.fillText('(16) 3030-0445 · aion.eng.br', mainX, H-pad, mainW);
  ctx.strokeStyle='#000'; ctx.lineWidth=1;
  ctx.strokeRect(0.5,0.5,W-1,H-1);
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

const chrome = spawn(
  "/usr/local/bin/google-chrome",
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

async function cdp(method, params = {}, sessionId) {
  // Use HTTP /json/new then WebSocket — simpler: fetch version + page evaluate via /json
  const res = await fetch(`http://127.0.0.1:${dbgPort}/json`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("http"));
  if (!page) throw new Error("Sem página: " + JSON.stringify(targets));
  return page;
}

const page = await cdp();
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
for (let i = 0; i < 40; i++) {
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
