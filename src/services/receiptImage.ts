import sharp from 'sharp';
import { fail } from './errors.js';
import { receiptRows, type ReceiptSnapshot } from './receiptLinks.js';

const WIDTH = 760;
const MAX_HEIGHT = 6000;
const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]!);

function wrap(text: string, limit: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const characters = [...word];
      if (characters.length > limit) {
        if (line) { result.push(line); line = ''; }
        for (let offset = 0; offset < characters.length; offset += limit) {
          result.push(characters.slice(offset, offset + limit).join(''));
        }
      } else if (!line) line = word;
      else if (`${line} ${word}`.length <= limit) line += ` ${word}`;
      else { result.push(line); line = word; }
    }
    if (line) result.push(line);
    if (!words.length) result.push('');
  }
  return result;
}

export async function renderReceiptPng(snapshot: ReceiptSnapshot): Promise<Buffer> {
  const lines = receiptRows(snapshot).flatMap(([label, value]) =>
    wrap(`${label}: ${value}`, 44).map(text => `    <text x="44" y="Y" font-size="25">${escapeXml(text)}</text>`)
  );
  const height = 190 + lines.length * 40 + 104;
  if (height > MAX_HEIGHT) fail('RECEIPT_RENDER_ERROR', 'El comprobante supera el tamaño máximo de imagen.');
  let y = 190;
  const placed = lines.map(line => {
    const output = line.replace('Y', String(y));
    y += 40;
    return output;
  }).join('\n');
  const heading = escapeXml(`${snapshot.format.toLocaleUpperCase('es-CO')} · COMPROBANTE INTERNO`);
  const company = escapeXml(snapshot.companyName);
  const branch = escapeXml(snapshot.branchName);
  const disclaimer = 'Documento interno de registro. No es factura electrónica.';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
    <rect width="100%" height="100%" fill="#f4f6f8"/>
    <rect x="20" y="20" width="${WIDTH - 40}" height="${height - 40}" rx="20" fill="#ffffff" stroke="#d7dee5" stroke-width="2"/>
    <rect x="20" y="20" width="${WIDTH - 40}" height="126" rx="20" fill="#123b59"/>
    <text x="44" y="66" fill="#ffffff" font-family="Arial, sans-serif" font-size="27" font-weight="700">${heading}</text>
    <text x="44" y="104" fill="#ffffff" font-family="Arial, sans-serif" font-size="23">${company}</text>
    <text x="44" y="134" fill="#dceaf3" font-family="Arial, sans-serif" font-size="19">${branch}</text>
    <g fill="#18232c" font-family="Arial, sans-serif">${placed}</g>
    <line x1="44" y1="${height - 83}" x2="${WIDTH - 44}" y2="${height - 83}" stroke="#d7dee5"/>
    <text x="44" y="${height - 49}" fill="#596771" font-family="Arial, sans-serif" font-size="17">${disclaimer}</text>
  </svg>`;
  try {
    return await sharp(Buffer.from(svg), { limitInputPixels: WIDTH * MAX_HEIGHT })
      .png({ compressionLevel: 9 }).toBuffer();
  } catch {
    fail('RECEIPT_RENDER_ERROR', 'No se pudo generar la imagen del comprobante.');
  }
}
