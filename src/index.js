import { Command } from 'commander';
import { cmdInit } from './commands/init.js';
import { cmdRun } from './commands/run.js';
import { cmdScan } from './commands/scan.js';
import { cmdAllow } from './commands/allow.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Read package.json for version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
    .name('seal-commit')
    .description('A lightweight, zero-config CLI tool to prevent secrets from being committed.')
    .version(packageJson.version);

program
    .command('init')
    .description('Initialize seal-commit in the current repository (sets up git hook)')
    .action(cmdInit);

program
    .command('run')
    .description('Run the secret scanner on staged files (used by pre-commit hook)')
    .action(cmdRun);

program
    .command('scan')
    .description('Manually scan the entire project for secrets')
    .action(cmdScan);

program
    .command('allow <pattern>')
    .description('Allow a specific pattern or string (adds to .sealignore)')
    .action(cmdAllow);

program.parse(process.argv);
