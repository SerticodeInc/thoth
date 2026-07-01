import ora, { type Ora } from 'ora';

const useColor = process.stderr.isTTY && process.env.NO_COLOR === undefined;

const codes = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
} as const;

type Color = keyof typeof codes;

function paint(value: string, color: Color): string {
  if (!useColor) return value;
  return `${codes[color]}${value}${codes.reset}`;
}

function bold(value: string): string {
  if (!useColor) return value;
  return `${codes.bold}${value}${codes.reset}`;
}

export const color = {
  cyan: (value: string) => paint(value, 'cyan'),
  green: (value: string) => paint(value, 'green'),
  yellow: (value: string) => paint(value, 'yellow'),
  red: (value: string) => paint(value, 'red'),
  blue: (value: string) => paint(value, 'blue'),
  magenta: (value: string) => paint(value, 'magenta'),
  gray: (value: string) => paint(value, 'gray'),
  dim: (value: string) => paint(value, 'dim'),
  bold,
};

function writeStderr(value: string): void {
  process.stderr.write(value + '\n');
}

export function blank(): void {
  writeStderr('');
}

export function heading(value: string): void {
  writeStderr(color.cyan(color.bold(value)));
}

export function section(value: string): void {
  writeStderr(color.blue(color.bold(value)));
}

export function step(value: string): void {
  writeStderr(`${color.cyan('>')} ${value}`);
}

export function success(value: string): void {
  writeStderr(`${color.green('[ok]')} ${value}`);
}

export function warn(value: string): void {
  writeStderr(`${color.yellow('[warn]')} ${value}`);
}

export function error(value: string): void {
  writeStderr(`${color.red('[error]')} ${value}`);
}

export function info(value: string): void {
  writeStderr(`${color.blue('[info]')} ${value}`);
}

export function empty(value: string): void {
  writeStderr(color.dim(value));
}

export function meta(label: string, value: string | number): void {
  writeStderr(`  ${color.gray(label.padEnd(16))} ${value}`);
}

export function item(id: string, value: string): void {
  writeStderr(`  ${color.gray(id)}  ${value}`);
}

export function divider(): void {
  writeStderr(color.dim('\u2500'.repeat(48)));
}

export function output(value: string): void {
  process.stdout.write(value + '\n');
}

export function article(value: string): void {
  writeStderr(value);
}

export function timer(start: [number, number]): string {
  const elapsed = process.hrtime(start);
  const ms = elapsed[0] * 1000 + elapsed[1] / 1_000_000;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = ((ms % 60_000) / 1000).toFixed(0);
  return `${min}m ${sec}s`;
}

export interface Spinner {
  start(text?: string): void;
  stop(finalText?: string): void;
  setText(text: string): void;
  isSpinning: boolean;
}

export function spinner(initialText?: string): Spinner {
  let instance: Ora | null = null;

  return {
    start(text?: string) {
      if (!instance) {
        instance = ora({ text: text ?? initialText, color: 'cyan' }).start();
      }
    },
    stop(finalText?: string) {
      if (instance) {
        instance.stop();
        if (finalText) writeStderr(`  ${color.green(finalText)}`);
        instance = null;
      }
    },
    setText(text: string) {
      if (instance) instance.text = text;
    },
    get isSpinning(): boolean {
      return instance !== null;
    },
  };
}

export function summary(entries: Record<string, string>): void {
  const keys = Object.keys(entries);
  const labelWidth = Math.max(...keys.map((k) => k.length));
  writeStderr(color.bold(color.cyan('Summary')));
  for (const [label, value] of Object.entries(entries)) {
    writeStderr(`  ${color.gray(label.padEnd(labelWidth + 2))} ${value}`);
  }
}

export function nextSteps(steps: readonly string[]): void {
  section('Next steps');
  for (const command of steps) {
    writeStderr(`  ${color.magenta(command)}`);
  }
}
