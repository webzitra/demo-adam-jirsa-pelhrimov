// Build pro Vercel: do dist/ zkopíruje jen veřejné soubory webu.
// Zdrojáky funkcí (netlify/, api/), node_modules a konfigurace se nenasazují jako statické soubory.
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = 'dist';
const PUBLIC_DIRS = ['admin', 'css', 'fonts', 'img', 'js', 'online-koucink', 'video', 'zona'];
const PUBLIC_ROOT_EXT = new Set(['.html', '.txt', '.xml', '.ico', '.png', '.svg', '.webmanifest']);

rmSync(OUT, { recursive: true, force: true });

for (const dir of PUBLIC_DIRS) {
  if (existsSync(dir)) cpSync(dir, join(OUT, dir), { recursive: true, filter: (src) => !src.endsWith('.DS_Store') });
}
for (const file of readdirSync('.')) {
  if (statSync(file).isFile() && PUBLIC_ROOT_EXT.has(extname(file))) cpSync(file, join(OUT, file));
}

console.log('dist/:', readdirSync(OUT).join(', '));
