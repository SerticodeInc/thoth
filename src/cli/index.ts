import { Command } from 'commander';
import { resolveConfig, applyConfig } from '../infrastructure/config/config-loader.ts';
import { setDbPath } from '../infrastructure/persistence/database.ts';
import { registerInitCommand } from './commands/init.command.ts';
import { registerImportCommand } from './commands/import.command.ts';
import { registerProfileCommand } from './commands/profile.command.ts';
import { registerResearchCommand } from './commands/research.command.ts';
import { registerArticleCommand } from './commands/article.command.ts';
import { registerSeriesCommand } from './commands/series.command.ts';
import { registerExportCommand } from './commands/export.command.ts';

let activeConfig: ReturnType<typeof resolveConfig> | null = null;

export function getConfig() {
  if (!activeConfig) {
    activeConfig = resolveConfig();
  }
  return activeConfig;
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('thoth')
    .description('Identity-Preserving Publishing Engine')
    .version('1.0.0')
    .option('--local', 'Use only local AI (Ollama). No data sent to external providers')
    .option('--provider <name>', 'AI provider to use (openai, groq, gemini, anthropic, ollama)');

  program.hook('preAction', (thisCommand) => {
    const opts: Record<string, unknown> = thisCommand.optsWithGlobals();
    activeConfig = resolveConfig(
      typeof opts.local === 'boolean' ? opts.local : typeof opts.local === 'string' ? opts.local === 'true' : undefined,
      typeof opts.provider === 'string' ? opts.provider : undefined,
    );
    applyConfig(activeConfig);
    if (activeConfig.dbPath) {
      setDbPath(activeConfig.dbPath);
    }
  });

  registerInitCommand(program);
  registerImportCommand(program);
  registerProfileCommand(program);
  registerResearchCommand(program);
  registerArticleCommand(program);
  registerSeriesCommand(program);
  registerExportCommand(program);

  return program;
}
