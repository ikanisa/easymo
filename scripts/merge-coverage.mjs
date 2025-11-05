import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, '..');
const vitestReport = resolve(repoRoot, 'coverage/vitest/lcov.info');
const jestReport = resolve(repoRoot, 'apps/api/coverage/lcov.info');
const outputDir = resolve(repoRoot, 'coverage/combined');
const outputFile = resolve(outputDir, 'lcov.info');

const sources: Array<{ name: string; path: string }> = [
  { name: 'vitest', path: vitestReport },
  { name: 'jest', path: jestReport },
];

const chunks: string[] = [];

for (const source of sources) {
  try {
    const data = await readFile(source.path, 'utf8');
    if (data.trim().length > 0) {
      chunks.push(`# ${source.name}\n${data.trim()}\n`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`coverage: skipping missing report for ${source.name} (${source.path})`, reason);
  }
}

if (chunks.length === 0) {
  console.warn('coverage: no coverage data found to merge');
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, chunks.join('\n'), 'utf8');
console.log(`coverage: merged reports written to ${outputFile}`);
