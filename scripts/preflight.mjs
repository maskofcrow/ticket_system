#!/usr/bin/env node
/**
 * `npm run dev` öncesi ortam kontrolü.
 *
 * Amaç, geliştirmede en sık karşılaşılan üç hatanın ham hâlini kullanıcıya
 * göstermek yerine ne yapılacağını söylemek: dolu port (EADDRINUSE), kapalı
 * Docker ve eksik .env. Bunların hepsi normalde yığının derinlerinden
 * anlaşılması zor hatalarla dönüyor.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

// ── .env ─────────────────────────────────────────────────────────────────────
if (!existsSync(join(root, '.env'))) {
  problems.push(['.env dosyası yok', 'cp .env.example .env']);
}

// ── Portlar ──────────────────────────────────────────────────────────────────
const PORTS = [
  { port: 3000, name: 'API' },
  { port: 5173, name: 'web paneli' },
];

/** Portu gerçekten dinleyebiliyor muyuz — lsof'a bağlı kalmadan. */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

/** Portu tutan süreci tarif et — "kim tutuyor?" sorusu hep bir sonraki adım. */
function describeHolder(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -Fcn 2>/dev/null`, {
      encoding: 'utf8',
    });
    const command = out.match(/^c(.+)$/m)?.[1];
    return command ? ` (şu an "${command}" tutuyor)` : '';
  } catch {
    return '';
  }
}

for (const { port, name } of PORTS) {
  if (!(await isPortFree(port))) {
    problems.push([
      `${port} portu dolu — ${name} başlayamaz${describeHolder(port)}`,
      `lsof -nP -iTCP:${port} -sTCP:LISTEN   # kim tuttuğunu gör\nkill $(lsof -t -iTCP:${port} -sTCP:LISTEN)   # serbest bırak`,
    ]);
  }
}

// ── Docker ───────────────────────────────────────────────────────────────────
try {
  execSync('docker info', { stdio: 'ignore' });
} catch {
  problems.push([
    'Docker çalışmıyor — veritabanı ve dosya depolama ayağa kalkamaz',
    'Docker Desktop veya OrbStack uygulamasını açın',
  ]);
}

// ── Sonuç ────────────────────────────────────────────────────────────────────
if (problems.length > 0) {
  console.error('\n  Başlatmadan önce çözülmesi gerekenler:\n');
  for (const [problem, fix] of problems) {
    console.error(`  ✗ ${problem}`);
    for (const line of fix.split('\n')) console.error(`      ${line}`);
    console.error('');
  }
  process.exit(1);
}

console.log('✓ Ortam hazır');
