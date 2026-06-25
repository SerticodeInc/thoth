import { describe, it, expect, vi, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CLI = 'npx tsx src/index.ts';

describe('CLI e2e', () => {
  const testDb = join(homedir(), '.thoth', 'thoth.db');

  beforeAll(() => {
    if (existsSync(testDb)) {
      unlinkSync(testDb);
    }
  });

  it('shows help', () => {
    const output = execSync(`${CLI} --help`, { encoding: 'utf-8' });
    expect(output).toContain('thoth');
    expect(output).toContain('init');
    expect(output).toContain('import');
    expect(output).toContain('profile');
  });

  it('shows version', () => {
    const output = execSync(`${CLI} --version`, { encoding: 'utf-8' });
    expect(output).toContain('0.1.0');
  });

  it('runs init successfully', () => {
    const output = execSync(`${CLI} init`, { encoding: 'utf-8' });
    expect(output).toContain('Thoth initialized');
    expect(output).toContain('0 voice, 0 knowledge, 0 publication');
  });

  it('shows profile status after init', () => {
    const output = execSync(`${CLI} profile status`, { encoding: 'utf-8' });
    expect(output).toContain('❌ Not generated');
  });

  it('imports a voice file', () => {
    const output = execSync(`${CLI} import voice tests/fixtures/sample-journal.md`, {
      encoding: 'utf-8',
    });
    expect(output).toContain('Import complete');
  });
});
