import { Command } from 'commander';
import { registerInitCommand } from './commands/init.command.ts';
import { registerImportCommand } from './commands/import.command.ts';
import { registerProfileCommand } from './commands/profile.command.ts';

export function createCli(): Command {
  const program = new Command();

  program
    .name('thoth')
    .description('Identity-Preserving Publishing Engine')
    .version('0.1.0')
    .option('--local', 'Use only local AI (Ollama). No data sent to external providers');

  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.local) {
      process.env.THOTH_LOCAL = 'true';
    }
  });

  registerInitCommand(program);
  registerImportCommand(program);
  registerProfileCommand(program);

  return program;
}
