#!/usr/bin/env node
/**
 * Deriva a família QUADRADA da marca a partir de `public/brand/logo.png`.
 *
 * Eram seis arquivos redimensionados à mão, em seis tamanhos, e o resultado
 * foi o que se esperava: quando a pele do produto deixou de ser índigo, os
 * seis ficaram para trás juntos — o ícone da tela inicial, o da aba e o do
 * atalho do Android continuaram azuis meses depois de o app ser grafite. O
 * que este script faz não é novidade nenhuma, é só deixar de depender de
 * alguém lembrar dos seis.
 *
 * O MESTRE é `public/brand/scriba.png`, a arte como ela veio do desenho:
 * opaca, quadrada, a pena com 33% de respiro de cada lado — folga de sobra
 * para os 10% que o Android recorta do ícone `maskable`. Todo o resto aqui é
 * redução dele, `logo.png` inclusive, que existe como ARQUIVO SERVIDO (é o
 * `logo` da Organization em `LandingJsonLd`) e não como segundo mestre. Não
 * desenhe um tamanho à mão: troque o mestre e rode
 *
 *   node src/scripts/generate-brand.mjs
 *
 * **O `favicon.ico` é montado byte a byte porque o `sharp` não escreve ICO.**
 * O formato é simples o bastante para isso: um cabeçalho de 6 bytes, uma
 * entrada de 16 por tamanho e os PNGs inteiros logo depois. Os seis tamanhos
 * não são excesso — o Windows usa 16/32/48 em lugares diferentes da mesma
 * tela, e o Google, que não aceita SVG como favicon, lê o maior.
 *
 * **O `apple-icon.png` é ACHATADO, sem canal alpha.** O iOS não compõe o
 * ícone da tela inicial sobre nada: transparência ali vira preto, e o que era
 * respiro em volta da pena viraria uma moldura.
 *
 * O que este script NÃO faz, e não vai fazer: o `banner-preview.png`. Ele
 * carrega a PALAVRA "scriba" em Poppins, e desenhar texto exige a fonte
 * instalada na máquina que roda o script — o `sharp` renderiza SVG pelo
 * resvg, que não vai atrás de fonte do Google. O banner é mestre por si,
 * ver `src/shared/AGENTS.md`.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// src/scripts → a raiz do repositório.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MASTER = join(ROOT, "public", "brand", "scriba.png");

/** Os tamanhos que entram no `.ico`. O 256 é o que o Google lê. */
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

/** Caminho curto, relativo à raiz, só para a linha de log. */
function short(path) {
  return path.slice(ROOT.length).split("\\").join("/");
}

/** Um PNG quadrado do mestre, com o mesmo enquadramento. */
async function square(master, size, { flatten = false } = {}) {
  let pipe = sharp(master).resize(size, size, { fit: "cover" });
  // `flatten` sobre preto: o mestre já é opaco, isto é cinto e suspensório
  // para o dia em que ele chegar com alpha.
  if (flatten) pipe = pipe.flatten({ background: "#000000" });
  return pipe.png({ compressionLevel: 9 }).toBuffer();
}

/** O contêiner ICO: cabeçalho, um diretório por tamanho, os PNGs no fim. */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = ícone
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  // O primeiro PNG começa depois do cabeçalho e de todas as entradas.
  let offset = header.length + dir.length;
  entries.forEach(({ size, png }, i) => {
    const at = i * 16;
    // 256 não cabe num byte, e o formato manda escrever 0 no lugar dele.
    dir.writeUInt8(size === 256 ? 0 : size, at);
    dir.writeUInt8(size === 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2); // cores da paleta: 0, é truecolor
    dir.writeUInt8(0, at + 3); // reservado
    dir.writeUInt16LE(1, at + 4); // planos
    dir.writeUInt16LE(32, at + 6); // bits por pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

async function main() {
  const master = await readFile(MASTER);
  const { width, height } = await sharp(master).metadata();
  // O mestre chegou com 780x779 — um pixel de diferença, que o `cover` do
  // `square` resolve recortando em vez de esticar. Quadrado de verdade ele não
  // precisa ser; parecido com um, sim: um mestre deitado sairia cortado ao
  // meio em todos os tamanhos abaixo, e é melhor recusar aqui.
  const side = Math.min(width, height);
  if (Math.abs(width - height) > side * 0.02) {
    throw new Error(`O mestre precisa ser quadrado, veio ${width}x${height}`);
  }

  const targets = [
    { path: join(ROOT, "public", "brand", "logo.png"), size: side },
    { path: join(ROOT, "public", "brand", "icon-192.png"), size: 192 },
    { path: join(ROOT, "public", "brand", "icon-512.png"), size: 512 },
    { path: join(ROOT, "src", "app", "apple-icon.png"), size: 180, flatten: true },
  ];

  for (const { path, size, flatten } of targets) {
    await writeFile(path, await square(master, size, { flatten }));
    console.log(`  ✓ ${short(path)}  ${size}x${size}`);
  }

  const entries = [];
  for (const size of ICO_SIZES) {
    entries.push({ size, png: await square(master, size) });
  }
  const ico = join(ROOT, "src", "app", "favicon.ico");
  await writeFile(ico, buildIco(entries));
  console.log(`  ✓ /src/app/favicon.ico  ${ICO_SIZES.join("/")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
