#!/usr/bin/env node
/**
 * arreglar-chrome.mjs — si el Chrome de WhatsApp Web quedó a medias (la comprobación dice que falta y
 * `npx puppeteer browsers install chrome` no lo deja bien), lo baja y lo descomprime con la herramienta del sistema.
 *   node arreglar-chrome.mjs        (desde la carpeta scripts de la skill instalada)
 * Si Chrome ya está, no toca nada. No toca tu sesión de WhatsApp. Salida 0 = Chrome listo · 1 = no se pudo.
 * Lo llama instalar.mjs solo si el camino normal falla.
 */
import { join } from 'path';
import { arreglarChrome } from './lib/chrome-manual.mjs';

const puppeteer = (await import('puppeteer')).default;
const b = await import('@puppeteer/browsers');
const { PUPPETEER_REVISIONS } = await import('puppeteer-core/internal/revisions.js');
const cacheDir = puppeteer.configuration.cacheDirectory;
const platform = b.detectBrowserPlatform();
const buildId = PUPPETEER_REVISIONS.chrome;
const salida = new b.Cache(cacheDir).installationDir(b.Browser.CHROME, platform, buildId);
const r = await arreglarChrome({
  ejecutable: puppeteer.executablePath(),
  salida,
  bajarZip: () => b.install({ browser: b.Browser.CHROME, buildId, cacheDir, platform, unpack: false }),
}, (m) => console.log(`  · ${m}`));
if (r.ok) { console.log(`  ✔ Chrome de WhatsApp Web listo (${r.via}): ${r.ruta}`); process.exit(0); }
console.log(`  ✘ ${r.motivo}`);
process.exit(1);
