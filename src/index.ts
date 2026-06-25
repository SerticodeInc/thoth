#!/usr/bin/env node

import { createCli } from './cli/index.ts';

const program = createCli();
program.parse();
