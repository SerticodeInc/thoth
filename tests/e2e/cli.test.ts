import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CLI = 'npx tsx src/index.ts';
const testDb = join(homedir(), '.thoth', 'thoth-test.db');

function runCli(...args: string[]): string {
  return execSync(`${CLI} ${args.join(' ')} 2>&1`, {
    encoding: 'utf-8',
    env: { ...process.env, THOTH_DB_PATH: testDb },
  });
}

describe('CLI e2e', () => {
  beforeAll(() => {
    if (existsSync(testDb)) {
      unlinkSync(testDb);
    }
  });

  afterAll(() => {
    if (existsSync(testDb)) {
      unlinkSync(testDb);
    }
  });

  it('shows help', () => {
    const output = runCli('--help');
    expect(output).toContain('thoth');
    expect(output).toContain('init');
    expect(output).toContain('import_voice');
    expect(output).toContain('profile_status');
  });

  it('shows version', () => {
    const output = runCli('--version');
    expect(output).toContain('1.0.0');
  });

  it('runs init successfully', () => {
    const output = runCli('init');
    expect(output).toContain('Thoth initialized');
    expect(output).toContain('0 voice, 0 knowledge, 0 publication');
  });

  it('shows profile status after init', () => {
    const output = runCli('profile_status');
    expect(output).toContain('[missing]');
  });

  it('imports a voice file', () => {
    const output = runCli('import_voice', 'tests/fixtures/sample-journal.md');
    expect(output).toContain('[ok] Import complete');
  });
});
