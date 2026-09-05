#!/usr/bin/env node
/**
 * Gera as telas de abertura do PWA no iOS — `public/brand/splash/*.png`.
 *
 * **Por que existem arquivos em vez de uma cor.** O Android monta o splash
 * sozinho a partir do `background_color` e do ícone do manifest. O iOS não lê
 * nada disso: sem um `<link rel="apple-touch-startup-image">` com media query
 * casando EXATAMENTE com o aparelho, ele abre o app numa tela branca vazia. Por
 * isso é uma imagem por resolução, e por isso um aparelho novo precisa de uma
 * linha nova em `SCREENS` — sem ela o iPhone volta ao branco, em silêncio.
 *
 * O desenho é o mesmo da hero da landing no tema escuro
 * (`--lp-hero` de `.dark`: #1C2349 → #12102A) com a pena por cima no gradiente
 * branco do favicon escuro. O `<path>` NÃO é copiado aqui: ele é lido de
 * `public/brand/pena.svg`, que é o consumo de fora do React da marca (ver
 * src/shared/AGENTS.md). Trocou a marca? Regere isto depois de regerar aquele.
 *
 *   node scripts/generate-splash.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "brand", "splash");
const PENA = join(ROOT, "public", "brand", "pena.svg");
// A MESMA lista que `src/shared/splash.ts` usa para montar os <link>. Se as
// duas metades divergirem, o iPhone procura uma imagem que não existe e abre
// no branco — sem erro nenhum.
const SCREENS_JSON = join(ROOT, "src", "shared", "splash-screens.json");

/** Fundo: os dois stops de `--lp-hero` no tema escuro. */
const BG_TOP = "#1C2349";
const BG_BOTTOM = "#12102A";

function splashFileName({ w, h }) {
  return `splash-${w}x${h}.png`;
}

function buildSvg({ w, h }, pathData) {
  // 30% do menor lado. É a CAIXA, não o desenho: a pena ocupa cerca de três
  // quartos do próprio viewBox, então na tela ela sai perto de 22% da largura —
  // a proporção de marca que uma tela de abertura pede.
  const mark = Math.round(Math.min(w, h) * 0.3);
  const scale = mark / 166; // o viewBox da pena
  const x = Math.round((w - mark) / 2);
  const y = Math.round((h - mark) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG_TOP}"/>
      <stop offset="1" stop-color="${BG_BOTTOM}"/>
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.46" stop-color="#D2D2D2"/>
      <stop offset="1" stop-color="#D2D2D2"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g transform="translate(${x} ${y}) scale(${scale})" opacity="0.92">
    <path d="${pathData}" fill="url(#ink)"/>
  </g>
</svg>`;
}

async function main() {
  const pena = await readFile(PENA, "utf8");
  const match = pena.match(/<path[^>]*\sd="([^"]+)"/);
  if (!match) throw new Error("Não achei o <path> em public/brand/pena.svg");
  const pathData = match[1];
  const screens = JSON.parse(await readFile(SCREENS_JSON, "utf8"));

  await mkdir(OUT_DIR, { recursive: true });
  for (const screen of screens) {
    const png = await sharp(Buffer.from(buildSvg(screen, pathData)))
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    await writeFile(join(OUT_DIR, splashFileName(screen)), png);
    process.stdout.write(`  ${splashFileName(screen)}  ${png.length} bytes\n`);
  }
  process.stdout.write(`\n${screens.length} telas em public/brand/splash/\n`);
}

await main();
