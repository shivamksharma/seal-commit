/**
 * Seal-Commit v2 - Main CLI Entry Point
 * 
 * Features:
 * - All commands
 * - Options
 * - CI mode
 */

import { Command } from 'commander';
import { cmdInit } from './commands/init.js';
import { cmdRun } from './commands/run.js';
import { cmdScan } from './commands/scan.js';
import { cmdAllow, cmdVerify, cmdList, cmdConfig } from './commands/allow.js';
import { getPatterns } from './detector.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pc from 'picocolors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
    .name('seal-commit')
    .description('Seal-Commit v2 - Production-grade secret scanner')
    .version(packageJson.version)
    .configureOutput({
        writeOut: (str) => process.stdout.write(str),
        writeErr: (str) => process.stderr.write(str),
        outputError: (str, write) => write(pc.red(str))
    });

// INIT COMMAND
program
    .command('init')
    .description('Initialize seal-commit in repository')
    .option('-f, --force', 'Overwrite existing hook')
    .option('--merge', 'Merge with existing hook')
    .action((options) => cmdInit(options));

// RUN COMMAND
program
    .command('run')
    .description('Scan staged files (used by pre-commit hook)')
    .option('--dry-run', 'Preview without blocking')
    .option('--ci', 'CI mode (for hooks)')
    .option('-v, --verbose', 'Verbose output')
    .action((options) => cmdRun(options));

// SCAN COMMAND
program
    .command('scan')
    .description('Scan project or specific path')
    .option('--dry-run', 'Preview without errors')
    .option('--ci', 'CI mode (exit codes)')
    .option('--no-parallel', 'Disable parallel scanning')
    .action((options) => cmdScan(options));

// ALLOW COMMAND
program
    .command('allow <pattern>')
    .description('Allow a pattern in .sealignore')
    .action((pattern) => cmdAllow(pattern));

// VERIFY COMMAND
program
    .command('verify')
    .description('Verify .sealignore integrity')
    .action(() => cmdVerify());

// LIST COMMAND
program
    .command('list')
    .description('List ignored patterns')
    .action(() => cmdList());

// CONFIG COMMAND
program
    .command('config')
    .description('View or modify configuration')
    .option('--get <key>', 'Get config value')
    .option('--set <key> <value>', 'Set config value')
    .option('--reset', 'Reset to defaults')
    .action((options) => cmdConfig(options));

// PATTERNS COMMAND
program
    .command('patterns')
    .description('List all supported secret patterns')
    .action(() => {
        console.log(pc.bold('\nSeal-Commit v2 - Supported Patterns\n'));
        
        const patterns = getPatterns();
        const colors = {
            critical: pc.red,
            high: pc.yellow,
            medium: pc.cyan,
            low: pc.dim
        };
        
        for (const p of patterns) {
            const color = colors[p.severity] || pc.white;
            console.log(color('  [' + p.severity.toUpperCase().padEnd(8) + '] ' + p.name));
        }
        console.log('');
    });

// CI COMMAND
program
    .command('ci')
    .description('Run in CI mode (for CI/CD pipelines)')
    .action(() => {
        process.env.CI = 'true';
        cmdRun({ ci: true });
    });

// GLOBAL OPTIONS
program
    .option('-v, --verbose', 'Enable verbose output')
    .option('--json', 'Output as JSON (future)')
    .option('--no-color', 'Disable colored output');

program.parse(process.argv);

// Verbose mode
if (program.opts().verbose) {
    process.env.DEBUG = '1';
}
