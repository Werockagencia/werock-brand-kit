// Genera todas las versiones del logo We Rock desde el artboard maestro (Logo We Rock R.ai → logo-master.svg).
// uso: node src/build-logos.mjs   (desde la carpeta brand-kit)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// reutiliza puppeteer-core + sharp ya instalados en Contenidos We Rock
const require = createRequire('C:/Users/USER - 001/Desktop/We Rock/Contenidos We Rock/01-estructura/package.json');
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'descargas', 'logos');
fs.rmSync(out, { recursive: true, force: true });

const RED = '#E8000A', INK = '#0A0A0A', WHITE = '#FFFFFF';

// En el artboard, el logo sobre negro son los paths 3..11: 6 letras (WE ROCK), el rayo y el círculo R (2 paths)
const all = [...fs.readFileSync(path.join(root, 'src/logo-master.svg'), 'utf8').matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
const parts = { word: all.slice(2, 8), bolt: all.slice(8, 9), circle: all.slice(9, 11) };

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();

// bounding boxes reales (incluye curvas) medidos por el navegador
const g = (id, ds) => `<g id="${id}">${ds.map(d => `<path d="${d}"/>`).join('')}</g>`;
await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1366 768">${g('word', parts.word)}${g('bolt', parts.bolt)}${g('circle', parts.circle)}</svg>`);
const box = await page.evaluate(() => Object.fromEntries(['word', 'bolt', 'circle'].map(id => {
  const b = document.getElementById(id).getBBox(); return [id, { x: b.x, y: b.y, w: b.width, h: b.height }];
})));
const union = (...bs) => {
  const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y };
};
const full = union(box.word, box.bolt, box.circle);
const r = n => +n.toFixed(3);

// d con coordenadas relativas al origen del recorte (sin transform → archivos limpios para Illustrator/Figma)
const shift = (d, b) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${r(x - b.x)} ${r(y - b.y)}`);
const paths = (ds, b, fill) => ds.map(d => `<path fill="${fill}" d="${shift(d, b)}"/>`).join('\n  ');
const svgDoc = (b, body, title, bg) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(b.w)} ${r(b.h)}" width="${r(b.w)}" height="${r(b.h)}">
  <title>${title}</title>${bg ? `\n  <rect width="${r(b.w)}" height="${r(b.h)}" fill="${bg}"/>` : ''}
  ${body}
</svg>
`;

// ── versiones del logo principal ──
const logos = [
  { id: 'positivo', name: 'We Rock · color positivo (fondos claros)', word: INK, accent: RED },
  { id: 'negativo', name: 'We Rock · color negativo (fondos oscuros)', word: WHITE, accent: RED },
  { id: 'sobre-rojo', name: 'We Rock · sobre rojo', word: WHITE, accent: INK },
  { id: 'mono-negro', name: 'We Rock · monocromo negro', word: INK, accent: INK },
  { id: 'mono-blanco', name: 'We Rock · monocromo blanco', word: WHITE, accent: WHITE },
];
const files = [];
const write = (rel, data) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); files.push(rel); return f; };

async function exportAll(base, svg, w, h, pngWidths) {
  const svgFile = write(`svg/${base}.svg`, svg);
  for (const pw of pngWidths) {
    const png = await sharp(Buffer.from(svg), { density: 72 * pw / w }).resize(pw).png().toBuffer();
    write(`png/${base}-${pw}px.png`, png);
  }
  // PDF vectorial (abre editable en Illustrator) al tamaño exacto del arte en puntos
  await page.setContent(`<style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg.replace(/<\?xml[^>]*>/, '')}`);
  write(`pdf/${base}.pdf`, await page.pdf({ width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: '1' }));
  return svgFile;
}

for (const v of logos) {
  const body = [paths(parts.word, full, v.word), paths(parts.bolt, full, v.accent), paths(parts.circle, full, v.accent)].join('\n  ');
  await exportAll(`we-rock-${v.id}`, svgDoc(full, body, v.name), full.w, full.h, [800, 2400]);
}

// ── rayo (símbolo) para favicon / íconos ──
for (const [id, fill] of [['rojo', RED], ['negro', INK], ['blanco', WHITE]]) {
  await exportAll(`we-rock-rayo-${id}`, svgDoc(box.bolt, paths(parts.bolt, box.bolt, fill), `We Rock · rayo ${id}`), box.bolt.w, box.bolt.h, [512]);
}

// ── avatares cuadrados para redes (logo completo centrado, ~58% del ancho, como el .ai) ──
const square = (bg, word, accent, title) => {
  const S = full.w / 0.58, ox = (S - full.w) / 2, oy = (S - full.h) / 2;
  const sb = { x: full.x - ox, y: full.y - oy, w: S, h: S };
  const body = [paths(parts.word, sb, word), paths(parts.bolt, sb, accent), paths(parts.circle, sb, accent)].join('\n  ');
  return { svg: svgDoc(sb, body, title, bg), S };
};
for (const [id, bg, word, accent] of [['rojo', RED, WHITE, INK], ['negro', INK, WHITE, RED]]) {
  const { svg, S } = square(bg, word, accent, `We Rock · avatar ${id}`);
  const svgFile = write(`redes/we-rock-avatar-${id}.svg`, svg);
  write(`redes/we-rock-avatar-${id}-1080px.png`, await sharp(Buffer.from(svg), { density: 72 * 1080 / S }).resize(1080).png().toBuffer());
}

// ── favicon: rayo rojo sobre negro redondeado ──
{
  const S = box.bolt.h / 0.7, sb = { x: box.bolt.x - (S - box.bolt.w) / 2, y: box.bolt.y - (S - box.bolt.h) / 2, w: S, h: S };
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(S)} ${r(S)}">
  <title>We Rock · favicon</title>
  <rect width="${r(S)}" height="${r(S)}" rx="${r(S * 0.18)}" fill="${INK}"/>
  ${paths(parts.bolt, sb, RED)}
</svg>
`;
  write('favicon/favicon.svg', svg);
  for (const px of [32, 180, 192, 512]) write(`favicon/favicon-${px}px.png`, await sharp(Buffer.from(svg), { density: 72 * px / S * 2 }).resize(px).png().toBuffer());
}

await browser.close();
fs.writeFileSync(path.join(root, 'src', 'geometry.json'), JSON.stringify({ full, ...box }, null, 2));
console.log(files.length, 'archivos →', out);
console.log(JSON.stringify({ full, ...box }));
