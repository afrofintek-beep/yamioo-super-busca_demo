// Cartão AFROLOC partilhável — gera uma imagem (PNG) com a marca Yamioo,
// o nome do negócio, o código AFROLOC e um QR. Pronta para o WhatsApp.
// É o "momento inesquecível" do registo e o perfil-ponte do ecossistema.

import QRCode from "qrcode";

const INK = "#0E141A", CREAM = "#F2E7D3", MUTE = "#8A95A1", TEAL = "#19C6AC", AMBER = "#FFB347";

// Deeplink que o QR codifica. Hoje abre a Yamioo no código; amanhã pode
// redirecionar para o perfil Yamilook (yamilook.com/u/<afroloc>).
export function deeplink(code: string): string {
  const origin = typeof location !== "undefined" ? location.origin : "https://yamioo.app";
  return `${origin}/?a=${encodeURIComponent(code)}`;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): number {
  const words = text.split(/\s+/); let line = ""; let yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export async function gerarCartao(nome: string, code: string): Promise<Blob> {
  const W = 640, H = 820, PAD = 48;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#FF7A1A"); g.addColorStop(0.5, AMBER); g.addColorStop(1, TEAL);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 12);

  // wordmark
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.font = "800 44px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = CREAM; ctx.fillText("yami", PAD, 100);
  const wm = ctx.measureText("yami").width;
  ctx.fillStyle = AMBER; ctx.fillText("oo", PAD + wm, 100);

  ctx.font = "600 14px ui-sans-serif, system-ui"; ctx.fillStyle = MUTE;
  ctx.fillText("MORADA DIGITAL AFROLOC", PAD, 138);

  ctx.fillStyle = CREAM; ctx.font = "700 36px ui-sans-serif, system-ui";
  wrapText(ctx, nome, PAD, 196, W - 2 * PAD, 44);

  // QR (código codifica o deeplink)
  const qrData = await QRCode.toDataURL(deeplink(code), { margin: 1, width: 360, color: { dark: INK, light: CREAM } });
  const qrImg = await loadImg(qrData);
  const qs = 340, qx = (W - qs) / 2, qy = 330;
  roundRect(ctx, qx - 18, qy - 18, qs + 36, qs + 36, 20); ctx.fillStyle = CREAM; ctx.fill();
  ctx.drawImage(qrImg, qx, qy, qs, qs);

  // código
  ctx.textAlign = "center"; ctx.fillStyle = TEAL; ctx.font = "600 19px ui-monospace, monospace";
  ctx.fillText(code, W / 2, qy + qs + 74);

  ctx.fillStyle = MUTE; ctx.font = "500 16px ui-sans-serif, system-ui";
  ctx.fillText("Encontra-me na Yamioo · afroloc.ao", W / 2, H - 42);
  ctx.textAlign = "left";

  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png", 0.95));
}

export function baixar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
