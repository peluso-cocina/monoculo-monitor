import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const GITIGNORE = join(ROOT, '.gitignore');

function isIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', path], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

describe('RF-01 repository hygiene', () => {
  it('existe el fichero .gitignore', () => {
    expect(existsSync(GITIGNORE)).toBe(true);
  });

  it.each(['.env', '.env.*', '!.env.example', 'data/', '*.sqlite*', '*.db', 'node_modules/', 'dist/', '*.log'])(
    'contiene el patrón %s',
    (pattern) => {
      const content = readFileSync(GITIGNORE, 'utf-8');
      expect(content.split('\n').map((l) => l.trim())).toContain(pattern);
    },
  );

  it.each(['.env', '.env.local', 'data/database.sqlite', 'data/x.db', 'debug.log', 'dist/index.js'])(
    'git ignora %s',
    (path) => {
      expect(isIgnored(path)).toBe(true);
    },
  );

  it('git NO ignora .env.example', () => {
    expect(isIgnored('.env.example')).toBe(false);
  });
});
