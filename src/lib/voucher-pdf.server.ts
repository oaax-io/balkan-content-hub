// Server-only PDF generator for Balkaneros vouchers.
// Uses pdf-lib (Worker-compatible). No native deps.
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import QRCode from "qrcode";

export interface VoucherPdfData {
  voucherCode: string;
  amountChf: number;
  recipientFirstName: string;
  recipientLastName: string;
  personalMessage?: string | null;
  buyerName: string;
  issuedAt: Date;
  expiresAt: Date;
  footerText?: string;
  termsText?: string;
}

const GOLD = rgb(0.831, 0.686, 0.216); // #d4af37
const GOLD_SOFT = rgb(0.9, 0.78, 0.42);
const BG = rgb(0.078, 0.059, 0.031); // dark warm
const BG_ACCENT = rgb(0.117, 0.086, 0.055);
const CREAM = rgb(0.96, 0.93, 0.85);
const MUTED = rgb(0.7, 0.66, 0.58);

function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  });
}

function fmtAmount(n: number): string {
  return `CHF ${n.toFixed(2).replace(".", "'").replace("'00", ".–")}`;
}

// A soft repeating "balkan" ornament pattern rendered with primitives.
function drawOrnamentBg(page: PDFPage, w: number, h: number) {
  // Base
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: BG });
  // Diagonal shimmer
  for (let i = -h; i < w; i += 60) {
    page.drawLine({
      start: { x: i, y: 0 },
      end: { x: i + h, y: h },
      thickness: 0.4,
      color: BG_ACCENT,
      opacity: 0.6,
    });
  }
  // Corner rosettes (stylised)
  const drawRosette = (cx: number, cy: number, r: number) => {
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI * 2 * k) / 8;
      page.drawCircle({
        x: cx + Math.cos(a) * r * 0.6,
        y: cy + Math.sin(a) * r * 0.6,
        size: r * 0.35,
        borderColor: GOLD,
        borderWidth: 0.4,
        opacity: 0.35,
      });
    }
    page.drawCircle({ x: cx, y: cy, size: r * 0.25, color: GOLD, opacity: 0.55 });
  };
  drawRosette(50, 50, 30);
  drawRosette(w - 50, 50, 30);
  drawRosette(50, h - 50, 30);
  drawRosette(w - 50, h - 50, 30);
}

function drawGoldFrame(page: PDFPage, w: number, h: number, inset = 24) {
  // Outer
  page.drawRectangle({
    x: inset,
    y: inset,
    width: w - inset * 2,
    height: h - inset * 2,
    borderColor: GOLD,
    borderWidth: 1.4,
  });
  // Inner thin
  page.drawRectangle({
    x: inset + 6,
    y: inset + 6,
    width: w - (inset + 6) * 2,
    height: h - (inset + 6) * 2,
    borderColor: GOLD_SOFT,
    borderWidth: 0.4,
    opacity: 0.7,
  });
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = CREAM,
  pageWidth = 842,
  opacity = 1,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (pageWidth - w) / 2, y, size, font, color, opacity });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= maxWidth) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function generateVoucherPdf(data: VoucherPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // A4 landscape
  const W = 842;
  const H = 595;
  const page = doc.addPage([W, H]);

  const fontRegular = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontLight = await doc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  drawOrnamentBg(page, W, H);
  drawGoldFrame(page, W, H);

  // Brand wordmark
  drawCenteredText(page, "B A L K A N E R O S", 540, fontRegular, 22, GOLD, W);
  drawCenteredText(page, "•  R E S T A U R A N T  •", 520, fontLight, 8, MUTED, W);

  // Title
  drawCenteredText(page, "GUTSCHEIN", 455, fontRegular, 44, CREAM, W);
  // Divider
  page.drawLine({
    start: { x: W / 2 - 60, y: 440 },
    end: { x: W / 2 + 60, y: 440 },
    thickness: 0.8,
    color: GOLD,
  });


  // Amount
  drawCenteredText(page, fmtAmount(data.amountChf), 380, fontRegular, 40, GOLD, W);

  // Recipient
  const recipient = `${data.recipientFirstName} ${data.recipientLastName}`.trim();
  drawCenteredText(page, "Für", 340, fontLight, 10, MUTED, W);
  drawCenteredText(page, recipient, 315, fontRegular, 22, CREAM, W);

  // Personal message (optional, italic)
  if (data.personalMessage && data.personalMessage.trim()) {
    const lines = wrapText(`„${data.personalMessage.trim()}"`, fontItalic, 12, 560);
    let y = 285;
    for (const l of lines.slice(0, 4)) {
      drawCenteredText(page, l, y, fontItalic, 12, GOLD_SOFT, W);
      y -= 16;
    }
  }

  // From
  drawCenteredText(page, `Von ${data.buyerName}`, 200, fontLight, 10, MUTED, W);

  // Voucher code block
  page.drawRectangle({
    x: 240,
    y: 130,
    width: W - 480,
    height: 44,
    color: BG_ACCENT,
    borderColor: GOLD,
    borderWidth: 0.6,
  });
  drawCenteredText(page, "Gutschein-Nr.", 158, fontLight, 8, MUTED, W);
  drawCenteredText(page, data.voucherCode, 140, fontRegular, 20, GOLD, W);

  // QR code (right)
  try {
    const qrPngDataUrl = await QRCode.toDataURL(data.voucherCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#d4af37", light: "#140f08" },
      width: 220,
    });
    const b64 = qrPngDataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const qrImg = await doc.embedPng(bytes);
    const qrSize = 78;
    page.drawImage(qrImg, {
      x: W - 80 - qrSize,
      y: 60,
      width: qrSize,
      height: qrSize,
    });
  } catch (e) {
    console.error("[voucher-pdf] qr error", e);
  }

  // Dates
  page.drawText("Ausgestellt", { x: 80, y: 108, size: 8, font: fontLight, color: MUTED });
  page.drawText(fmtDate(data.issuedAt), { x: 80, y: 92, size: 11, font: fontRegular, color: CREAM });
  page.drawText("Gültig bis", { x: 80, y: 72, size: 8, font: fontLight, color: MUTED });
  page.drawText(fmtDate(data.expiresAt), { x: 80, y: 56, size: 11, font: fontRegular, color: GOLD });

  // Footer + terms
  const footer = data.footerText || "Einlösbar für Veranstaltungen und Leistungen von Balkaneros Events (Fine Moments GmbH). Nicht in bar auszahlbar. Teileinlösung möglich, Restbetrag wird auf dem Gutschein vermerkt. Übertragbar.";
  const terms = data.termsText || "Gültig 2 Jahre ab Kaufdatum. Für Verlust, Diebstahl oder Missbrauch wird keine Haftung übernommen. Es gelten die AGB unter balkaneros.ch/agb.";
  const footerLines = wrapText(footer, fontLight, 8, 460);
  let fy = 88;
  for (const l of footerLines.slice(0, 2)) {
    drawCenteredText(page, l, fy, fontLight, 8, MUTED, W);
    fy -= 11;
  }
  drawCenteredText(page, terms, 56, fontLight, 7.5, MUTED, W, 0.9);
  drawCenteredText(page, "balkaneros.ch", 40, fontRegular, 8, GOLD, W);

  return await doc.save();
}

export function generateVoucherCode(): string {
  // BAL-XXXX-XXXX-XXXX in Crockford Base32 (unambiguous chars)
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const seg = () => {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return s;
  };
  return `BAL-${seg()}-${seg()}-${seg()}`;
}
