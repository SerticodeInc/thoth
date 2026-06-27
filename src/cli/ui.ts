const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

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

export function blank(): void {
  console.log();
}

export function heading(value: string): void {
  console.log(color.cyan(color.bold(value)));
}

export function section(value: string): void {
  console.log(color.blue(color.bold(value)));
}

export function step(value: string): void {
  console.log(`${color.cyan('>')} ${value}`);
}

export function success(value: string): void {
  console.log(`${color.green('[ok]')} ${value}`);
}

export function warn(value: string): void {
  console.warn(`${color.yellow('[warn]')} ${value}`);
}

export function error(value: string): void {
  console.error(`${color.red('[error]')} ${value}`);
}

export function info(value: string): void {
  console.log(`${color.blue('[info]')} ${value}`);
}

export function empty(value: string): void {
  console.log(color.dim(value));
}

export function meta(label: string, value: string | number): void {
  console.log(`  ${color.gray(label.padEnd(14))} ${value}`);
}

export function item(id: string, value: string): void {
  console.log(`  ${color.gray(id)}  ${value}`);
}

export function nextSteps(steps: readonly string[]): void {
  section('Next steps');
  for (const command of steps) {
    console.log(`  ${color.magenta(command)}`);
  }
}
