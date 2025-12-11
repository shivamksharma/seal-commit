import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ignore from 'ignore';
import pc from 'picocolors';

export const log = {
    info: (msg) => console.log(pc.cyan('ℹ ') + msg),
    success: (msg) => console.log(pc.green('✔ ') + msg),
    warn: (msg) => console.log(pc.yellow('⚠ ') + msg),
    error: (msg) => console.log(pc.red('✖ ') + msg),
    title: (msg) => console.log(pc.bold(pc.magenta(`\n🦭 ${msg}\n`))),
    dim: (msg) => console.log(pc.dim(msg)),
};

export function box(title, content, color = 'red') {
    const line = '─'.repeat(50);
    console.log(pc[color](`\n┌─ ${title} ${line.slice(title.length + 1)}`));
    content.forEach(c => console.log(pc[color](`│ ${c}`)));
    console.log(pc[color](`└${line}─`));
}

export function isGitRepo() {
    try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

export function assertGitRepo() {
    if (!isGitRepo()) {
        log.error('This command must be run inside a Git repository.');
        log.info('Please initialize git using "git init" or navigate to a valid repository.');
        process.exit(1);
    }
}

export function getIgnoreManager() {
    const ig = ignore();

    // Default ignores
    ig.add([
        '.git',
        'node_modules',
        'dist',
        'build',
        'coverage',
        '.DS_Store',
        '*.lock',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'seal-commit.js' // Ignore self if checking locally
    ]);

    const ignorePath = path.resolve('.sealignore');
    if (fs.existsSync(ignorePath)) {
        const content = fs.readFileSync(ignorePath, 'utf-8');
        ig.add(content);
    }

    return ig;
}
